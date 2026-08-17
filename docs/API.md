# API Documentation

All endpoints require a `Bearer` token in the `Authorization` header unless otherwise noted. Tokens are obtained via the login endpoint.

> **Mobile App Note:** For native mobile clients, include `Authorization: Bearer <token>` on every request. Tokens expire per the server's `JWT_EXPIRATION` setting (default `7d`). The CSRF token endpoint is only needed for browser-based clients.

---

## Versioning

The API contract is versioned independently of the app release version (the
`4.x.x` in package.json / release notes). The contract version changes only
when the wire protocol itself changes, and follows `MAJOR.MINOR`:

- **MAJOR** bumps on breaking changes — removed/renamed endpoints or
  fields, changed request/response shapes, changed auth mechanics. A client
  built against a different MAJOR cannot reliably talk to the server and
  will be rejected.
- **MINOR** bumps on additive, backward-compatible changes — new endpoints,
  new optional fields/params. Existing clients keep working unmodified.

Current version: **2.6** (source of truth: `backend/src/common/api-version.ts`).

> **v2.0 breaking change (equipment restructure):** the Engine fields
> `tank_size_litres` and `fuel_consumption_lph` were removed. Fuel tank size
> now lives on the Paramotor, and fuel burn rate lives on each
> Paramotor↔Wing link (see [Equipment](#equipment)). This shipped as a hard
> cut (no side-by-side v1 endpoints): clients declaring `X-API-Version: 1`
> receive `426 Upgrade Required`; clients not sending the header pass the
> gate but will no longer see the removed engine fields.

### Response header

Every response includes `X-API-Version: 2.6`. `GET /health` and `GET /` also
include an `apiVersion` field in their JSON body for clients that prefer
checking the body over headers at startup.

### Optional request header

Clients MAY declare the version they were built against:

```http
X-API-Version: 2
```

(`2` or `2.0` are both accepted — only MAJOR is checked.) This is currently
**optional** — if omitted, the server assumes compatibility. This lets
already-deployed clients (the flightnow iOS app, the FlightTV tvOS app)
keep working before they've adopted the header.

If the header is sent and its MAJOR doesn't match the server's, the request
is rejected before reaching any route handler:

```http
HTTP/1.1 426 Upgrade Required
Content-Type: application/json

{
  "statusCode": 426,
  "error": "Upgrade Required",
  "message": "This client was built for API v1.x, but the server is running v2.0. Please update the app to continue.",
  "serverApiVersion": "2.0",
  "clientApiVersion": "1.3"
}
```

MINOR mismatches are never rejected up front — an older client simply
doesn't call newer endpoints/fields. A client expecting an unreleased MINOR
gets an ordinary `404` on a route that doesn't exist yet, or a
`400 Bad Request` when it sends a not-yet-supported field in a request body
(the server rejects unknown body fields). Check the `X-API-Version`
response header before using MINOR-gated fields.

**flightnow / FlightTV:** send `X-API-Version: <major>` once your build
knows its target, and treat `426` as "must upgrade," the same way you
already treat `401`/`403`/`5xx`.

### Shipping a breaking (MAJOR) change

Don't version the whole API. When a specific endpoint needs an incompatible
change, use Nest's built-in per-route versioning
(`app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`
in `main.ts` + `@Version('2')` on the new handler) to run the old and new
implementation of just that endpoint side by side during the client
migration window, then bump `API_VERSION.major` once old clients are no
longer expected in the field.

---

## Authentication

### Get CSRF Token
```http
GET /auth/csrf-token
```
> Browser clients only — not required for native mobile apps.

Response:
```json
{ "csrfToken": "abc123..." }
```

---

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "pilot@example.com",
  "password": "SecurePassword123"
}
```

> Registration requires the email to be pre-authorized by an admin. See [Adding a Pre-authorized Email](#adding-a-pre-authorized-email).

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "pilot@example.com",
    "username": null,
    "is_admin": false,
    "created_at": "2026-01-15T10:00:00.000Z",
    "needs_username_setup": true,
    "needs_password_reset": false
  }
}
```

---

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "pilot@example.com",
  "password": "SecurePassword123"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "pilot@example.com",
    "username": "alice",
    "is_admin": false,
    "created_at": "2026-01-15T10:00:00.000Z",
    "needs_username_setup": false,
    "needs_password_reset": false
  }
}
```

---

### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>
```

Response:
```json
{
  "id": "uuid",
  "email": "pilot@example.com",
  "username": "alice",
  "is_admin": false,
  "created_at": "2026-01-15T10:00:00.000Z",
  "needs_username_setup": false,
  "needs_password_reset": false,
  "has_apk_access": false
}
```

