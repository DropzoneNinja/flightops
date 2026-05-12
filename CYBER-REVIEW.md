# Cybersecurity Review Report
**Application:** FlightOps — Paramotor Flight Site & Weather Visualization  
**Review Date:** April 23, 2026 *(updated from February 23, 2026)*  
**Reviewer:** Security Analysis  
**Technology Stack:** NestJS Backend, React Frontend, PostgreSQL, TypeORM, JWT Authentication

---

## Executive Summary

This updated review builds on the February 2026 report, incorporating a full re-audit of the current codebase. The previous critical and three high-severity issues have been resolved. This pass identifies **1 new CRITICAL**, **3 new HIGH**, and **4 new MEDIUM** vulnerabilities that require attention, along with 2 previously flagged issues still outstanding.

**Risk Level:** HIGH (new critical auth-bypass discovered)  
**Immediate Action Required:** Yes — authentication bypass allows login with any password

### Status at a Glance

| Severity | Previously Found | Fixed | Newly Found | Total Outstanding |
|---|---|---|---|---|
| Critical | 1 | 1 ✅ | 1 | **0** ✅ |
| High | 5 | 4 ✅ | 3 | **4** |
| Medium | 6 | 1 ✅ | 4 | **9** |
| Low | 4 | 0 | 2 | **6** |

---

