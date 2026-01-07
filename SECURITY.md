# Security Documentation

This document outlines the security measures implemented in the FlightOps application to protect user accounts and data.

## Table of Contents
- [Authentication & Authorization](#authentication--authorization)
- [Password Security](#password-security)
- [Account Protection](#account-protection)
- [Rate Limiting & Brute Force Prevention](#rate-limiting--brute-force-prevention)
- [Data Security](#data-security)
- [Admin Controls](#admin-controls)
- [Security Best Practices](#security-best-practices)
- [Configuration](#configuration)

---

## Authentication & Authorization

### JWT-Based Authentication
- **Stateless authentication** using JSON Web Tokens (JWT)
- Tokens signed with configurable secret key (`JWT_SECRET`)
- Default token expiration: 7 days (configurable via `JWT_EXPIRATION`)
- Tokens include user ID, email, and username in payload

### Authorization Guards
1. **JwtAuthGuard** - Validates JWT tokens on protected routes
2. **LocalAuthGuard** - Validates email/password credentials during login
3. **AdminGuard** - Restricts sensitive operations to admin users only

### Email Whitelist System
- **Pre-authorization required** for all new registrations
- Only emails in the `pre_authorized_emails` table can register
- Each email can only be used once
- Generic error messages prevent email enumeration attacks

---

## Password Security

### Password Hashing
- **bcrypt algorithm** with 10 salt rounds
- One-way hashing - passwords cannot be reversed
- Password hashing occurs automatically on user creation/update via TypeORM hooks

### Password Requirements
- Minimum length: 9 characters
- Maximum length: 100 characters
- Must contain at least 1 uppercase letter (A-Z)
- Must contain at least 1 number (0-9)
- Validated using `class-validator` decorators with regex patterns

### Password Reset Flow
- Admins can flag accounts for mandatory password reset
- Users flagged with `needs_password_reset = true` bypass password validation on login
- Redirected immediately to password reset page
- Reset flag cleared only after successful password change

### Password Logging
**✅ SECURE:** Passwords are **never logged** to database or console logs. Previous versions that logged passwords have been removed for security.

---

## Account Protection

### Multi-Layer Account Lockout

#### Layer 1: Per-Account Lockout (3 Failed Attempts)
- Account automatically locked after **3 failed password attempts**
- Locked accounts cannot login (returns `401 Unauthorized`)
- Error message: "Account is locked. Please contact an administrator."
- **Automatic unlock**: Failed attempts reset automatically after **1 hour** of inactivity
  - If the last failed login was more than 1 hour ago, the account automatically unlocks on next login attempt
  - Prevents permanent lockouts for legitimate users
- Locked status tracked with:
  - `is_locked` flag
  - `locked_at` timestamp
  - `failed_login_attempts` counter
  - `last_failed_login` timestamp

#### Layer 2: Email-Based Rate Limiting (10 Failed Attempts)
- Maximum **10 failed login attempts per email per 24 hours**
- Rate limit window: 24 hours (configurable via `RATE_LIMIT_FAILED_ATTEMPTS_WINDOW`)
- Max attempts: 10 (configurable via `RATE_LIMIT_FAILED_ATTEMPTS_MAX`)
- Error message: "Too many failed login attempts. Please try again later."
- Returns `429 Too Many Requests` status code

### Account Unlock
- Only admins can unlock locked accounts
- Endpoint: `PATCH /users/:id/unlock`
- Resets all lockout fields:
  - Sets `is_locked = false`
  - Resets `failed_login_attempts = 0`
  - Clears `last_failed_login` and `locked_at` timestamps

### Successful Login Behavior
- Failed attempt counter **resets to 0** on successful login
- Failed attempts automatically reset after **1 hour** of inactivity
  - If no failed login attempts occur for 1 hour, the counter resets and account unlocks automatically
  - This prevents legitimate users from being permanently locked out due to forgotten passwords
- Rate limit counter **persists in database** for the full 24-hour window
  - This prevents attackers from resetting the limit by occasionally guessing correctly

---

## Rate Limiting & Brute Force Prevention

### Email-Based Rate Limiting
**✅ Proxy-Safe:** Uses email addresses instead of IP addresses for rate limiting, ensuring reliable protection when deployed behind proxies or load balancers.

#### How It Works
1. All failed login attempts are logged to the `login_attempts` table
2. Before validating password, system counts failed attempts for that email in the past 24 hours
3. If count ≥ 10, login is blocked with `429 Too Many Requests`
4. Rate limit check occurs **after** user lookup to ensure email exists

#### Benefits
- **Works behind proxies** - doesn't rely on client IP addresses
- **Per-email protection** - prevents targeted attacks on specific accounts
- **Configurable limits** - adjust thresholds based on threat landscape
- **Persistent tracking** - database-backed, survives server restarts

#### Rate Limit Database Index
Optimized query performance with composite index on `(email, created_at)` columns.

### Attack Scenarios & Mitigations

| Attack Type | Mitigation |
|------------|------------|
| **Single account brute force** | Account locks after 3 attempts + rate limit at 10 attempts |
| **Distributed attack (multiple emails)** | Each email has individual account lockout (3 attempts) |
| **Slow brute force** | 24-hour window tracks all attempts, not just recent |
| **Password spraying** | Account lockout prevents trying multiple passwords per account |

---

## Data Security

### Sensitive Data Handling
- **Passwords:** Never stored in plaintext; only bcrypt hashes in database
- **Password attempts:** No longer logged (security improvement from previous versions)
- **IP addresses:** No longer stored (removed for proxy compatibility)
- **JWT tokens:** Stored client-side only; validated on each request

### Database Security
- Password hash field excluded from default queries (`select: false`)
- Explicit selection required to retrieve password hashes (only during authentication)
- Foreign key constraints with cascade delete for data integrity

### Input Validation
- Global `ValidationPipe` with:
  - `whitelist: true` - strips unknown properties
  - `forbidNonWhitelisted: true` - rejects requests with unknown properties
  - `transform: true` - automatic type conversion
- DTO-level validation using `class-validator`
- Email format validation
- Username format validation (alphanumeric + underscore, 3-20 characters)

---

## Admin Controls

### User Management
Admins have access to a comprehensive user management interface with the following capabilities:

#### View All Users
- List of all registered users with:
  - Username, email, admin status
  - Account status (Active/Locked)
  - Last login timestamp
  - Failed login attempt count (on hover)

#### Account Actions
1. **Unlock Account** - Reset lockout and failed attempts
2. **Flag for Password Reset** - Force password change on next login
3. **Delete User** - Remove user account (with safeguards)

### Admin Safeguards
- Cannot delete own account
- Cannot delete the last admin user
- All admin operations require both `JwtAuthGuard` and `AdminGuard`

### Audit Trail
All failed login attempts are logged with:
- Email address
- Success/failure status
- Detailed failure reason (e.g., "Invalid password", "Account locked", "Rate limit exceeded")
- Timestamp

---

## Security Best Practices

### Current Protections ✅
- ✅ Password hashing with bcrypt (10 rounds)
- ✅ JWT token-based authentication
- ✅ Account lockout after failed attempts
- ✅ Email-based rate limiting (proxy-safe)
- ✅ Admin-only sensitive operations
- ✅ No password logging
- ✅ Pre-authorization for new registrations
- ✅ Input validation and sanitization
- ✅ CORS configuration for specific frontend URL

### Security Headers
Configure your reverse proxy/load balancer to add:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### Environment Variables
**IMPORTANT:** Change default values in production:
- `JWT_SECRET` - Use a strong, random secret (minimum 256 bits)
- `DATABASE_PASSWORD` - Use a strong, unique password
- `JWT_EXPIRATION` - Consider shorter expiration for high-security environments

---

## Configuration

### Rate Limiting Settings
Configure in `.env` file:

```bash
# Max failed login attempts per email before rate limiting kicks in
RATE_LIMIT_FAILED_ATTEMPTS_MAX=10

# Time window in hours for counting failed attempts
RATE_LIMIT_FAILED_ATTEMPTS_WINDOW=24
```

**Recommended values:**
- **Development:** MAX=20, WINDOW=1 (lenient for testing)
- **Staging:** MAX=10, WINDOW=24 (match production)
- **Production:** MAX=10, WINDOW=24 (balanced security)
- **High-security:** MAX=5, WINDOW=24 (strict protection)

### Account Lockout Settings
The 3-attempt account lockout is currently hardcoded in [users.service.ts:208](backend/src/users/users.service.ts#L208). To change this threshold, modify:

```typescript
// Lock account after 3 failed attempts
if (user.failed_login_attempts >= 3) {
  user.is_locked = true;
  user.locked_at = new Date();
}
```

---

## Deployment Considerations

### Behind a Proxy/Load Balancer
✅ **This application is designed to work behind proxies.**

Email-based rate limiting ensures reliable brute force protection regardless of proxy configuration. IP addresses are not used for security decisions.

### Database Backups
Ensure regular backups of the following tables:
- `users` - Contains account lockout states
- `login_attempts` - Audit trail for security investigations
- `pre_authorized_emails` - Controls who can register

### Monitoring Recommendations
Monitor these events for security incidents:
1. High volume of failed login attempts from single email
2. Multiple accounts being locked in short timeframe
3. Pattern of "Rate limit exceeded" errors
4. Unusual admin actions (bulk deletions, unlocks)

---

## Reporting Security Issues

If you discover a security vulnerability, please:
1. **Do not** create a public GitHub issue
2. Email security details to your security team
3. Include steps to reproduce the issue
4. Allow reasonable time for patching before disclosure

---

## Changelog

### v2.0 - Email-Based Rate Limiting (Current)
- ✅ Removed IP-based rate limiting (proxy-incompatible)
- ✅ Implemented email-based rate limiting
- ✅ Removed password logging from database and console
- ✅ Added configurable rate limit thresholds
- ✅ Optimized rate limit queries with database index

### v1.0 - Initial Security Implementation
- ✅ Account lockout after 3 failed attempts
- ✅ IP-based rate limiting (deprecated)
- ✅ Password reset functionality
- ✅ Admin user management interface
- ✅ Pre-authorization email system
- ✅ JWT authentication

---

**Last Updated:** January 7, 2026
**Version:** 2.0