`has_apk_access` is `true` for admins and for any user an admin has explicitly granted access to the Flightoid APK download page (see [Flightoid App](#flightoid-app-admin) below). It also appears on the `user` object returned by `POST /auth/register`, `POST /auth/login`, and `POST /auth/setup-username`.

---

### Setup Username
```http
POST /auth/setup-username
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "alice"
}
```

> Required on first login if `needs_username_setup` is `true`.

---

### Check Username Availability
```http
GET /auth/check-username?username=alice
```

> No auth required.

Response:
```json
{ "available": true }
```

---

### Reset Password
```http
PATCH /auth/reset-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "current_password": "OldPassword123",
  "new_password": "NewSecurePassword456"
}
```

`current_password` is required. Returns `401` if it does not match the stored password.

---

### Adding a Pre-authorized Email

Add an email to the whitelist via psql:
```bash
docker compose exec postgres psql -U flightops -d flightops -c \
  "INSERT INTO pre_authorized_emails (email, role) VALUES ('your@email.com', 'admin');"
```

---

## Backup (Admin)

All backup endpoints require `Authorization: Bearer <token>` and an admin account.

### Trigger Manual Backup
```http
POST /backup/manual
Authorization: Bearer <token>
```

Runs `pg_dump` immediately and records the result in backup history.

Response: `{ "message": "Backup completed successfully" }`

---

### Get Last Backup Status
```http
GET /backup/status
Authorization: Bearer <token>
```

Response:
```json
{
  "lastBackup": {
    "filename": "flightops_manual_2026-07-03T10-00-00-000Z.sql",
    "status": "success",
    "type": "manual",
    "timestamp": "2026-07-03T10:00:00.000Z",
    "fileSize": 1048576,
    "duration": 3200,
    "error": null
  }
}
```

`type` is one of `manual`, `scheduled`, `pre-restore`, or `uploaded`.

---

### Get Backup History
```http
GET /backup/history
Authorization: Bearer <token>
```

Returns the 20 most recent backup history entries.

---

### List Backup Files
```http
GET /backup/files
Authorization: Bearer <token>
```

Returns metadata for all `.sql` files present in the backup directory.

---

### Restore from Backup
```http
POST /backup/restore
Authorization: Bearer <token>
Content-Type: application/json

{ "filename": "flightops_manual_2026-07-03T10-00-00-000Z.sql" }
```

Restores the database from a backup file. Before restoring, the current database is snapshotted as a `pre-restore` backup. Only files that were created or uploaded through this system (i.e. tracked in backup history) can be restored.

Response:
```json
{
  "message": "Database restored successfully",
  "preRestoreBackup": "flightops_pre-restore_2026-07-03T10-05-00-000Z.sql"
}
```

---

### Upload Backup File
```http
POST /backup/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file:                <.sql file>
restoreImmediately:  true  (optional)
```

Uploads an external backup file into the backup directory. The file **must** be a genuine `pg_dump` plain-SQL dump — the server verifies the standard pg_dump header markers (`-- PostgreSQL database dump` and `-- Dumped by pg_dump version`) and rejects anything that does not match.

If `restoreImmediately=true`, the database is restored immediately after upload (equivalent to calling `/backup/restore` with the uploaded filename).

Response (upload only):
```json
{ "message": "File uploaded successfully", "filename": "uploaded_2026-07-03T10-00-00-000Z_mybackup.sql" }
```

Response (upload + restore):
```json
{
  "message": "File uploaded and database restored successfully",
  "filename": "uploaded_2026-07-03T10-00-00-000Z_mybackup.sql",
  "preRestoreBackup": "flightops_pre-restore_2026-07-03T10-05-00-000Z.sql"
}
```

---

### Update Backup Schedule
```http
POST /backup/update-schedule
Authorization: Bearer <token>
```

Reloads the backup cron schedule from current settings. Call this after changing backup-related settings.

---

## User Management (Admin)

All endpoints in this section require `Authorization: Bearer <token>` and an admin account.

### Lock User Account
```http
PATCH /users/:id/lock
Authorization: Bearer <token>
```

Administratively locks the account. Unlike an auto-lock (triggered by too many failed login attempts), an admin lock is **not** cleared automatically after 1 hour — it persists until explicitly unlocked by an admin.

Response:
```json
{
  "message": "User account locked successfully",
  "user": {
    "id": "uuid",
    "email": "pilot@example.com",
    "username": "alice",
    "is_admin_locked": true
  }
}
```

Returns `403` if the caller attempts to lock their own account.

---

### Unlock User Account
```http
PATCH /users/:id/unlock
Authorization: Bearer <token>
```

Clears both the auto-lock (`is_locked`) and admin-lock (`is_admin_locked`) and resets the failed-login counter.

Response:
```json
{
  "message": "User account unlocked successfully",
  "user": {
    "id": "uuid",
    "email": "pilot@example.com",
    "username": "alice",
    "is_locked": false,
    "is_admin_locked": false,
    "failed_login_attempts": 0
  }
}
```

---

### Flag User for Password Reset
```http
PATCH /users/:id/reset-password
Authorization: Bearer <token>
```

Sets the `needs_password_reset` flag and overwrites the user's password with a
freshly generated temporary password (9+ chars, 1+ uppercase, 1+ digit). The
app has no email capability, so the temp password is returned in the response
**once** — the admin must relay it to the user out of band:

```json
{
  "message": "User will be required to reset password on next login",
  "temp_password": "Xk4mQ7pR9fZs",
  "user": {
    "id": "...",
    "email": "...",
    "username": "...",
    "needs_password_reset": true
  }
}
```

The user logs in with the temp password (normal password validation still
applies — the flag never bypasses it, see `CYBER-REVIEW.md` VULN-01), gets
redirected to the reset page, and must submit the temp password as
`current_password` on `PATCH /auth/reset-password` (above) along with their
new password.

---

### Delete User
```http
DELETE /users/:id
Authorization: Bearer <token>
```

Permanently deletes the user account. Returns `403` if the caller is deleting themselves or the last admin.

---

## Flightoid App (Admin)

Lets admins publish Flightoid (the companion Android app) APK builds and control which users can see/download them. Viewing and downloading requires either `is_admin` or an explicit access grant (see below); granting/revoking/uploading/deleting requires `is_admin`.

### List APK Releases
```http
GET /apk-releases
Authorization: Bearer <token>
```

Returns all releases, newest first. `403` if the caller is neither an admin nor an explicitly-authorized user.

Response:
```json
[
  {
    "id": "uuid",
    "version_label": "1.4.2",
    "release_notes": "Fixes GPS drift on landing",
    "original_filename": "flightoid-1.4.2.apk",
    "file_size": 24117248,
    "uploaded_by": "admin",
    "created_at": "2026-07-01T10:00:00.000Z"
  }
]
```

---

### Upload APK Release
```http
POST /apk-releases
Authorization: Bearer <token>
Content-Type: multipart/form-data

file:           <File> (.apk, max 300MB)
version_label:  1.4.2
release_notes:  Optional notes (optional)
```

Admin only. The version label is free text chosen by the admin (not parsed from the APK).

---

### Delete APK Release
```http
DELETE /apk-releases/:id
Authorization: Bearer <token>
```

Admin only. Removes the database record and the file from disk.

---

### Get Download Token
```http
GET /apk-releases/:id/token
Authorization: Bearer <token>
```

Returns a short-lived (5 minute), release-specific token for `GET /apk-releases/:id/file`, mirroring the `/media/:id/token` pattern.

Response:
```json
{ "token": "...", "expiresIn": "5m", "releaseId": "uuid" }
```

---

### Download APK File
```http
GET /apk-releases/:id/file?token=<token>
```

Streams the APK with `Content-Type: application/vnd.android.package-archive` and `Content-Disposition: attachment`. Requires the token from the endpoint above (not a bearer token).

---

### List Access
```http
GET /apk-releases/access
Authorization: Bearer <token>
```

Admin only. Every user with their current `has_apk_access` flag, for the "Current Users" access-toggle UI.

---

### Grant / Revoke Access
```http
POST /apk-releases/access/:userId
DELETE /apk-releases/access/:userId
Authorization: Bearer <token>
```

Admin only.

---

## Equipment

Equipment comes in **four categories — paramotors, engines, wings, and
reserves** — all private to the authenticated user. All endpoints require
`Authorization: Bearer <token>`.

Relationships (all owned by the paramotor):

- **Paramotor → Engine**: 0..1. The paramotor also owns `tank_size_litres`.
- **Paramotor → Wings**: many, via link objects. Each paramotor↔wing pairing
  carries its own `fuel_burn_lph` (burn rate depends on the combination).
- **Paramotor → Reserve**: 0..1.

**Hours:** every component accrues `total_hours` automatically from
non-deleted logbook entries. Wings and paramotors are summed from entries
that reference them directly (`wing_id` / `paramotor_id`); an engine or
reserve's `total_hours` is the aggregate of all paramotors *currently*
linked to it (history-free — re-pointing a paramotor moves its hours to the
new engine/reserve). `base_hours` is a manual pre-history offset and is not
included in `total_hours`; clients sum the two for display.

**Maintenance records:** engines have *service records*, wings and reserves
have *inspection records*, and reserves additionally have *pack records*.
Records live under their parent (`404` if the parent isn't yours) and are
deleted with it.

**Optimistic concurrency (new in 2.1):** `PUT /equipment/{engines,wings,reserves,paramotors}/:id`
accepts an optional `updated_at` field — pass back exactly the `updated_at`
you last fetched for this record. If the record has since been changed by
someone else, the value you're holding won't match the server's current one
and the request is rejected with `409 Conflict`:
```json
{
  "statusCode": 409,
  "message": "This record was modified since you last fetched it. Refresh and try again.",
  "current": { "id": "uuid", "...": "current server state" }
}
```
Refetch, reconcile, and retry with the fresh `updated_at`. Omitting the
field skips the check entirely — the update applies unconditionally, same
as before 2.1 — so existing clients don't need to change anything to keep
working.

This exists specifically for **paramotors**, whose `engine_id`/`reserve_id`
FK fields are easy to clobber from a client that pushes a whole locally
cached snapshot on every save (rather than only the field it actually
changed): if that snapshot is stale on just one field, submitting it can
silently overwrite a change made from elsewhere (e.g. the web app) to a
*different* field on the same paramotor. Clients that maintain a local copy
of paramotor equipment should send `updated_at` and treat `409` as "someone
else changed this — reload before saving," rather than pushing whole-record
writes from a cache that might not reflect the very field it isn't touching.

### List Engines
```http
GET /equipment/engines
Authorization: Bearer <token>
```

Response:
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Vittorazi Moster 185",
    "base_hours": 12.5,
    "total_hours": 34.2,
    "notes": null,
    "created_at": "2026-01-15T10:00:00.000Z",
    "updated_at": "2026-01-15T10:00:00.000Z"
  }
]
```

> **Changed in 2.0:** `tank_size_litres` and `fuel_consumption_lph` were
> removed from engines. Tank size is on the paramotor; burn rate is on each
> paramotor↔wing link. Sending either field to an engine endpoint returns
> `400`.

---

### Create Engine
```http
POST /equipment/engines
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Vittorazi Moster 185",
  "base_hours": 12.5,
  "notes": "Optional notes"
}
```

---

### Get Engine
```http
GET /equipment/engines/:id
Authorization: Bearer <token>
```

---

### Update Engine
```http
PUT /equipment/engines/:id
Authorization: Bearer <token>
Content-Type: application/json

