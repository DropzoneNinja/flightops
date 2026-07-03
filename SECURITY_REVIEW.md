# Security Review — FlightOps Full Codebase

**Date:** 2026-07-03
**Reviewer:** Claude Code (automated multi-agent review)
**Scope:** Full backend source (`backend/src/**`) — NestJS API + TypeORM + PostgreSQL
**Methodology:** Four parallel agents covering auth/JWT, API controllers/authorization, media/backup file handling, and equipment/logbook/missions/users endpoints.

---

## Executive Summary

**16 findings** identified: **11 HIGH**, **5 MEDIUM**.

The most critical issues are a cluster of **Insecure Direct Object Reference (IDOR)** vulnerabilities across the flights, pilots, and missions modules — authenticated users can read, modify, or delete other users' private data. Additionally, a **mass assignment** flaw lets any user claim any uploader identity on media uploads, a **command injection** vulnerability exists in the video optimization path, and **SQL injection** strings appear in the backup restore flow. Auth issues include an admin lockout bypass and insecure media token nonce generation.

---

## HIGH Severity

---

### ~~H1 — IDOR: Any user can modify or delete any other user's flights~~ ✅ Fixed

**File:** [backend/src/flights/flights.controller.ts](backend/src/flights/flights.controller.ts) (lines 136–146)
**Also:** [backend/src/flights/flights.service.ts](backend/src/flights/flights.service.ts) (lines 300–328)
**Confidence:** 10/10

**Description:**
`PATCH /flights/:id` and `DELETE /flights/:id` call `flightsService.update(id, dto)` and `flightsService.delete(id)` with no user parameter. Neither service method performs an ownership check. The read endpoints (`GET /flights/:id`, `GET /flights/:id/trackpoints`, `GET /flights/:id/file`) all correctly call `findByIdForUser(id, user.id)` — the write paths do not.

**Exploit Scenario:**
User B learns any flight UUID (trivially via Finding H2 below), then sends `DELETE /flights/<userA-flight-id>`. The flight record and GPX file are permanently deleted. `PATCH` allows arbitrary field modification including `title`, `notes`, and flight metadata.

**Recommendation:**
Pass `user.id` into both service methods. Before mutating, verify `flight.uploaded_by === userId` (or `user.is_admin`), mirroring the existing `findByIdForUser` pattern. Throw `ForbiddenException` on mismatch.

---

### ~~H2 — IDOR: `GET /flights?date=` exposes all users' flights~~ ✅ Fixed

**File:** [backend/src/flights/flights.controller.ts](backend/src/flights/flights.controller.ts) (lines 68–70)
**Also:** [backend/src/flights/flights.service.ts](backend/src/flights/flights.service.ts) (lines 283–289)
**Confidence:** 10/10

**Description:**
`findByDate()` queries `flightsRepository.find({ where: { flight_date: date } })` with no `uploaded_by` filter. Any authenticated user receives every other user's flights for that date, including their UUIDs, `storage_key`, `title`, `notes`, bounding box, and linked pilot entity.

**Exploit Scenario:**
User B calls `GET /flights?date=2026-06-01` and receives all flights for that day across all users. The returned UUIDs are then used to execute H1 (delete or patch) or H3 (read private analysis data). The `storage_key` values also expose internal storage paths.

**Recommendation:**
Add `where: { uploaded_by: userId }` to `findByDate` and accept `userId` from the controller. If daily cross-user views are intentional (e.g. a social "daily board"), strip sensitive fields and document the access model explicitly.

---

### ~~H3 — IDOR: Flight analysis and reanalyze endpoints have no ownership check~~ ✅ Fixed

**File:** [backend/src/flights/flights.controller.ts](backend/src/flights/flights.controller.ts) (lines 117–131)
**Confidence:** 10/10

**Description:**
`GET /flights/:id/analysis` calls `flightAnalysisService.getAnalysis(id)` with no user scoping — it returns coaching notes, scores, and event annotations for any flight. `POST /flights/:id/reanalyze` similarly triggers computation against any flight without verifying the caller owns it.

**Exploit Scenario:**
User B calls `GET /flights/<userA-flight-id>/analysis` and reads Alice's full performance analysis. Alice's flight data is only accessible to her through the normal read path, but the analysis path is unchecked.

**Recommendation:**
Resolve and verify ownership via `findByIdForUser(id, user.id)` before returning analysis data or triggering reanalysis. Throw `ForbiddenException` if the flight does not belong to the requesting user.