## Table of Contents
1. [Critical Vulnerabilities](#critical-vulnerabilities)
2. [High Severity Issues](#high-severity-issues)
3. [Medium Severity Issues](#medium-severity-issues)
4. [Low Severity Issues](#low-severity-issues)
5. [Previously Fixed Issues](#previously-fixed-issues)
6. [Security Best Practices Observed](#security-best-practices-observed)
7. [Recommendations](#recommendations)

---

## Critical Vulnerabilities

### VULN-01 — Authentication Bypass: Password Check Skipped for `needs_password_reset` Accounts

**Severity:** CRITICAL  
**CWE:** CWE-287 (Improper Authentication)  
**Location:** [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts) ~line 140  
**Status:** ✅ FIXED — April 23, 2026

**Description:**  
When `user.needs_password_reset` is `true`, `validateUser()` returns the user object immediately **without verifying the supplied password**. Any string is accepted as a valid credential for such accounts.

```typescript
if (user.needs_password_reset) {
  // Don't check password, just let them through to reset page
  delete user.password_hash;
  return user;
}
```

**Exploit Scenario:**  
1. Attacker calls `PATCH /users/:id/reset-password` (admin action) to flag a victim account — OR the victim already has `needs_password_reset=true` from a legitimate admin reset.  
2. Attacker POSTs `{ "email": "victim@example.com", "password": "x" }` to `/auth/login`.  
3. Server issues a valid JWT for the victim's account with no password knowledge required.  
4. If victim is an admin, attacker gains full administrative access.

Victim email addresses are discoverable via the `/users` listing endpoint (authenticated, but any user can enumerate others).

**Fix:**  
Always validate the password regardless of `needs_password_reset`. Communicate the flag in the JWT response body so the frontend can redirect to the reset page:

```typescript
// Remove the early-return block entirely.
// After successful bcrypt comparison, check the flag:
const isValid = await bcrypt.compare(password, user.password_hash);
if (!isValid) return null;
delete user.password_hash;
return user; // frontend reads user.needs_password_reset from response
```

---

## High Severity Issues

### VULN-02 — SQL Injection via Raw `storage_used` Update Fragment

**Severity:** HIGH  
**CWE:** CWE-89 (SQL Injection)  
**Location:** [backend/src/users/users.service.ts](backend/src/users/users.service.ts) ~line 280  
**Status:** OPEN — NEW FINDING

**Description:**  
`adjustStorageUsed()` and `incrementViewedCount()` use TypeORM's lambda raw expression syntax, interpolating values directly into a SQL string fragment with no parameterization:

```typescript
// adjustStorageUsed
.set({ storage_used: () => `storage_used + ${delta}` })

// incrementViewedCount — column is a string derived from mediaType
.set({ [column]: () => `${column} + 1` })
```

TypeORM passes lambda return values as raw SQL with no escaping. The `column` variable in `incrementViewedCount` originates from `mediaType` which is persisted and read back from the database — a compromised or inconsistent value can inject arbitrary SQL. The `delta` type is `number` in TypeScript but the runtime does not prevent injection if the value originates from an unsafe path.

**Exploit Scenario:**  
If `column` evaluates to `images_viewed + 1; DROP TABLE users; --`, the resulting SQL fragment is executed verbatim against the database.

**Fix:**  
Use TypeORM's built-in `increment()` method which is fully parameterized:

```typescript
// adjustStorageUsed
await this.userRepository.increment({ username }, 'storage_used', delta);

// incrementViewedCount
await this.userRepository.increment({ username }, column, 1);
```

---

### VULN-03 — Command Injection via `exec()` in Video Optimization

**Severity:** HIGH  
**CWE:** CWE-78 (OS Command Injection)  
**Location:** [backend/src/media/media.service.ts](backend/src/media/media.service.ts) ~line 570  
**Status:** OPEN — NEW FINDING

**Description:**  
`optimizeVideoForStreaming()` builds the ffmpeg command using `child_process.exec()` (which invokes `/bin/sh -c`) with the file path interpolated into the shell string:

```typescript
await execAsync(
  `ffmpeg -i "${filePath}" -c copy -movflags faststart "${tempPath}" -y`,
);
```

`tempPath` is constructed as `${filePath}.tmp`. If `MEDIA_STORAGE_PATH` (the env-configured storage root) contains shell metacharacters, or if any future refactor allows user influence over the path, shell injection is possible. More critically, this `exec` call means any path traversal vulnerability elsewhere in the upload chain directly becomes command injection.

**Fix:**  
Replace `exec` with `execFile` and pass arguments as an array — no shell is invoked:

```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

await execFileAsync('ffmpeg', [
  '-i', filePath,
  '-c', 'copy',
  '-movflags', 'faststart',
  tempPath,
  '-y',
]);
```

---

### VULN-04 — IDOR: Client-Controlled `uploaded_by` Field in Media Upload

**Severity:** HIGH  
**CWE:** CWE-639 (Authorization Bypass Through User-Controlled Key)  
**Location:** [backend/src/media/media.service.ts](backend/src/media/media.service.ts) ~line 363  
**Status:** OPEN — NEW FINDING

**Description:**  
`POST /media` accepts `uploaded_by` from the client-supplied `CreateMediaDto` and persists it directly. The service does not assert that this value matches the authenticated user's identity:

```typescript
uploaded_by: createMediaDto.uploaded_by,  // taken from request body
```

Storage accounting, edit/delete authorization, and analytics are all keyed on the `uploaded_by` field.

**Exploit Scenario:**  
1. Alice authenticates and uploads a file with `{"uploaded_by": "bob"}` in the request body.  
2. Bob's storage quota is debited; Alice's is unaffected.  
3. All UIs show Bob as the uploader; the file is attributed to Bob in all audit trails.  
4. Alice sets `uploaded_by: "admin"` to pollute the admin's activity and storage counters.

**Fix:**  
Override the field server-side with the authenticated user's identity; remove it from the DTO:

```typescript
// In media.controller.ts, pass the authenticated user from @CurrentUser() to service:
uploaded_by: currentUser.username,   // never from DTO
```

Remove `uploaded_by` from `CreateMediaDto` or decorate it `@Exclude()` so it is ignored during deserialization.

---

### VULN-05 — Dependency Vulnerabilities (Previously Reported)

**Severity:** HIGH  
**CWE:** CWE-1035 (Using Components with Known Vulnerabilities)  
**Location:** [backend/package.json](backend/package.json), [frontend/package.json](frontend/package.json)  
**Status:** OPEN — PREVIOUSLY FLAGGED

**Identified vulnerabilities:**

**Frontend:**
- **React Router (`@remix-run/router` ≤1.23.1)** — XSS via open redirects (GHSA-2w69-qvjg-hvjx, CVSSv3.1: 8.0)
- **minimatch** — High severity via eslint dependency chain

**Backend:**
- **minimatch** — High severity via eslint/jest dependency chain
- **@angular-devkit/core** — Moderate severity via NestJS CLI

**Fix:**  
Run `npm audit fix` in both `frontend/` and `backend/` directories. Pin React Router to a patched version. Integrate Dependabot or Snyk into the CI pipeline for ongoing monitoring.

---

## Medium Severity Issues

### VULN-06 — Password Change Endpoint Does Not Verify Current Password

**Severity:** MEDIUM  
**CWE:** CWE-620 (Unverified Password Change)  
**Location:** [backend/src/auth/auth.controller.ts](backend/src/auth/auth.controller.ts) ~line 99  
**Status:** OPEN — NEW FINDING

**Description:**  
`PATCH /auth/reset-password` accepts `new_password` and immediately sets it without requiring the user to supply their current password. Only a valid JWT is required:

```typescript
async resetPassword(@CurrentUser() user: User, @Body() resetDto: ResetPasswordDto) {
  return this.authService.resetPassword(user.id, resetDto.new_password);
}
```

**Exploit Scenario:**  
An attacker who obtains a user's JWT (e.g., via a compromised device, network interception, or a leaked log) can silently change the account password and lock the legitimate owner out before the session expires.

**Fix:**  
Add `current_password` to `ResetPasswordDto` and verify it before accepting the change. This is distinct from the admin-initiated reset (`PATCH /users/:id/reset-password`), which is correctly gated.

```typescript
const valid = await bcrypt.compare(dto.current_password, user.password_hash);
if (!valid) throw new UnauthorizedException('Current password incorrect');
```

---

### VULN-07 — Predictable Media Token Secret and Weak Nonce

**Severity:** MEDIUM  
**CWE:** CWE-330 (Use of Insufficiently Random Values), CWE-916  
**Location:** [backend/src/auth/media-token.service.ts](backend/src/auth/media-token.service.ts) ~line 72  
**Status:** OPEN — NEW FINDING

**Description:**  
Two weaknesses combine here:

1. The media token HMAC secret is derived by appending a fixed suffix to the primary JWT secret:
   ```typescript
   return `${jwtSecret}_media`;
   ```
   An attacker who obtains or brute-forces `JWT_SECRET` trivially knows `MEDIA_TOKEN_SECRET`.

2. The nonce is generated with `Math.random()`, which is not cryptographically secure:
   ```typescript
   return Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15);
   ```
   V8's `Math.random()` output is predictable given other observed values.

**Fix:**
```typescript
// 1. Use a dedicated, independently configured secret
const secret = this.configService.get<string>('MEDIA_TOKEN_SECRET');

// 2. Use crypto.randomBytes for the nonce
import { randomBytes } from 'crypto';
const nonce = randomBytes(16).toString('hex');
```

Add `MEDIA_TOKEN_SECRET` as a required environment variable in `.env.example` and docker-compose files.

---

### VULN-08 — Guessable Default JWT Secrets in Docker Compose Files

**Severity:** MEDIUM  
**CWE:** CWE-798 (Use of Hard-coded Credentials)  
**Location:** [docker-compose.yml](docker-compose.yml) line ~34, [docker-compose.dev.yml](docker-compose.dev.yml) line ~35  
**Status:** OPEN — NEW FINDING

**Description:**  
Both compose files use weak, predictable fallback secrets when `JWT_SECRET` is not set:

```yaml
# docker-compose.yml
JWT_SECRET: ${JWT_SECRET:-changeme-in-production}

# docker-compose.dev.yml
JWT_SECRET: ${JWT_SECRET:-dev-secret-key}
```

An operator who runs `docker compose up` without a `.env` file silently uses a well-known string. `changeme-in-production` and `dev-secret-key` would appear in any JWT secret wordlist. An attacker who knows the secret can forge admin JWT tokens.

**Fix:**  
Remove all default fallback values. The application must refuse to start if `JWT_SECRET` is absent or weak:

```typescript
// In main.ts startup validation
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  throw new Error('JWT_SECRET must be a cryptographically random string of at least 32 characters');
}
```

In compose files:
```yaml
JWT_SECRET: ${JWT_SECRET:?JWT_SECRET is required — generate with: openssl rand -hex 32}
```

---

### VULN-09 — No Rate Limiting on Sensitive Endpoints (Previously Reported)

**Severity:** MEDIUM  
**CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)  
**Location:** All API endpoints except login  
**Status:** OPEN — PREVIOUSLY FLAGGED

While login attempts have brute-force protection ([backend/src/auth/login-attempt.service.ts](backend/src/auth/login-attempt.service.ts)), the following have no rate limiting:

- `POST /auth/register` — allows mass account creation
- `POST /auth/reset-password` — allows rapid password change attempts
- `POST /media` — allows upload flooding

**Fix:**  
Install `@nestjs/throttler` and apply a `ThrottlerGuard` globally, with stricter per-endpoint overrides for auth routes.

---

### VULN-10 — JWT Tokens Stored in `localStorage`

**Severity:** MEDIUM  
**CWE:** CWE-922 (Insecure Storage of Sensitive Information)  
**Location:** [frontend/src/services/api.ts](frontend/src/services/api.ts) ~line 16  
**Status:** OPEN — PREVIOUSLY FLAGGED

`localStorage` is readable by any JavaScript running in the same origin, including malicious third-party scripts. A single XSS vector in any dependency is sufficient to exfiltrate all stored tokens.

```typescript
const token = localStorage.getItem('access_token');
```

**Fix:**  
Store the JWT in an `HttpOnly`, `SameSite=Strict` cookie. This prevents JavaScript access entirely. Implement refresh token rotation with short-lived access tokens.

---

### VULN-11 — Dynamic CORS Origin Without Validation

**Severity:** MEDIUM  
**CWE:** CWE-942 (Permissive Cross-domain Policy)  
**Location:** [backend/src/main.ts](backend/src/main.ts)  
**Status:** OPEN — PREVIOUSLY FLAGGED

`FRONTEND_URL` is accepted without validation; a misconfiguration or operator error could allow unintended origins. No startup check asserts the value is a well-formed URL.

**Fix:**  
Add a startup assertion:
```typescript
const origin = process.env.FRONTEND_URL;
if (!origin || !/^https?:\/\/.+/.test(origin)) {
  throw new Error('FRONTEND_URL must be a valid URL');
}
```

---

## Low Severity Issues

### VULN-12 — Global HTTP Request Timeout Disabled

**Severity:** LOW  
**CWE:** CWE-400 (Uncontrolled Resource Consumption)  
**Location:** [backend/src/main.ts](backend/src/main.ts) ~line 78  
**Status:** OPEN — NEW FINDING

The global Node.js HTTP request timeout is explicitly set to zero (disabled) to accommodate large file uploads:

```typescript
httpServer.requestTimeout = 0;
```

This removes a Node.js security hardening measure. While large uploads are a legitimate need, disabling the timeout globally means slow-loris connections (which send data one byte at a time indefinitely) are never terminated. A more targeted fix keeps protection for non-upload routes.

**Fix:**  
Set a generous global timeout and apply a longer upload-specific timeout only on upload routes:

```typescript
httpServer.requestTimeout = 30000; // 30s global default
// On upload route handler: req.setTimeout(1800000); // 30min for uploads only
```

---

### VULN-13 — GPX Files Persisted to Disk Before Content Validation

**Severity:** LOW  
**CWE:** CWE-434 (Unrestricted Upload of File with Dangerous Type)  
**Location:** [backend/src/flights/flights.service.ts](backend/src/flights/flights.service.ts) ~line 122  
**Status:** OPEN — NEW FINDING

The GPX file is written to disk and a database record created before parsing and validation run. Parsing is fire-and-forget; failed parses set `parse_status: 'failed'` but never delete the file or record. Over time, malformed or malicious GPX files accumulate on disk with permanent database records and no cleanup mechanism.

**Fix:**  
Parse and validate GPX content in-memory (from `file.buffer`) before writing to disk. Only persist on successful validation. Alternatively, add a scheduled cleanup job that removes files and records with `parse_status: 'failed'` older than a configurable threshold.

---

### VULN-14 — Information Disclosure: Account Lock State Revealed in Error Messages

**Severity:** LOW  
**CWE:** CWE-209 (Information Exposure Through Error Messages)  
**Location:** [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts) ~line 135  
**Status:** OPEN — PREVIOUSLY FLAGGED

Different error messages are returned for locked accounts vs. invalid credentials, enabling account enumeration by an attacker:

```typescript
if (user.is_locked) {
  throw new UnauthorizedException('Account is locked. Please contact an administrator.');
}
```

**Fix:**  
Return a single generic message for all authentication failures: `"Invalid credentials"`. Log the specific reason server-side only.

---

### VULN-15 — `console.log` Emitting Config Values in Production

**Severity:** LOW  
**CWE:** CWE-532 (Information Exposure Through Log Files)  
**Location:** [backend/src/settings/settings.service.ts](backend/src/settings/settings.service.ts) ~lines 41–77  
**Status:** OPEN — NEW FINDING

Multiple unconditional `console.log` calls print internal configuration keys and values (with emoji prefixes). These bypass NestJS `Logger` level filtering entirely and will appear in production log aggregators regardless of the configured log level.

**Fix:**  
Replace all `console.log` calls with `this.logger.debug(...)` using the NestJS `Logger` instance. Debug-level logs are suppressed in production when the log level is configured appropriately.

---

### VULN-16 — Frontend `.env.production` Committed to Repository

**Severity:** LOW  
**CWE:** CWE-538 (File and Directory Information Exposure)  
**Location:** [frontend/.env.production](frontend/.env.production)  
**Status:** OPEN — PREVIOUSLY FLAGGED

The file currently contains only `VITE_API_BASE_URL=/api`, but committing any `.env.*` production file to the repository establishes a dangerous precedent. Future developers may add sensitive values.

**Fix:**  
Add `frontend/.env.production` to `.gitignore`. Remove it from git history using `git filter-repo` or BFG Repo Cleaner if any sensitive values are ever added.

---

## Previously Fixed Issues

The following vulnerabilities from the February 2026 report have been resolved:

| # | Issue | Severity | Fixed |
|---|---|---|---|
| F-0 | Auth bypass: password skipped for `needs_password_reset` accounts | Critical | ✅ Apr 23, 2026 |
| F-1 | Command injection in backup service (`exec()` → `execFile()`) | Critical | ✅ Feb 23, 2026 |
| F-2 | Missing CSRF protection (csurf with httpOnly/SameSite cookie) | High | ✅ Feb 23, 2026 |
| F-3 | Missing security headers (helmet.js + CSP + HSTS) | High | ✅ Feb 23, 2026 |
| F-4 | JWT tokens in query parameters (replaced with presigned MediaToken) | High | ✅ Feb 23, 2026 |
| F-5 | Bcrypt rounds too low (10 → 12, configurable via `BCRYPT_ROUNDS`) | Medium | ✅ Feb 23, 2026 |

---

## Security Best Practices Observed

- **ORM query parameterization:** All TypeORM query builder calls use parameterized bindings (`:param` style). The newly found SQL injection is an exception in the raw expression lambda syntax, not a general pattern.
- **File upload magic-byte validation:** `FileValidationUtil` uses the `file-type` library to verify MIME type from file content, not the client-supplied `Content-Type`. Filenames are UUID-prefixed; `path.basename()` sanitization is applied.
- **GPX XML parsing:** `fast-xml-parser` does not resolve external entities; `<!ENTITY` is explicitly blocked before parsing, preventing XXE.
- **Backup restore path traversal:** `path.basename(filename)` check in `validateBackupFile()` prevents `../` traversal; all `pg_dump`/`psql` calls use `execFile` with array arguments.
- **Docker hardening:** Non-root user (`${UID:-1000}`) for service containers; multi-stage build separates build and runtime layers.
- **Account lockout:** Implemented at 3 failed attempts with auto-reset after 1 hour.
- **Admin guard ordering:** All privileged endpoints compose `JwtAuthGuard` before `AdminGuard`, so unauthenticated requests get 401 before 403.
- **Input validation:** NestJS global validation pipe with `whitelist: true` and `forbidNonWhitelisted: true` strips unexpected properties.
- **CORS restriction:** Origin is limited to `FRONTEND_URL`, not a wildcard.
- **Password security:** `password_hash` is excluded from default ORM queries (`select: false`); never logged.

---

## Recommendations

### Immediate (Critical/High)

1. **Fix authentication bypass (VULN-01)** — Remove the early-return in `validateUser()` that skips password verification. **Estimated effort: 30 minutes.**
2. **Fix SQL injection (VULN-02)** — Replace raw lambda expressions with `userRepository.increment()`. **Estimated effort: 30 minutes.**
3. **Fix command injection in ffmpeg (VULN-03)** — Replace `exec()` with `execFile()` and array args. **Estimated effort: 1 hour.**
4. **Fix IDOR in media upload (VULN-04)** — Override `uploaded_by` from authenticated user, not request body. **Estimated effort: 30 minutes.**
5. **Update vulnerable dependencies (VULN-05)** — Run `npm audit fix` in both projects; pin React Router. **Estimated effort: 2 hours.**

### Short-term (Medium)

6. **Require current password for self-service password change (VULN-06).**
7. **Use independent `MEDIA_TOKEN_SECRET` and `crypto.randomBytes` nonce (VULN-07).**
8. **Remove default fallback values from compose JWT secrets; add startup validation (VULN-08).**
9. **Implement `@nestjs/throttler` rate limiting on auth and upload endpoints (VULN-09).**
10. **Migrate JWT storage from `localStorage` to `HttpOnly` cookies (VULN-10).**
11. **Add startup validation for `FRONTEND_URL` (VULN-11).**

### Long-term (Low)

12. **Set a finite global HTTP request timeout; apply per-route override for uploads (VULN-12).**
13. **Validate GPX content in-memory before writing to disk; add cleanup job for failed parses (VULN-13).**
14. **Genericize all authentication error messages (VULN-14).**
15. **Replace `console.log` with `this.logger.debug()` in settings service (VULN-15).**
16. **Remove `frontend/.env.production` from git tracking (VULN-16).**
17. **Consider migrating away from the deprecated `csurf` package to a custom double-submit cookie implementation.**
18. **Implement enhanced audit logging for admin actions, password resets, and deletions.**

---

## Compliance Considerations

If this application processes personal data or is deployed in regulated environments:

- **GDPR:** Right to deletion, data portability, breach notification requirements
- **OWASP Top 10 2021:** A01 (Broken Access Control — VULN-04), A02 (Cryptographic Failures — VULN-07), A03 (Injection — VULN-02, VULN-03), A07 (Identification and Authentication — VULN-01, VULN-06)
- **SOC 2 Type II:** Access control, audit logging, and change management controls

---

## Conclusion

The February 2026 remediation pass addressed the most severe historical issues. This April 2026 re-audit reveals that a **new critical authentication bypass** was introduced (or missed) in the `needs_password_reset` flow — this is the top priority. Three additional high-severity issues (SQL injection, command injection, and IDOR) require prompt attention before the next release.

The application's overall security architecture is sound: the ORM is used correctly in the general case, file uploads are properly validated by magic bytes, CSRF and security headers are in place, and the backup subsystem was correctly hardened. The new findings are focused, fixable, and do not require architectural changes.

**Recommended next sprint priorities:**  
1. Patch VULN-01 (auth bypass) — immediate  
2. Patch VULN-02, VULN-03, VULN-04 (injection / IDOR) — this sprint  
3. Run `npm audit fix` for VULN-05 — this sprint  
4. Address VULN-06 through VULN-11 — next sprint

---

## References

- [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)
- [CWE Database](https://cwe.mitre.org/)
- [NestJS Security Documentation](https://docs.nestjs.com/security/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)

---

*Report generated April 23, 2026 — covers full codebase audit of the `main` branch.*