{ "name": "Vittorazi Moster 185 Plus" }
```

---

### Delete Engine
```http
DELETE /equipment/engines/:id
Authorization: Bearer <token>
```

Response: `{ "message": "Engine deleted" }`

Paramotors linked to the engine keep working (`engine_id` becomes `null`);
the engine's service records are deleted with it.

---

### Engine Service Records

```http
GET    /equipment/engines/:id/services
POST   /equipment/engines/:id/services
PUT    /equipment/engines/:id/services/:recordId
DELETE /equipment/engines/:id/services/:recordId
Authorization: Bearer <token>
```

Create/update body:
```json
{
  "service_date": "2026-06-01",
  "service_type": "Top-end rebuild",
  "notes": "Optional notes"
}
```

Response (list is ordered by `service_date` descending):
```json
[
  {
    "id": "uuid",
    "engine_id": "uuid",
    "service_date": "2026-06-01",
    "service_type": "Top-end rebuild",
    "notes": null,
    "created_at": "2026-06-01T10:00:00.000Z",
    "updated_at": "2026-06-01T10:00:00.000Z"
  }
]
```

`DELETE` responds `{ "message": "Service record deleted" }`.

---

### List Wings
```http
GET /equipment/wings
Authorization: Bearer <token>
```

Response:
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "My Main Wing",
    "manufacturer": "Ozone",
    "model": "Spyder 3",
    "size": "26m²",
    "trim_speed_kmh": 38,
    "color": "red/white",
    "base_hours": 0,
    "total_hours": 21.7,
    "notes": null,
    "created_at": "2026-01-15T10:00:00.000Z",
    "updated_at": "2026-01-15T10:00:00.000Z"
  }
]
```

`color` (new in 2.0) is free text — list multiple colours however you like,
e.g. `"red/white/blue"`.

---

### Create Wing
```http
POST /equipment/wings
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Main Wing",
  "manufacturer": "Ozone",
  "model": "Spyder 3",
  "size": "26m²",
  "trim_speed_kmh": 38,
  "color": "red/white",
  "notes": "Optional notes"
}
```

---

### Get Wing
```http
GET /equipment/wings/:id
Authorization: Bearer <token>
```

---

### Update Wing
```http
PUT /equipment/wings/:id
Authorization: Bearer <token>
Content-Type: application/json

{ "size": "28m²" }
```

---

### Delete Wing
```http
DELETE /equipment/wings/:id
Authorization: Bearer <token>
```

Response: `{ "message": "Wing deleted" }`

Deleting a wing also removes its paramotor links and inspection records;
logbook entries referencing it keep their text `wing` but lose the `wing_id`
link.

---

### Wing Inspection Records

```http
GET    /equipment/wings/:id/inspections
POST   /equipment/wings/:id/inspections
PUT    /equipment/wings/:id/inspections/:recordId
DELETE /equipment/wings/:id/inspections/:recordId
Authorization: Bearer <token>
```

Create/update body:
```json
{
  "inspection_date": "2026-05-15",
  "inspection_type": "Annual trim check",
  "notes": "Optional notes"
}
```

Responses mirror engine service records (`inspection_date` /
`inspection_type` fields, list ordered by date descending). `DELETE`
responds `{ "message": "Inspection record deleted" }`.

---

### List Reserves
```http
GET /equipment/reserves
Authorization: Bearer <token>
```

Response:
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "My Reserve",
    "manufacturer": "Gin",
    "model": "Yeti Cross",
    "size": "37m²",
    "base_hours": 0,
    "total_hours": 21.7,
    "notes": null,
    "created_at": "2026-01-15T10:00:00.000Z",
    "updated_at": "2026-01-15T10:00:00.000Z"
  }
]
```

---

### Create Reserve
```http
POST /equipment/reserves
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Reserve",
  "manufacturer": "Gin",
  "model": "Yeti Cross",
  "size": "37m²",
  "notes": "Optional notes"
}
```

---

### Get Reserve
```http
GET /equipment/reserves/:id
Authorization: Bearer <token>
```

---

### Update Reserve
```http
PUT /equipment/reserves/:id
Authorization: Bearer <token>
Content-Type: application/json

{ "name": "My Reserve (repacked)" }
```

---

### Delete Reserve
```http
DELETE /equipment/reserves/:id
Authorization: Bearer <token>
```

Response: `{ "message": "Reserve deleted" }`

Paramotors linked to the reserve keep working (`reserve_id` becomes
`null`); the reserve's pack and inspection records are deleted with it.

---

### Reserve Pack Records

```http
GET    /equipment/reserves/:id/packs
POST   /equipment/reserves/:id/packs
PUT    /equipment/reserves/:id/packs/:recordId
DELETE /equipment/reserves/:id/packs/:recordId
Authorization: Bearer <token>
```

Create/update body:
```json
{
  "pack_date": "2026-04-01",
  "notes": "Optional notes"
}
```

List is ordered by `pack_date` descending. `DELETE` responds
`{ "message": "Pack record deleted" }`.

---

### Reserve Inspection Records

```http
GET    /equipment/reserves/:id/inspections
POST   /equipment/reserves/:id/inspections
PUT    /equipment/reserves/:id/inspections/:recordId
DELETE /equipment/reserves/:id/inspections/:recordId
Authorization: Bearer <token>
```

Create/update body:
```json
{
  "inspection_date": "2026-04-01",
  "inspection_type": "Repack inspection",
  "notes": "Optional notes"
}
```

List is ordered by `inspection_date` descending. `DELETE` responds
`{ "message": "Inspection record deleted" }`.

---

### List Paramotors
```http
GET /equipment/paramotors
Authorization: Bearer <token>
```

Response includes the nested `engine` and `reserve` objects when linked, and
a `wing_links` array (one entry per linked wing, each with the pairing's own
`fuel_burn_lph` and the nested `wing`):
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "My Paramotor",
    "engine_id": "uuid",
    "reserve_id": "uuid",
    "tank_size_litres": 10,
    "base_hours": 0,
    "total_hours": 34.2,
    "engine": {
      "id": "uuid",
      "name": "Vittorazi Moster 185"
    },
    "reserve": {
      "id": "uuid",
      "name": "My Reserve"
    },
    "wing_links": [
      {
        "id": "uuid",
        "paramotor_id": "uuid",
        "wing_id": "uuid",
        "fuel_burn_lph": 3.5,
        "wing": {
          "id": "uuid",
          "name": "My Main Wing",
          "color": "red/white"
        }
      }
    ],
    "notes": null,
    "created_at": "2026-01-15T10:00:00.000Z",
    "updated_at": "2026-01-15T10:00:00.000Z"
  }
]
```

---

### Create Paramotor
```http
POST /equipment/paramotors
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Paramotor",
  "engine_id": "uuid",
  "reserve_id": "uuid",
  "tank_size_litres": 10,
  "wings": [
    { "wing_id": "uuid", "fuel_burn_lph": 3.5 },
    { "wing_id": "uuid", "fuel_burn_lph": 4.2 }
  ],
  "notes": "Optional notes"
}
```

- `engine_id`, `reserve_id`, `tank_size_litres`, and `wings` are all
  optional.
- Every referenced engine/reserve/wing must belong to you (`404` otherwise);
  a duplicate `wing_id` in `wings` returns `400`.
- `fuel_burn_lph` is optional per wing link.

---

### Get Paramotor
```http
GET /equipment/paramotors/:id
Authorization: Bearer <token>
```

---

### Update Paramotor
```http
PUT /equipment/paramotors/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "engine_id": "uuid",
  "wings": [{ "wing_id": "uuid", "fuel_burn_lph": 3.8 }]
}
```

- `engine_id: null` / `reserve_id: null` clears the link.
- `wings` uses **replace semantics**: omit the field to leave links
  untouched, send `[]` to remove all links, or send the complete new set to
  replace them.
- Re-pointing `engine_id`/`reserve_id` immediately recomputes hours on both
  the old and new engine/reserve.