---

### ~~H4 — IDOR: Any authenticated user can modify or delete any pilot~~ ✅ Fixed

**File:** [backend/src/pilots/pilots.controller.ts](backend/src/pilots/pilots.controller.ts) (lines 55–71)
**Confidence:** 9/10

**Description:**
`POST /pilots`, `PATCH /pilots/:id`, and `DELETE /pilots/:id` are protected only by `JwtAuthGuard`. The service methods accept no `userId` and perform no ownership check. Any authenticated user can update or delete any other user's pilot profile, including their display name, avatar URL, position, and the `user_id` binding that links a pilot to a user account.

**Exploit Scenario:**
User B calls `DELETE /pilots/<alice-pilot-id>`, removing Alice's pilot record and severing her logbook and position-tracking associations. Or B calls `PATCH /pilots/<alice-pilot-id>` with `{ "user_id": "<bobUserId>" }` to hijack the pilot-to-user binding.

**Recommendation:**
For `PATCH` and `DELETE`: require either `AdminGuard` or verify `pilot.user_id === currentUser.id`. For `POST`: if pilots are always tied to users, derive `user_id` from the authenticated user rather than accepting it from the request body.

---

### ~~H5 — IDOR: `GET /missions` and `GET /missions/:id` expose all users' missions~~ ✅ Fixed

**File:** [backend/src/missions/missions.controller.ts](backend/src/missions/missions.controller.ts) (lines 34–57)
**Also:** [backend/src/missions/missions.service.ts](backend/src/missions/missions.service.ts) (lines 39–68)
**Confidence:** 9/10

**Description:**
`findAll()` and `findOne(id)` perform no user-scoping. Any authenticated user can list all missions from all other users and read any mission's full detail (name, notes, waypoints, fuel plan, creator identity). Only the write operations apply `canUserEdit(mission, user)`.

**Exploit Scenario:**
Any authenticated user calls `GET /missions` and receives all other users' private flight plans including route waypoints, fuel stops, and mission notes.

**Recommendation:**
If missions are private per-user: add `where: { created_by: userId }` to `findAll` and an ownership/visibility check in `findOne`. If partially public (e.g., shared by admin), define an explicit access model and enforce it consistently with the write-path checks.

---

### ~~H6 — Mass assignment: `uploaded_by` accepted from client on media upload~~ ✅ Fixed

**File:** [backend/src/media/media.controller.ts](backend/src/media/media.controller.ts) (line 363)
**Also:** [backend/src/media/dto/create-media.dto.ts](backend/src/media/dto/create-media.dto.ts) (line 18)
**Confidence:** 9/10

**Description:**
`POST /media` is authenticated but stores `createMediaDto.uploaded_by` — a value taken directly from the request body — as the uploader. The controller does not override this with the authenticated user's identity. Because storage quota is debited against `createMediaDto.uploaded_by`, any user can upload files that are attributed to, and counted against, another user's quota. The victim also cannot delete the file because the deletion ownership check compares `media.uploaded_by !== user.username`.

**Exploit Scenario:**
User B uploads a large file with `uploaded_by: "alice"`. Alice's storage quota is consumed. B can repeat this until Alice's quota is exhausted. The media record shows Alice as uploader; Alice cannot delete it because she is not B. B's own quota is unaffected.

**Recommendation:**
Remove `uploaded_by` from `CreateMediaDto`. Derive the uploader identity exclusively from `@CurrentUser()` in the controller and pass it to the service: `return this.mediaService.uploadMedia(file, createMediaDto, user.username)`.

---

### ~~H7 — Command injection: `exec()` used with interpolated path in video optimization~~ ✅ Fixed

**File:** [backend/src/media/media.service.ts](backend/src/media/media.service.ts) (lines 563–590)
**Confidence:** 9/10

**Description:**
`optimizeVideoForStreaming()` uses `promisify(exec)` (which spawns `/bin/sh`) and interpolates `filePath` and `tempPath` directly into a shell command string:

```ts
await execAsync(
  `ffmpeg -i "${filePath}" -c copy -movflags faststart "${tempPath}" -y`,
);
```

The current UUID-based filename prevents user-controlled injection via the filename itself. However, `ext` is taken from `path.extname(originalFilename)`, and `mediaStoragePath` comes from `process.env.MEDIA_STORAGE_PATH`. If either value ever contains `"`, `$`, or backtick characters (e.g. a misconfigured storage path), the shell will interpret them. The root problem is that a shell is being invoked unnecessarily — `execFile` exists and provides identical functionality without the injection surface.