- Pass `updated_at` (see [Optimistic concurrency](#equipment) above) to guard
  against overwriting a concurrent change to a field you aren't touching —
  strongly recommended for any client that caches a local copy of the
  paramotor and pushes it back selectively field-by-field.

---

### Delete Paramotor
```http
DELETE /equipment/paramotors/:id
Authorization: Bearer <token>
```

Response: `{ "message": "Paramotor deleted" }`

Wing links are removed with the paramotor and hours on the linked engine and
reserve are recomputed; logbook entries lose their `paramotor_id` link.

---

## Sites

### List Sites
```http
GET /sites
Authorization: Bearer <token>
```

Returns all flight sites (visible to all authenticated users — site/weather data is shared, not private per pilot).

---

### Create Site
```http
POST /sites
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Mountain Ridge",
  "takeoffLat": 52.3555,
  "takeoffLon": -1.1743,
  "parkingLat": 52.3550,
  "parkingLon": -1.1750,
  "takeoffNotes": "Launch from the grassy shelf, avoid the trees on the left",
  "parkingNotes": "Park in the layby, not the farmer's field",
  "country": "United Kingdom"
}
```

---

### Get Site
```http
GET /sites/:id
Authorization: Bearer <token>
```

---

### Update Site
```http
PUT /sites/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Mountain Ridge (West)",
  "takeoffLat": 52.3555,
  "takeoffLon": -1.1743
}
```

---

### Delete Site
```http
DELETE /sites/:id
Authorization: Bearer <token>
```

> Admin only.

---

### Toggle Site Active Status
```http
PATCH /sites/:id/toggle
Authorization: Bearer <token>
```

> Admin only.

---

### Find Nearby Sites
```http
GET /sites/near?lat=52.3555&lon=-1.1743&radius=1000
Authorization: Bearer <token>
```

Returns sites whose takeoff point is within `radius` metres of the given coordinates. Default radius is 1000 m.

---

### Reverse Geocode
```http
GET /sites/geocode/reverse?lat=52.3555&lon=-1.1743
Authorization: Bearer <token>
```

Returns the nearest address for the given coordinates.

---

## Weather

### Get Site Forecast (3-Day)
```http
GET /sites/:siteId/forecast
Authorization: Bearer <token>
```

Returns 3-day hourly forecasts including wind speed, gust speed, rain, temperature, and safety scores per hour.

---

### Get Forecast for a Specific Date
```http
GET /sites/:siteId/forecast/:date
Authorization: Bearer <token>
```

`date` format: `YYYY-MM-DD`

---

### Get Multi-Height Wind Data
```http
GET /sites/:siteId/forecast/:date/multi-height
Authorization: Bearer <token>
```

Returns wind data at multiple altitude levels for a specific date. Useful for flight planning.

---

### Trigger Manual Weather Update
```http
POST /weather/fetch
Authorization: Bearer <token>
```

> Admin only. Fetches fresh weather for all enabled sites.

---

### Get Weather API Stats
```http
GET /weather/stats
Authorization: Bearer <token>
```

> Admin only. Returns API call usage statistics.

---

### Reset Weather API Stats
```http
DELETE /weather/stats
Authorization: Bearer <token>
```

> Admin only.

---

### Weather SSE Stream
```http
GET /weather/events
Authorization: Bearer <token>
```

Server-Sent Events stream that pushes real-time weather update notifications.

> **Mobile Note:** SSE requires an HTTP client that supports streaming. Alternatively, poll `GET /sites/:siteId/forecast` as needed.

---

## Missions

Missions are visible to every authenticated user. Editing and deleting a mission (including its waypoints) is restricted to the mission's creator and administrators — those endpoints return `403` for anyone else. Missions without a creator (created before ownership tracking) are editable by everyone.

### List Missions
```http
GET /missions
Authorization: Bearer <token>
```

Returns all missions, regardless of creator.

Optional query params:
| Param | Description |
|-------|-------------|
| `search` | Filter by name (partial match) |
| `launchSiteId` | Filter by launch site UUID |
| `sort` | `updated_at` \| `name` \| `created_at` |
| `order` | `ASC` \| `DESC` |

---

### Create Mission
```http
POST /missions
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Ridge Run",
  "notes": "Standard ridge route, turn at the quarry",
  "launch_site_id": "uuid",
  "avg_fuel_consumption": 12.5,
  "fuel_tank_size": 20,
  "avg_speed": 45,
  "wind_direction": 270,
  "wind_speed": 15
}
```

---

### Get Mission
```http
GET /missions/:id
Authorization: Bearer <token>
```

---

### Update Mission
```http
PUT /missions/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Ridge Run Extended",
  "wind_speed": 18
}
```

> Creator or admin only — returns `403` otherwise.

---

### Delete Mission
```http
DELETE /missions/:id
Authorization: Bearer <token>
```

> Creator or admin only — returns `403` otherwise. Returns `204 No Content`.

---

### Duplicate Mission
```http
POST /missions/:id/duplicate
Authorization: Bearer <token>
```

Creates a copy of the mission including all waypoints.

---

### Get Waypoints
```http
GET /missions/:id/waypoints
Authorization: Bearer <token>
```

Returns waypoints ordered by `sort_order`.

---

### Add Waypoint
```http
POST /missions/:id/waypoints
Authorization: Bearer <token>
Content-Type: application/json

{
  "latitude": 52.3600,
  "longitude": -1.1800,
  "altitude": 450,
  "planned_speed": 45,
  "leg_minutes": 8
}
```

---

### Update Waypoint
```http
PUT /missions/:id/waypoints/:waypointId
Authorization: Bearer <token>
Content-Type: application/json

{
  "altitude": 480,
  "planned_speed": 50
}
```

---

### Delete Waypoint
```http
DELETE /missions/:id/waypoints/:waypointId
Authorization: Bearer <token>
```

> Returns `204 No Content`.

---

### Reorder Waypoints
```http
POST /missions/:id/waypoints/reorder
Authorization: Bearer <token>
Content-Type: application/json

{
  "waypoint_ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

Pass all waypoint IDs in the desired order.

---

## Pilots

### List Pilots
```http
GET /pilots
Authorization: Bearer <token>
```

Response:
```json
[
  {
    "id": "uuid",
    "display_name": "Alice",
    "slug": "alice",
    "avatar_url": "https://...",
    "user_id": "uuid",
    "created_at": "2026-01-15T10:00:00.000Z",
    "updated_at": "2026-01-15T10:00:00.000Z"
  }
]
```

---

### Get Pilot
```http
GET /pilots/:id
Authorization: Bearer <token>
```

---

### Get Pilot Performance
```http
GET /pilots/:id/performance
Authorization: Bearer <token>
```

Returns recent flights, score trend over time, personal bests per category, and 30-day rolling average score.

---

### Create Pilot
```http
POST /pilots
Authorization: Bearer <token>
Content-Type: application/json

{
  "display_name": "Alice",
  "slug": "alice",
  "avatar_url": "https://...",
  "user_id": "uuid"
}
```

> Admin only — returns `403` if the requesting user is not an administrator.

`slug` is auto-generated from `display_name` if omitted.

---

### Update Pilot
```http
PATCH /pilots/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "display_name": "Alice B.",
  "avatar_url": "https://..."
}
```

> Own pilot or admin only — returns `403` if the requesting user does not own this pilot profile and is not an administrator.

---

### Delete Pilot
```http
DELETE /pilots/:id
Authorization: Bearer <token>
```

> Own pilot or admin only — returns `403` if the requesting user does not own this pilot profile and is not an administrator.

---

### Update My Position *(Live Tracking)*
```http
PUT /pilots/me/position
Authorization: Bearer <token>
Content-Type: application/json

{
  "lat": 51.5074,
  "lon": -0.1278,
  "altitude_m": 320.5,
  "state": "Flying"
}
```

`state` must be `"Flying"` or `"Landed"`. `altitude_m` (metres, optional) is stored per update — omitting it clears the previously reported altitude, so it never goes stale.

> **flightnow / FlightTV:** `altitude_m` exists since API version **1.3**. Rather than probing responses for the field, gate altitude features on the `X-API-Version` response header: enabled when MAJOR ≥ `2`, or when MAJOR is `1` and MINOR ≥ `3`. This gate applies to **sending** the field too, not just rendering the marker altitude badge — the server rejects unknown body fields, so a pre-1.3 server responds `400 Bad Request` to a body containing `altitude_m`.

Called by a flying pilot's app to push their current position. Call repeatedly while airborne (e.g. every 10–30 seconds). Set `state` to `"Landed"` on touchdown.

Response:
```json
{
  "message": "Position updated",
  "updated_at": "2026-06-16T14:30:00.000Z"
}
```

---

### Get All Pilot Positions *(Live Tracking)*
```http
GET /pilots/positions
Authorization: Bearer <token>
```

Returns all pilots that have reported a position, plus any nearby aircraft detected via OpenSky Network. Poll this endpoint to show live positions on a map.

Aircraft are sourced from the [OpenSky Network](https://opensky-network.org/) and queried on each pilot position update, subject to a 10-second minimum interval between API calls. `aircraft.updated_at` is the ISO timestamp of the last successful OpenSky response (`null` if no query has succeeded yet). When position updates arrive faster than the 10-second window, the cached positions from the previous query are returned — use `updated_at` to decide whether the data is still relevant. `aircraft.positions` is empty when no pilots are actively flying. The airspace query radius is controlled by the `opensky.airspace_radius_km` setting (default 10 km, i.e. a 20 km diameter circle around each flying pilot). Each aircraft entry carries `altitude_m` (metres; barometric altitude, falling back to geometric altitude when the barometric value is unavailable — `null` only when OpenSky reports neither).

Response:
```json
{
  "pilots": [
    {
      "pilot_id": "uuid",
      "display_name": "Alice",
      "lat": 51.5074,
      "lon": -0.1278,
      "altitude_m": 320.5,
      "state": "Flying",
      "updated_at": "2026-06-16T14:30:00.000Z"
    },
    {
      "pilot_id": "uuid",
      "display_name": "Bob",
      "lat": 51.5100,
      "lon": -0.1300,
      "altitude_m": null,
      "state": "Landed",
      "updated_at": "2026-06-16T14:25:00.000Z"
    }
  ],
  "aircraft": {
    "updated_at": "2026-06-18T12:45:39.000Z",
    "positions": [
      {
        "icao24": "3c6444",
        "callsign": "DLH123",
        "lat": 51.5090,
        "lon": -0.1290,
        "altitude_m": 1200.5,
        "on_ground": false,
        "velocity_mps": 85.3,
        "heading_deg": 270.0,
        "vertical_rate_mps": -2.5,
        "last_contact": 1750000000
      }
    ]
  }
}
```

**`aircraft` object:**

| Field | Type | Description |
|---|---|---|
| `updated_at` | string \| null | ISO 8601 timestamp of the last successful OpenSky response. `null` if no query has succeeded yet (e.g. fresh boot or active 429 backoff). |
| `positions` | array | Aircraft state vectors from the last successful query. Empty when no pilots are actively flying or no aircraft were found in range. |

**`aircraft.positions` item fields:**

| Field | Type | Description |
|---|---|---|
| `icao24` | string | ICAO 24-bit transponder address |
| `callsign` | string \| null | Aircraft callsign (trimmed), or `null` if not broadcasting |
| `lat` | number | Latitude (WGS84) |
| `lon` | number | Longitude (WGS84) |
| `altitude_m` | number \| null | Barometric altitude in metres |
| `on_ground` | boolean | Whether the aircraft is on the ground |
| `velocity_mps` | number \| null | Ground speed in m/s |
| `heading_deg` | number \| null | True track in degrees clockwise from north |
| `vertical_rate_mps` | number \| null | Vertical rate in m/s (positive = climbing) |
| `last_contact` | number | Unix timestamp of last transponder message |

---

## Flights

**Changed:** flights are shared/viewable across all pilots, like Media —
any authenticated user can list, view, download, compare, and analyze any
flight. Only the uploader or an admin can edit metadata, delete, or trigger
re-analysis (a mutation) — those return `403` otherwise.

### List Flights by Date
```http
GET /flights?date=2026-01-15
Authorization: Bearer <token>
```

Returns every flight for that date, from all pilots.

---

### Upload Flight (GPX)
```http
POST /flights
Authorization: Bearer <token>
Content-Type: multipart/form-data

file:         <GPX file>
flight_date:  2026-01-15
pilot_id:     uuid (optional — defaults to your linked pilot; must be your own pilot unless you are an admin: `403` otherwise, `400` if the pilot does not exist)
site_id:      uuid (optional)
client_id:    uuid (optional — flightnow Flight.id, links the upload to a logbook entry)
takeoff_lat:  52.3555 (optional)
takeoff_lon:  -1.1743 (optional)
title:        "Morning flight"  (optional)
notes:        "Great conditions" (optional)
glider:       "Ozone Alpina 4"  (optional)
harness:      "Advance Lightness 3" (optional)
```

The GPX is parsed and analyzed asynchronously. Poll `GET /flights/:id` until `parse_status` is `analyzed`.

---

### Compare Flights
```http
POST /flights/compare
Authorization: Bearer <token>
Content-Type: application/json

{
  "flight_ids": ["uuid-1", "uuid-2"]
}
```

Returns normalized trackpoints and stats for side-by-side comparison, for any flights (not just your own). Minimum 2, maximum 6 flights.

---

### Get Flight
```http
GET /flights/:id
Authorization: Bearer <token>
```

Viewable by any authenticated user. Response includes parsed stats: duration, distance, max altitude, speeds, climb rate, bounding box, parse and analysis status, and the full `trackpoints_json` array.

---

### Get Flight Trackpoints
```http
GET /flights/:id/trackpoints
Authorization: Bearer <token>
```

Viewable by any authenticated user. Returns only the parsed trackpoint array with minimal metadata. Intended for mobile clients syncing GPS breadcrumb data to a local logbook without downloading the full flight record.

Response:
```json
{
  "flight_id": "uuid",
  "parse_status": "analyzed",
  "timezone": "UTC",
  "trackpoints": [
    {
      "timestamp": "2026-01-15T09:23:00.000Z",
      "lat": 52.3555,
      "lon": -1.1743,
      "elevation_m": 450.0,
      "speed_mps": 12.5,
      "vertical_speed_mps": 2.1,
      "phase": "climb"
    }
  ]
}
```

`timezone` is either `"UTC"` (timestamps are true UTC — convert to local for display) or `"local"` (Gaggle wrote local clock time without a UTC offset — display the stored values directly without conversion).

`parse_status` will be `"analyzed"` when trackpoints are ready. If it is `"uploaded"` or `"parsing"`, the array will be empty — poll `GET /flights/:id` until `parse_status` is `"analyzed"` before fetching trackpoints.

---

### Stream GPX File
```http
GET /flights/:id/file
Authorization: Bearer <token>
```

Viewable by any authenticated user. Returns the raw `.gpx` file as `application/gpx+xml`.

---

### Get Flight Analysis
```http
GET /flights/:id/analysis
Authorization: Bearer <token>
```

Viewable by any authenticated user. Returns per-phase scores, events (takeoff, landing, thermals), and coaching notes.

---

### Re-run Analysis
```http
POST /flights/:id/reanalyze
Authorization: Bearer <token>
```

> Uploader or admin only — returns `403` otherwise. This is a mutation (overwrites analysis results), unlike the other Flights endpoints above.

Re-runs the flight analysis pipeline. Fire-and-forget — poll `GET /flights/:id/analysis` for results.

Response:
```json
{ "message": "Analysis started", "flightId": "uuid" }
```

---

### Update Flight Metadata
```http
PATCH /flights/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Evening flight",
  "notes": "Bumpy near the ridge",
  "glider": "Ozone Alpina 4"
}
```

> Uploader or admin only — returns `403` otherwise.

---

### Delete Flight
```http
DELETE /flights/:id
Authorization: Bearer <token>
```

> Uploader or admin only — returns `403` otherwise.

Deletes the flight record and the GPX file from disk.

---

## Logbook

All logbook endpoints are scoped to the authenticated user's pilot record. All require `Authorization: Bearer <token>`.

### List Entries
```http
GET /logbook
Authorization: Bearer <token>
```

Optional query params:
| Param | Description |
|-------|-------------|
| `from` | Start date filter `YYYY-MM-DD` |
| `to` | End date filter `YYYY-MM-DD` |

Returns an array of `LogbookEntryResponse` objects (see [Entry Response Shape](#logbook-entry-response-shape)).

---

### Get Entry
```http
GET /logbook/:id
Authorization: Bearer <token>
```

Returns a single `LogbookEntryResponse`.

---

### Create Entry (Manual / Web)
```http
POST /logbook
Authorization: Bearer <token>
Content-Type: application/json

{
  "flight_date": "2026-01-15",
  "client_id": "uuid",
  "title": "Morning flight",
  "notes": "Great conditions",
  "duration_seconds": 3600,
  "distance_m": 45000,
  "max_altitude_m": 650,
  "max_speed_mps": 14.2,
  "wing": "Ozone Alpina 4",
  "engine": "Moster 185",
  "fuel_used_litres": 8.5,
  "takeoff_lat": 52.3555,
  "takeoff_lon": -1.1743
}
```

`client_id` is optional — if provided it is used for idempotency (repeated calls with the same `client_id` return the existing entry).

---

### Update Entry
```http
PATCH /logbook/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "notes": "Updated notes",
  "rating": 4
}
```

`flight_id` (optional, one-time — only applied if the entry has no flight linked yet) attaches a GPX flight to this entry. Unlike Flights' general viewing endpoints (open to any authenticated user, matching Media's shared-browsing model), **linking is ownership-scoped**: `flight_id` must reference a flight uploaded by the same user — `403` otherwise. This is the only place flight ownership is still enforced for GPX flights; a pilot's logbook can only ever reference their own uploads.

`mission_id` (optional) links this entry to a mission (see [Missions](#missions)) — the web UI offers this picker when `category` is `"Mission"`. Missions are shared fleet-wide, not per-pilot, so no ownership check is applied; any existing mission ID is accepted. Send `null` to clear it.

---

### Delete Entry (Soft Delete)
```http
DELETE /logbook/:id
Authorization: Bearer <token>
```

Sets `deleted_at` on the entry. The entry is still returned by sync endpoints so clients can tombstone their local copy.

---

### Download PDF Logbook
```http
GET /logbook/pdf
Authorization: Bearer <token>
```

Optional `from` / `to` query params (`YYYY-MM-DD`) to limit the date range. Returns a PDF file (`application/pdf`).

---

### Baseline (Record 0)

The baseline stores flight totals accumulated before the pilot started using this app.

```http
GET /logbook/baseline
Authorization: Bearer <token>
```

Response:
```json
{
  "prior_flights": 142,
  "prior_duration_seconds": 511200,
  "prior_distance_m": 4200000,
  "notes": "Total from old paper logbook",
  "updated_at": "2026-01-15T10:00:00.000Z"
}
```

Returns `null` if no baseline has been set.

```http
PUT /logbook/baseline
Authorization: Bearer <token>
Content-Type: application/json