**Exploit Scenario:**
If `MEDIA_STORAGE_PATH` is ever set to a path containing shell metacharacters (possible in containerized or misconfigured environments), any video upload triggers arbitrary command execution on the server. If file extension validation is ever relaxed, a crafted filename provides the same path.

**Recommendation:**
Replace `exec` with `execFile` and pass arguments as an array:
```ts
import { execFile } from 'child_process';
const execFileAsync = promisify(execFile);
await execFileAsync('ffmpeg', ['-i', filePath, '-c', 'copy', '-movflags', 'faststart', tempPath, '-y']);
```
This eliminates the shell entirely regardless of what characters appear in any path.

---

### ~~H8 — SQL injection: database name interpolated into raw SQL in backup restore~~ ✅ Fixed

**File:** [backend/src/backup/backup.service.ts](backend/src/backup/backup.service.ts) (lines 332–362)
**Confidence:** 9/10

**Description:**
`restoreFromBackup()` interpolates `this.dbName` (sourced from `process.env.DATABASE_NAME`) directly into SQL strings passed as `-c` arguments to `psql`:

```ts
'-c', `DROP DATABASE IF EXISTS ${this.dbName};`
'-c', `CREATE DATABASE ${this.dbName};`
'-c', `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${this.dbName}' AND ...`
```

The `DROP DATABASE` and `CREATE DATABASE` statements are unquoted. A value like `flightops; CREATE ROLE hacker SUPERUSER LOGIN PASSWORD 'x'` produces two statements executed sequentially by `psql`, which runs with the application's database user (which has `pg_terminate_backend` and `CREATE DATABASE` privileges at minimum).

**Exploit Scenario:**
In a misconfigured or compromised deployment environment where `DATABASE_NAME` is partially controllable, an attacker sets it to `flightops; CREATE ROLE attacker SUPERUSER LOGIN PASSWORD 'p4ss'`. The next backup restore creates a superuser role on the PostgreSQL instance.

**Recommendation:**
Quote all database name references using PostgreSQL identifier quoting. For the `-c` style calls, double-quote the identifier and escape embedded double-quotes: `` `DROP DATABASE IF EXISTS "${this.dbName.replace(/"/g, '""')}";` ``. Alternatively, validate at startup that `DATABASE_NAME` matches `/^[a-zA-Z_][a-zA-Z0-9_]*$/` and reject startup if it does not — fail fast rather than silently accepting an unsafe value.

---

### ~~H9 — Auth bypass: admin-set account lockout is silently cleared after 1 hour~~ ✅ Fixed

**File:** [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts) (lines 116–138)
**Confidence:** 9/10

**Description:**
`validateUser` contains an auto-unlock block that fires unconditionally when `last_failed_login` is older than 1 hour, clearing `is_locked` regardless of whether the lock was placed by the failure counter or by an administrator:

```ts
if (user.last_failed_login < oneHourAgo) {
  await this.usersService.resetFailedAttempts(user.id);
  user.is_locked = false;  // always fires — no distinction between auto-lock and admin-lock
}
```

`resetFailedAttempts` also sets `is_locked = false` in the database. There is no separate field distinguishing an admin-imposed lock from an auto-lock.

**Exploit Scenario:**
An administrator locks a compromised account (`is_locked = true`) to prevent unauthorized access. The attacker waits 61 minutes (long enough for `last_failed_login` to age out), then attempts login with a known-correct password. The time-window check fires, `resetFailedAttempts` clears `is_locked`, and the subsequent `is_locked` check passes. The attacker authenticates despite the admin lock.

**Recommendation:**
Introduce a separate `is_admin_locked` boolean (or `locked_by: 'auto' | 'admin'` field). The auto-unlock time-window check should only clear auto-locks. An admin lock must be explicitly cleared by an admin action, not by time passage. At minimum, only reset `failed_login_attempts` and `last_failed_login` in the time-window path — do not touch `is_locked` unless `failed_login_attempts >= threshold` was the reason for the lock.

---

### ~~H10 — JWT algorithm not pinned; `alg: none` not explicitly rejected~~ ✅ Fixed