{
  "prior_flights": 142,
  "prior_duration_seconds": 511200,
  "prior_distance_m": 4200000,
  "notes": "Total from old paper logbook"
}
```

---

### Orphaned Flights

Flights that were uploaded via GPX but have no linked logbook entry. Scoped to flights **uploaded by the requesting user only** — this is a logbook-linking helper, not a browse-everyone's-flights endpoint (see the note on `flight_id` in [Update Entry](#update-entry) above for why GPX linking stays private per pilot even though Flights' general viewing endpoints are shared).

```http
GET /logbook/orphaned-flights
Authorization: Bearer <token>
```

Returns an array of `Flight` records, all uploaded by the requesting user.

```http
POST /logbook/orphaned-flights/:flightId/import
Authorization: Bearer <token>
```

Creates a logbook entry linked to the given flight and returns the new `LogbookEntry`. `403` if the flight wasn't uploaded by the requesting user.

---

### Duplicate Merging

Web GPX upload and flightnow mobile sync are two independent ingestion paths that don't know about each other, so the same real flight can land as two separate logbook entries — one carrying the GPX track (uploaded via Media Calendar, `source: "web"`), one carrying location/equipment/category from the phone (`source: "flightnow"`, no GPX). The server automatically detects and merges these when a new entry appears and matches an existing one on the same pilot + date + overlapping time window + nearby launch point + corroborating duration/distance/altitude. This is fully automatic — no client action is required, and it happens transparently as part of `POST /logbook/sync` and after a GPX upload's analysis completes.

The merged entry always keeps the **flightnow-origin `client_id`** (never the web-generated one), since that's the id mobile clients use to reconcile — this is why mobile syncing continues to work correctly across a merge. If a match is found but the two sides disagree on `flight_number_override`, `wing_id`, or `paramotor_id`, the merge is skipped and both entries are flagged (`merge_flagged_at`/`merge_flagged_reason` in the DB) rather than guessing which value is correct.

```http
POST /logbook/admin/merge-duplicates?dryRun=true
Authorization: Bearer <token>
```

Admin only. Re-scans **all pilots'** entries for unmerged duplicate pairs and merges any it finds — safe to re-run at any time (a successful merge removes both rows from future consideration, so nothing is ever double-merged). Pass `dryRun=true` to see what would happen without writing anything. Response:

```json
{
  "merged": 3,
  "flaggedConflicts": 0,
  "flaggedAmbiguous": 0,
  "noCandidateCount": 12,
  "details": [
    { "flightnowEntryId": "uuid", "webEntryId": "uuid", "outcome": "merged" }
  ]
}
```

---

## Logbook Sync (Mobile)

The sync protocol lets mobile clients push local changes and pull server changes in a single round-trip each way. All sync endpoints are scoped to the authenticated pilot.

### Pull (incremental)
```http
GET /logbook/sync?since=2026-01-14T12:00:00.000Z
Authorization: Bearer <token>
```

Returns all entries (including soft-deleted ones) whose `updated_at` is after `since`. Omit `since` for a full initial sync.

Response:
```json
{
  "server_time": "2026-01-15T10:00:00.000Z",
  "entries": [ ]
}
```

Save `server_time` and use it as `since` on the next pull.

Each entry in `entries` is a `LogbookEntryResponse` (see [Entry Response Shape](#logbook-entry-response-shape)). Entries with a non-null `deleted_at` should be tombstoned locally.

---

### Push (batch upsert)
```http
POST /logbook/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "entries": [
    {
      "client_id": "uuid",
      "flight_date": "2026-01-15",
      "client_updated_at": "2026-01-15T09:45:00.000Z",
      "duration_seconds": 3600,
      "distance_m": 45000,
      "wing": "Ozone Alpina 4"
    }
  ],
  "deletes": [
    {
      "client_id": "uuid",
      "deleted_at": "2026-01-15T09:50:00.000Z"
    }
  ]
}
```

Uses last-write-wins conflict resolution based on `client_updated_at`. The server returns the authoritative state for each pushed entry — always apply the `server` value to the local record.

**Equipment linking (changed in 2.0):** when a pushed entry carries
`equipment_refs_json` (`{ "paramotorId": "...", "engineId": "...", "wingId": "..." }`),
the server now resolves `wingId`/`paramotorId` against the user's server-side
equipment: if an ID matches a wing/paramotor owned by the user, the entry's
`wing_id`/`paramotor_id` FK is set and equipment hours accrue automatically
(engine and reserve hours roll up through the linked paramotor — see
[Equipment](#equipment)). Resolution is best-effort: IDs that don't match
server equipment are ignored (never a sync error), and an unresolvable ID
never clears an existing link. The raw `equipment_refs_json` is still stored
and returned verbatim either way.

Response:
```json
{
  "server_time": "2026-01-15T10:00:00.000Z",
  "results": [
    {
      "client_id": "uuid",
      "id": "uuid",
      "status": "created",
      "revision": 1,
      "server": { }
    }
  ]
}
```

`status` is one of `created`, `updated`, `unchanged`, or `deleted`.

---

### Logbook Entry Response Shape

```json
{
  "id": "uuid",
  "pilot_id": "uuid",
  "client_id": "uuid",
  "source": "flightnow",
  "flight_date": "2026-01-15",
  "start_at": "2026-01-15T09:23:00.000Z",
  "end_at": "2026-01-15T10:23:00.000Z",
  "duration_seconds": 3600,
  "distance_m": 45000,
  "max_altitude_m": 650,
  "max_speed_mps": 14.2,
  "max_climb_mps": 3.1,
  "wing": "Ozone Alpina 4",
  "engine": "Moster 185",
  "fuel_used_litres": 8.5,
  "takeoff_lat": 52.3555,
  "takeoff_lon": -1.1743,
  "flight_number": 143,
  "flight_number_override": null,
  "revision": 2,
  "client_updated_at": "2026-01-15T09:45:00.000Z",
  "deleted_at": null,
  "created_at": "2026-01-15T10:00:00.000Z",
  "updated_at": "2026-01-15T10:01:00.000Z",
  "analyzed_duration_seconds": 3612,
  "analyzed_distance_m": 45320,
  "analyzed_max_altitude_m": 658,
  "analyzed_max_speed_mps": 14.8,
  "gpx": {
    "flight_id": "uuid",
    "gpx_url": "/flights/{flight_id}/file",
    "parse_status": "analyzed",
    "analysis_status": "complete",
    "bbox_json": { "minLon": -1.18, "minLat": 52.34, "maxLon": -1.16, "maxLat": 52.37 }
  },
  "media": []
}
```

When `gpx` is non-null the entry has a server-side GPX flight linked to it. The `analyzed_*` fields carry the server's parsed values and should be preferred over the raw client-entered fields for display.

**Fetching GPS breadcrumbs from a linked flight:**

If `gpx` is non-null and `gpx.parse_status` is `"analyzed"`, fetch the parsed trackpoint array for local storage:

```http
GET /flights/{gpx.flight_id}/trackpoints
Authorization: Bearer <token>
```

See [Get Flight Trackpoints](#get-flight-trackpoints) for the response shape and `timezone` handling. To download the original GPX file instead, use `gpx.gpx_url` with a `Bearer` token header.

---

## Leaderboards

### Get Leaderboard
```http
GET /leaderboards
Authorization: Bearer <token>
```

Query params:
| Param | Values | Default |
|-------|--------|---------|
| `category` | `overall` \| `takeoff` \| `climb` \| `level` \| `turn` \| `descent` \| `landing` \| `smoothness` \| `safety` \| `most_improved` | `overall` |
| `period` | `alltime` \| `30d` \| `season` | `alltime` |
| `site_id` | UUID of a flight site | *(all sites)* |

---

## Media

> The FlightTV tvOS app (a read-only media browser) consumes this module. `GET /media/browse`, `GET /media/filters`, `GET /media/home`, `GET /media/:id/related`, `GET /media/:id/flight`, `GET /media/:id/flight/trackpoints`, `GET /media/batch`, `PATCH /media/:id/favorite` and `PATCH /media/:id/rating` were added for it, but are general-purpose and usable by any client. The older `GET /media` (date/site) and `GET /media/search` (filter-only) endpoints are unchanged for backward compatibility with the existing web frontend.

### Upload Media
```http
POST /media
Authorization: Bearer <token>
Content-Type: multipart/form-data

file:         <File>
flight_date:  2026-01-15
pilots:       ["Alice", "Bob"]
notes:        Optional notes
title:        Optional title (optional)
description:  Optional description (optional)
tags:         ["sunset", "coastal"] (optional)
aircraft:     Optional aircraft name (optional)
wing:         Optional wing name (optional)
engine:       Optional engine name (optional)
site_id:      uuid (optional)
mission_id:   uuid (optional)
flight_id:    uuid (optional) — links this media to a parsed GPX flight
```

Image dimensions (`image_width`/`image_height`) and video dimensions/duration (`video_width`/`video_height`/`duration_seconds`) are extracted automatically on upload via `sharp`/`ffprobe` — no need to send them.

---

### Browse Media (paginated, filterable, sortable)
```http
GET /media/browse
Authorization: Bearer <token>
```

The general-purpose media library endpoint. Combines free-text search, every filter, and sorting, with real pagination — this is what FlightTV's Library, Search, and Filters screens call.

Query params (all optional):

| Param | Type | Notes |
|---|---|---|
| `page` | number | Default `1` |
| `pageSize` | number | Default `50`, max `200` |
| `q` | string | Free-text match across title, description, notes, filename, pilots, tags, aircraft, wing, engine, site name |
| `pilots` | comma-separated | Matches any of the given pilot names |
| `site_id` | uuid | |
| `country` | string | Matches the linked site's country |
| `year` / `month` | number | Filters on `flight_date` |
| `flight_date_from` / `flight_date_to` | date | Inclusive range on `flight_date` |
| `uploaded_from` / `uploaded_to` | date | Inclusive range on `created_at` |
| `aircraft` / `wings` / `engines` | comma-separated | Matches any of the given values |
| `tags` | comma-separated | Matches any of the given tags |
| `type` | `image` \| `video` | |
| `favorite` | `true` \| `false` | |
| `gps_track_available` | `true` \| `false` | Whether the item is linked to a parsed flight (`flight_id`) |
| `min_rating` | number `0`-`5` | |
| `sort` | see below | Default `newest` |

Sort options: `newest`, `oldest`, `recently_uploaded`, `highest_rated`, `longest`, `shortest`, `pilot`, `location`, `alphabetical`.

Example:
```http
GET /media/browse?pilots=Mike&year=2026&type=video&sort=highest_rated&page=1&pageSize=50
GET /media/browse?q=belgrave
```

Response:
```json
{
  "items": [ { "id": "uuid", "title": "...", "media_type": "video", "...": "..." } ],
  "page": 1,
  "pageSize": 50,
  "total": 4213,
  "hasMore": true
}
```

---

### Get Media Filter Options
```http
GET /media/filters
Authorization: Bearer <token>
```

Consolidated lists for building a filter panel in a single round trip — avoids six separate calls on a 10-foot UI.

Response:
```json
{
  "pilots": ["Alice", "Bob"],
  "aircraft": ["Paramotor A"],
  "wings": ["Wing X"],
  "engines": ["Engine Y"],
  "tags": ["sunset", "coastal"],
  "countries": ["United Kingdom", "France"],
  "sites": [
    { "site_id": "uuid", "site_name": "Mountain Ridge", "takeoff_lat": 52.35, "takeoff_lon": -1.17, "image_count": 12, "video_count": 4 }
  ]
}
```

---

### Home Screen Sections
```http
GET /media/home?limit=20
Authorization: Bearer <token>
```

Pre-computed, capped rows for a Netflix/Photos-style home screen — each row is server-side limited so clients never page through the full library just to render a shelf.

Response:
```json
{
  "recentlyUploaded": [ /* Media[], ordered by created_at desc */ ],
  "recentlyFlown": [ /* Media[], ordered by flight_date desc */ ],
  "newestVideos": [ /* Media[], type=video, ordered by flight_date desc */ ],
  "newestPhotos": [ /* Media[], type=image, ordered by flight_date desc */ ],
  "favoriteFlights": [ /* Media[], one per flight_id, favorite=true */ ],
  "favoritePilots": [ { "pilot": "Alice", "favoriteCount": 12 } ],
  "popularSites": [ /* same shape as GET /media/filters "sites", sorted by media count desc */ ]
}
```

> "Continue Watching" is intentionally not included — per-user playback progress is persisted client-side (see FlightTV's local progress store), not on the server. Hydrate that row with `GET /media/batch`.

---

### Batch Get Media
```http
GET /media/batch?ids=uuid1,uuid2,uuid3
Authorization: Bearer <token>
```

Fetches multiple media items by ID in one call (capped at 100 ids) — e.g. to hydrate a "Continue Watching" row from locally-stored playback progress without N round trips.

---

### Search Media
```http
GET /media/search
Authorization: Bearer <token>
```

Query params: `uploaded_by`, `pilots` (comma-separated), `year`, `month`

> Legacy filter-only endpoint kept for the existing web frontend. New clients should use `GET /media/browse`, which adds free-text search (`q`), pagination, more filters, and sorting.

---

### List Media by Date or Site
```http
GET /media?date=2026-01-15
GET /media?site=uuid
Authorization: Bearer <token>
```

> Legacy endpoint kept for the existing web frontend. New clients should use `GET /media/browse?flight_date_from=...&flight_date_to=...` or `?site_id=...`.

---

### Get Media Item
```http
GET /media/:id
Authorization: Bearer <token>
```

---

### Get Related Media
```http
GET /media/:id/related?limit=24
Authorization: Bearer <token>
```

Media related to this item by flight, pilot, site, day, or shared tags — deduped and capped server-side. Each item is annotated with which relation matched it first.

Response:
```json
[
  { "id": "uuid", "relation": "same_flight", "...": "..." },
  { "id": "uuid", "relation": "same_pilot", "...": "..." }
]
```

`relation` is one of `same_flight`, `same_pilot`, `same_site`, `same_day`, `similar_tags`.

---

### Get Media Flight Summary
```http
GET /media/:id/flight
Authorization: Bearer <token>
```

Read-only flight stats for the flight this media item is linked to (via `flight_id`), for a "Flight Information" panel. Unlike `GET /flights/:id`, this is **not** ownership-scoped — media browsing is shared/read-only across pilots, so viewing someone else's video still surfaces the flight's stats. Only display fields are returned (never trackpoints/GPX). Returns `null` if the media has no linked flight.

Response:
```json
{
  "id": "uuid",
  "flight_date": "2026-01-15",
  "title": "Evening ridge run",
  "duration_seconds": 5423,
  "launch_site_name": "Mountain Ridge",
  "landing_site_name": "Valley LZ",
  "max_altitude_m": 1240,
  "max_speed_mps": 18.4,
  "total_distance_m": 32400,
  "pilot": { "id": "uuid", "display_name": "Alice" }
}
```

---

### Get Media Flight Trackpoints
```http
GET /media/:id/flight/trackpoints
Authorization: Bearer <token>
```

Parsed GPX trackpoint array for the flight this media item is linked to, for rendering a flight path alongside the media (e.g. FlightTV). Same basis as [Get Media Flight Summary](#get-media-flight-summary) above — **not** ownership-scoped, since a flight only becomes reachable through this endpoint once it's linked to a browsable media item; flights with no linked media stay fully private and are never exposed here. Returns `null` if the media has no linked flight.

Response shape is identical to [Get Flight Trackpoints](#get-flight-trackpoints).

---

### Get Media by Mission
```http
GET /media/mission/:missionId
Authorization: Bearer <token>
```

---

### Get Dates with Media
```http
GET /media/dates
Authorization: Bearer <token>
```

Returns a list of all dates that have at least one media item.

---

### Get Dates with Media Counts
```http
GET /media/dates/counts
Authorization: Bearer <token>
```

Query params (optional): `uploaded_by`, `pilots`, `year`, `month`

---

### Get Sites with Media Counts
```http
GET /media/sites/counts
Authorization: Bearer <token>
```

Query params (optional): `uploaded_by`, `pilots`, `year`, `month`

---

### Get Distinct Pilot Names from Media
```http
GET /media/pilots
Authorization: Bearer <token>
```

Returns all distinct pilot name strings that appear in media records.

---

### Get Media Access Token
```http
GET /media/:id/token
Authorization: Bearer <token>
```

Returns a short-lived (5-minute) token for accessing the media file and thumbnail. Pass this token as a query param on the file/thumbnail endpoints.

Response:
```json
{
  "token": "eyJ...",
  "expiresIn": "5m",
  "mediaId": "uuid"
}
```

---

### Stream Media File
```http
GET /media/:id/file?token=<media-token>
```

Streams the raw media file. Supports `Range` requests for video scrubbing. Requires a token from `GET /media/:id/token`. This is FlightTV's `mediaURL`.

---

### Get Media Thumbnail
```http
GET /media/:id/thumbnail?token=<media-token>
```

Returns the JPEG thumbnail. Requires a token from `GET /media/:id/token`. This is FlightTV's `thumbnailURL` and `previewURL` — there is a single generated image, no separate higher-res preview asset.

---

### Increment View Count
```http
POST /media/:id/view
Authorization: Bearer <token>
```

Call when a user opens the media viewer.

Response:
```json
{ "message": "View count incremented", "view_count": 42 }
```

---

### Increment Download Count
```http
POST /media/:id/download
Authorization: Bearer <token>
```

Call when a user initiates a download.

Response:
```json
{ "message": "Download count incremented", "download_count": 7 }
```

---

### Set Favorite
```http
PATCH /media/:id/favorite
Authorization: Bearer <token>
Content-Type: application/json