**File:** [backend/src/auth/strategies/jwt.strategy.ts](backend/src/auth/strategies/jwt.strategy.ts) (lines 19–28)
**Also:** [backend/src/auth/media-token.service.ts](backend/src/auth/media-token.service.ts) (lines 53–55)
**Confidence:** 8/10

**Description:**
Neither the `JwtStrategy` `super()` options nor the `MediaTokenService.validateMediaToken` call specifies an `algorithms` allowlist. The `passport-jwt` / `jsonwebtoken` libraries default to accepting the algorithm declared in the token header. Without an explicit `algorithms: ['HS256']` restriction, certain library versions accept tokens with `"alg": "none"` (no signature) or allow RS256/ES256 algorithm-confusion attacks (where the attacker provides a known public key as the HMAC secret).

**Exploit Scenario:**
On a vulnerable library version, an attacker crafts a JWT with `"alg": "none"` and `"sub": "<any-user-id>"`. `JwtAuthGuard` passes the token to `passport-jwt`, which accepts it without verifying a signature, authenticating the attacker as any user with no credentials required.

**Recommendation:**
Explicitly pin the accepted algorithm in both locations:
```ts
// jwt.strategy.ts — inside super({ ... })
algorithms: ['HS256'],

// media-token.service.ts
this.jwtService.verify(token, { secret: this.getMediaTokenSecret(), algorithms: ['HS256'] });
```
This is a low-effort hardening change that eliminates the algorithm-confusion class of attacks regardless of library version.

---

### ~~H11 — Media token nonce generated with `Math.random()` (non-CSPRNG)~~ ✅ Fixed

**File:** [backend/src/auth/media-token.service.ts](backend/src/auth/media-token.service.ts) (lines 81–84)
**Confidence:** 8/10

**Description:**
The nonce embedded in short-lived media access tokens is generated using `Math.random()`, not a cryptographically secure PRNG:

```ts
private generateNonce(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}
```

The comment at line 30 explicitly states the nonce exists "to prevent token reuse/prediction." Node.js's `Math.random()` uses V8's XorShift128+, which is seeded at process startup and predictable if an attacker can observe prior outputs. Total nonce entropy is approximately 40 bits from two draws.

**Exploit Scenario:**
An attacker with a legitimate account observes several media tokens issued to their own account (easily done through normal app use). By recovering enough V8 PRNG state from these observations, they can predict nonces for tokens issued to other users within the same process lifetime, forging valid media access tokens for files they are not authorized to access.

**Recommendation:**
Replace with `crypto.randomBytes()`:
```ts
import { randomBytes } from 'crypto';

private generateNonce(): string {
  return randomBytes(16).toString('hex');
}
```

---

## MEDIUM Severity

---

### ~~M1 — IDOR: Logbook equipment references not validated to belong to the authenticated user~~ ✅ Fixed

**File:** [backend/src/logbook/logbook.service.ts](backend/src/logbook/logbook.service.ts) (lines 359–404 and 142–187)
**Confidence:** 9/10

**Description:**
When creating or updating a logbook entry, the caller can supply arbitrary `wing_id` and `paramotor_id` UUIDs. The service stores them without verifying the referenced equipment belongs to the current user's pilot. `recalculateEquipmentHours()` then issues an `UPDATE` on the referenced equipment row — also with no ownership check — summing `duration_seconds` across all logbook entries referencing that `wing_id` (from any pilot) and writing the result into the equipment's `total_hours` field.

**Exploit Scenario:**
User B creates a logbook entry referencing Alice's `wing_id` with `duration_seconds: 99999999`. `recalculateEquipmentHours` sums all entries referencing that wing (now including B's fabricated entry) and writes a corrupted `total_hours` value to Alice's wing record, destroying her maintenance tracking data.

**Recommendation:**
Before storing `wing_id` or `paramotor_id`, verify the equipment row's `user_id` matches the current user. In `recalculateEquipmentHours`, scope the SUM query to a single pilot (e.g. `AND e.pilot_id = :pilotId`) so cross-user logbook entries cannot affect the equipment hours calculation.

---

### ~~M2 — Auth: password change endpoint requires no current-password confirmation~~ ✅ Fixed

**File:** [backend/src/auth/auth.controller.ts](backend/src/auth/auth.controller.ts) (lines 99–106)
**Also:** [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts) (lines 217–233)
**Confidence:** 9/10

**Description:**
`PATCH /auth/reset-password` is protected only by `JwtAuthGuard`. Any user with a valid JWT — including one stolen from a device, session log, or via other means — can change the account password without knowing the current password. There is no `current_password` challenge and no check that `needs_password_reset` is true.