{ "favorite": true }
```

Favorite is a single shared value on the media item (like `view_count`), not per-viewer — any authenticated user can toggle it.

---

### Set Rating
```http
PATCH /media/:id/rating
Authorization: Bearer <token>
Content-Type: application/json

{ "rating": 4 }
```

`rating` is an integer `0`-`5`. Like favorite, this is a single shared value on the item, not per-viewer.

---

### Update Media Metadata
```http
PATCH /media/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "notes": "Updated notes",
  "pilots": ["Alice", "Charlie"],
  "site_id": "uuid",
  "mission_id": "uuid",
  "flight_id": "uuid",
  "title": "Evening ridge run",
  "description": "Golden hour flight over the ridge",
  "tags": ["sunset", "coastal"],
  "aircraft": "Paramotor A",
  "wing": "Wing X",
  "engine": "Engine Y"
}
```

> Uploader or admin only. All fields are optional; only the fields present are updated.

---

### Delete Media
```http
DELETE /media/:id
Authorization: Bearer <token>
```

> Uploader or admin only.

---

### Regenerate Thumbnails
```http
POST /media/admin/regenerate-thumbnails
Authorization: Bearer <token>
```

> Admin only. Rebuilds thumbnails for all image media (fixes EXIF orientation issues).

---

## Settings

### Get All Settings
```http
GET /settings
Authorization: Bearer <token>
```

---

### Get Settings as Key-Value Map
```http
GET /settings/map
Authorization: Bearer <token>
```

---

### Get Default Settings
```http
GET /settings/defaults
Authorization: Bearer <token>
```

---

### Get Setting by Key
```http
GET /settings/:key
Authorization: Bearer <token>
```

---

### Update Setting
```http
PUT /settings/:key
Authorization: Bearer <token>
Content-Type: application/json

{
  "value": 25
}
```

> Admin only.

---

### Update Multiple Settings
```http
PUT /settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "settings": [
    { "setting_key": "wind.thresholds.calm", "value": 3 },
    { "setting_key": "wind.thresholds.optimal", "value": 15 }
  ]
}
```

> Admin only.

---

### Reset Settings to Defaults
```http
POST /settings/reset
Authorization: Bearer <token>
```

> Admin only.

---

### OpenSky Integration Settings

| Key | Type | Default | Description |
|---|---|---|---|
| `opensky.airspace_radius_km` | number | `5` | Radius in km around each flying pilot to query for nearby aircraft via OpenSky Network |

---

## OpenSky

### Get OpenSky API Stats
```http
GET /opensky/stats
Authorization: Bearer <token>
```

> Admin only.

Returns call statistics for the OpenSky Network integration. Use this to monitor usage against OpenSky's anonymous limit (400 calls/day) and track rate-limit rejections.

Response:
```json
{
  "totalCalls": 142,
  "totalRejected": 3,
  "maxPerDay": {
    "date": "2026-06-18",
    "count": 48,
    "rejected": 2
  },
  "maxPerHour": {
    "hour": "2026-06-18T12:00:00.000Z",
    "count": 12,
    "rejected": 1
  }
}
```

| Field | Description |
|---|---|
| `totalCalls` | Total successful OpenSky API calls (all time) |
| `totalRejected` | Total calls rejected with HTTP 429 (all time) |
| `maxPerDay.count` | Highest single-day call count |
| `maxPerDay.rejected` | 429 rejections on that day |
| `maxPerHour.count` | Highest single-hour call count |
| `maxPerHour.rejected` | 429 rejections in that hour |

---

### Reset OpenSky API Stats
```http
DELETE /opensky/stats
Authorization: Bearer <token>
```

> Admin only. Clears all OpenSky call statistics.

Response:
```json
{ "message": "OpenSky API statistics reset" }
```

---

## Environment Variables

### Backend

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL host | `localhost` | Yes |
| `DB_PORT` | PostgreSQL port | `5432` | Yes |
| `DB_USERNAME` | Database username | `flightops` | Yes |
| `DB_PASSWORD` | Database password | — | Yes |
| `DB_DATABASE` | Database name | `flightops` | Yes |
| `JWT_SECRET` | Secret for JWT signing | — | Yes |
| `JWT_EXPIRATION` | Token expiration | `7d` | No |
| `PORT` | Backend server port | `3000` | No |
| `NODE_ENV` | Environment | `development` | No |
| `WEATHER_UPDATE_INTERVAL` | Cron expression for weather updates | `0 */6 * * *` | No |
| `MAX_LOGIN_ATTEMPTS` | Max failed login attempts before lockout | `5` | No |
| `LOCKOUT_DURATION` | Account lockout duration (minutes) | `30` | No |
| `MEDIA_STORAGE_PATH` | Path for media file storage | `/app/media` | No |
| `MAX_UPLOAD_SIZE` | Maximum file upload size (bytes) | `524288000` | No |
| `APK_STORAGE_PATH` | Path for Flightoid APK release storage | `/app/apk-releases` | No |
| `MAX_GPX_UPLOAD_SIZE` | Maximum GPX file upload size (bytes) | `52428800` | No |

### Frontend

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000` | Yes |
| `VITE_MAP_CENTER_LAT` | Default map center latitude | `51.5074` | No |
| `VITE_MAP_CENTER_LON` | Default map center longitude | `-0.1278` | No |
| `VITE_MAP_ZOOM` | Default map zoom level | `6` | No |