**Exploit Scenario:**
An attacker who obtains a victim's JWT (via XSS, network interception, or a leaked device) can immediately change the victim's password with a single request, achieving full account takeover without ever knowing the original credentials.

**Recommendation:**
Require `current_password` in `ResetPasswordDto` and validate it against the stored hash before applying the change. Alternatively, treat this as a forced-reset-only path (guarded by `needs_password_reset === true`) and route voluntary password changes through a separate endpoint with a current-password confirmation step.

---

### ~~M3 — IDOR: `POST /flights/compare` returns trackpoints for any flight IDs~~ ✅ Fixed

**File:** [backend/src/flights/flights.controller.ts](backend/src/flights/flights.controller.ts) (lines 41–43)
**Confidence:** 9/10

**Description:**
`POST /flights/compare` accepts a list of flight IDs and returns full trackpoint arrays, statistics, and pilot identity for each — without verifying the requesting user owns any of the referenced flights.

**Exploit Scenario:**
User B submits `{ "flight_ids": ["<alice-uuid>", "<carol-uuid>"] }` (UUIDs obtained via H2) and receives complete GPS trackpoint arrays and performance data for two other users' private flights.

**Recommendation:**
Filter the provided `flight_ids` to only those where `uploaded_by === user.id` (or `user.is_admin`). Return `ForbiddenException` or silently exclude IDs the user does not own.

---

### ~~M4 — Unrestricted backup upload: content validation trivially bypassable~~ ✅ Fixed

**File:** [backend/src/backup/backup.controller.ts](backend/src/backup/backup.controller.ts) (lines 119–136)
**Also:** [backend/src/backup/backup.service.ts](backend/src/backup/backup.service.ts) (lines 242–286)
**Confidence:** 8/10

**Description:**
The backup upload endpoint validates only that the filename ends with `.sql` — a client-controlled string. The subsequent "validate" step checks only that the first 1 KB of the file contains the string `"PostgreSQL"`, which is trivially satisfied by prepending `-- PostgreSQL` to any content. The file is then executed via `psql -f filepath` against the live database with full application user privileges.

**Exploit Scenario:**
An attacker with admin credentials (or a compromised admin JWT) uploads a file named `evil.sql` whose first line is `-- PostgreSQL` followed by arbitrary SQL. The file passes both checks and is executed — including `COPY FROM PROGRAM` statements if the PostgreSQL user has that privilege, which would yield OS-level command execution.

**Recommendation:**
Validate the dump format beyond the `"PostgreSQL"` string: a genuine `pg_dump` plain-SQL file includes a structured header with `pg_dump version`, timestamp, and source database. Cross-reference uploaded files against the `backup_history` table (only restore files that were produced by `executeBackup()`). Revoke `pg_execute_server_program` from the application DB role to prevent `COPY FROM PROGRAM` even if arbitrary SQL is executed.

---

### ~~M5 — Latent SQL injection: raw arithmetic expression in `adjustStorageUsed`~~ ✅ Fixed

**File:** [backend/src/users/users.service.ts](backend/src/users/users.service.ts) (lines 298–319)
**Confidence:** 8/10

**Description:**
`adjustStorageUsed` and `incrementViewedCount` both use TypeORM's raw expression callback in `.set()`, interpolating a numeric value directly:

```ts
.set({ storage_used: () => `storage_used + ${delta}` })
```

TypeORM treats arrow-function values in `.set()` as literal SQL fragments, bypassing parameterisation. TypeScript types are erased at runtime; if `delta` ever originates from a user-controlled JSON field that passes only `@IsNumber()` validation, or if an ORM quirk coerces a non-numeric value, the interpolation becomes a SQL injection point.

**Exploit Scenario:**
Not directly exploitable today — all callers source `delta` from internal values (`file.size` from multer, `file_size` from the database). However, if a future endpoint exposes `adjustStorageUsed` with a user-supplied value, the impact is immediate: the SQL expression executes verbatim in an UPDATE statement on the `users` table.

**Recommendation:**
Use TypeORM's parameterised syntax to eliminate the injection surface proactively:
```ts
.set({ storage_used: () => 'storage_used + :delta' })
.setParameter('delta', delta)
```

---

## Summary Table

| ID | Severity | Category | File | Lines | Confidence |
|----|----------|----------|------|-------|------------|
| ~~H1~~ | ~~HIGH~~ | ~~idor~~ | ~~`flights/flights.controller.ts`~~ | ~~136–146~~ | ~~10/10~~ | ✅ Fixed |
| ~~H2~~ | ~~HIGH~~ | ~~idor~~ | ~~`flights/flights.controller.ts`~~ | ~~68–70~~ | ~~10/10~~ | ✅ Fixed |
| ~~H3~~ | ~~HIGH~~ | ~~idor~~ | ~~`flights/flights.controller.ts`~~ | ~~117–131~~ | ~~10/10~~ | ✅ Fixed |
| ~~H4~~ | ~~HIGH~~ | ~~idor~~ | ~~`pilots/pilots.controller.ts`~~ | ~~55–71~~ | ~~9/10~~ | ✅ Fixed |
| ~~H5~~ | ~~HIGH~~ | ~~idor~~ | ~~`missions/missions.controller.ts`~~ | ~~34–57~~ | ~~9/10~~ | ✅ Fixed |
| ~~H6~~ | ~~HIGH~~ | ~~mass_assignment~~ | ~~`media/media.controller.ts`~~ | ~~363~~ | ~~9/10~~ | ✅ Fixed |
| ~~H7~~ | ~~HIGH~~ | ~~command_injection~~ | ~~`media/media.service.ts`~~ | ~~563–590~~ | ~~9/10~~ | ✅ Fixed |
| ~~H8~~ | ~~HIGH~~ | ~~sqli~~ | ~~`backup/backup.service.ts`~~ | ~~332–362~~ | ~~9/10~~ | ✅ Fixed |
| ~~H9~~ | ~~HIGH~~ | ~~auth_bypass~~ | ~~`auth/auth.service.ts`~~ | ~~116–138~~ | ~~9/10~~ | ✅ Fixed |
| ~~H10~~ | ~~HIGH~~ | ~~jwt_vuln~~ | ~~`auth/strategies/jwt.strategy.ts`~~ | ~~19–28~~ | ~~8/10~~ | ✅ Fixed |
| ~~H11~~ | ~~HIGH~~ | ~~weak_random~~ | ~~`auth/media-token.service.ts`~~ | ~~81–84~~ | ~~8/10~~ | ✅ Fixed |
| ~~M1~~ | ~~MEDIUM~~ | ~~idor~~ | ~~`logbook/logbook.service.ts`~~ | ~~359–404~~ | ~~9/10~~ | ✅ Fixed |
| ~~M2~~ | ~~MEDIUM~~ | ~~auth~~ | ~~`auth/auth.controller.ts`~~ | ~~99–106~~ | ~~9/10~~ | ✅ Fixed |
| ~~M3~~ | ~~MEDIUM~~ | ~~idor~~ | ~~`flights/flights.controller.ts`~~ | ~~41–43~~ | ~~9/10~~ | ✅ Fixed |
| ~~M4~~ | ~~MEDIUM~~ | ~~unrestricted_upload~~ | ~~`backup/backup.controller.ts`~~ | ~~119–136~~ | ~~8/10~~ | ✅ Fixed |
| ~~M5~~ | ~~MEDIUM~~ | ~~sqli (latent)~~ | ~~`users/users.service.ts`~~ | ~~298–319~~ | ~~8/10~~ | ✅ Fixed |

---

## Prioritised Remediation Order

1. **H1 + H2 + H3 + M3** — Fix all flight IDOR issues together; they share a root cause (missing `userId` scoping in the flights service). Low effort, very high impact.
2. **H4** — Add ownership check to pilot mutation endpoints. One guard addition.
3. **H5** — Scope missions list/get to authenticated user.
4. **H6** — Remove `uploaded_by` from `CreateMediaDto`; derive from token. One-line controller fix.
5. **H9** — Separate admin-lock from auto-lock in the lockout logic.
6. **M1** — Add equipment ownership validation in logbook create/update.
7. **M2** — Add current-password challenge to password change flow.
8. **H7** — Switch `exec` to `execFile` in video optimization. One function change.
9. **H8 + M4** — Harden backup restore: quote DB name, validate dump format.
10. **H10** — Pin `algorithms: ['HS256']` in JWT strategy and media token verify. Two-line change.
11. **H11** — Replace `Math.random()` with `randomBytes(16).toString('hex')`. One-line change.
12. **M5** — Parameterise the TypeORM arithmetic expression.
