# Logbook Sync Contract

This document is the authoritative specification for the bidirectional sync between the FlightOps web app (server, the **master**) and the flightnow iOS app. Implement the iOS side exactly as described here.

---

## 1. Purpose and principles

- **Web app is master.** The server always wins on tie; on conflict, the most-recently-changed value wins.
- **Private.** Each pilot sees only their own logbook. The server resolves the pilot from the authenticated JWT; the iOS app never sends a `pilot_id`.
- **Idempotent.** Every operation is retryable with the same result. Use `client_id` as the dedup key.
- **Soft-delete only.** Entries are never hard-deleted; tombstones are retained for convergence.

---

## 2. Core concepts

### Identity: `(pilot_id, client_id)`

Every logbook entry is identified server-side by `(pilot_id, client_id)`. The iOS app's `Flight.id` UUID becomes the `client_id`. This pair is the unique dedup key — if a push arrives twice with the same `client_id`, the second call is an upsert (last-write-wins), not a duplicate.

### Conflict resolution: Last-Write-Wins (LWW)

When a push arrives for an existing entry, the server compares `pushed.client_updated_at` with the server's `client_updated_at` (or `updated_at` as fallback). If `pushed.client_updated_at > server`, the mobile value wins for client-owned fields. On tie or older timestamp, the server value is kept (no-op). The server always returns the current authoritative row.

### Server-authoritative vs client-owned fields

| Field | Owner | Notes |
|---|---|---|
| `id`, `pilot_id`, `revision` | Server | Never sent by client |
| `weather_snapshot` | Server | Frozen at creation; never overwritten by mobile |
| `flight_id`, GPX analysis metrics (`analyzed_*`) | Server | Set from GPX pipeline; mobile must not overwrite |
| `flight_date`, `title`, `notes`, `launch_site_name`, `landing_site_name` | Client | Mobile wins on newer timestamp |
| `wing`, `engine`, `paramotor`, `equipment_refs_json` | Client | Mobile wins |
| `category`, `flight_purpose`, `route_name`, `rating` | Client | Mobile wins |
| `fuel_start_litres`, `fuel_used_litres`, `battery_start_percent`, `battery_used_percent` | Client | Mobile wins |
| `duration_seconds`, `distance_m`, `avg_speed_mps`, etc. (raw, non-`analyzed_`) | Client | Mobile wins; server may later replace with analyzed metrics via `analyzed_*` columns |
| `start_at`, `end_at`, `takeoff_lat/lon`, `landing_lat/lon` | Client | Mobile wins |
| `deleted_at` | Either | Once set, never unset |

---

## 3. Authentication

All logbook endpoints require a valid JWT Bearer token:

```
Authorization: Bearer <jwt>
```

CSRF tokens are **not required** for Bearer-authenticated requests (the backend auto-skips CSRF validation when `Authorization: Bearer ...` is present). Mobile clients should not include `X-CSRF-Token`.

---

## 4. Units on the wire

All values sent to and received from the server are **SI units**:

| Measurement | Wire unit | iOS storage | Conversion |
|---|---|---|---|
| Distance | **metres** (m) | km | `wire_m = ios_km × 1000` |
| Speed | **m/s** | km/h | `wire_mps = ios_kmh / 3.6` |
| Altitude | **metres** (m) | displayed as ft, stored as m | no conversion needed if stored as m |
| Duration | **seconds** (integer) | seconds | none |
| Coordinates | **decimal degrees** (Double) | same | none |
| Fuel | **litres** (Double) | litres | none |
| Battery | **percent** (0–100, Double) | percent | none |
| Timestamps | **ISO-8601 UTC** (`2024-06-15T08:23:00Z`) | Date | `ISO8601DateFormatter` |
| Dates | **ISO-8601 date** (`2024-06-15`) | DateComponents | `yyyy-MM-dd` |

---

## 5. Category strings

The `category` field is a free-text string. The following values are in use on the web side and should be used on iOS for consistent display:

- `Recreational`
- `Training`
- `Cross Country`
- `Competition`
- `Test Flight`

New values won't break the server; they'll be stored and round-tripped as-is.

---

## 6. Endpoint reference

### Base URL
```
https://<host>/api/logbook
```

### 6.1 List entries

```
GET /logbook
GET /logbook?from=2024-01-01&to=2024-12-31
```

Returns all non-deleted entries for the authenticated pilot, newest first. The `from`/`to` filters are inclusive date strings (`YYYY-MM-DD`).

**Response:** `200 OK`

```json
[
  {
    "id": "uuid",
    "pilot_id": "uuid",
    "client_id": "uuid",
    "source": "flightnow",
    "flight_date": "2024-06-15",
    "start_at": "2024-06-15T08:23:00Z",
    "end_at": "2024-06-15T10:41:00Z",
    "duration_seconds": 8280,
    "distance_m": 42300.0,
    "avg_speed_mps": 8.2,
    "max_speed_mps": 14.7,
    "max_altitude_m": 1842.0,
    "avg_altitude_m": 1200.0,
    "max_climb_mps": 3.1,
    "max_sink_mps": -2.4,
    "takeoff_lat": -37.8136,
    "takeoff_lon": 144.9631,
    "landing_lat": -37.8500,
    "landing_lon": 145.0100,
    "launch_site_name": "Mystic Hill",
    "landing_site_name": "Town Oval",
    "title": "Morning XC run",
    "notes": "Strong thermals after 9am.",
    "wing": "Ozone Zeno 2",
    "engine": null,
    "paramotor": null,
    "equipment_refs_json": {"wingId": "uuid", "paramotorId": null, "engineId": null},
    "fuel_start_litres": null,
    "fuel_used_litres": null,
    "battery_start_percent": null,
    "battery_used_percent": null,
    "category": "Cross Country",
    "flight_purpose": null,
    "route_name": null,
    "rating": 5,
    "weather_snapshot": {
      "lat": -37.8136,
      "lon": 144.9631,
      "site_id": "uuid-or-null",
      "matched_site_name": "Mystic Hill",
      "observed_at": "2024-06-15T08:00:00Z",
      "takeoff_at": "2024-06-15T08:23:00Z",
      "temperature_c": 14.2,
      "wind_speed_kmh": 18.0,
      "wind_direction_deg": 220.0,
      "gust_speed_kmh": 25.0,
      "precipitation_mm": 0.0,
      "cloud_cover_pct": 40.0,
      "cloud_base_m": 2200.0,
      "source": "forecast_cache"
    },
    "weather_source": "forecast_cache",
    "revision": 3,
    "client_updated_at": "2024-06-15T11:00:00Z",
    "deleted_at": null,
    "created_at": "2024-06-15T08:25:00Z",
    "updated_at": "2024-06-15T11:00:05Z",
    "gpx": {
      "flight_id": "uuid",
      "gpx_url": "/api/flights/uuid/file",
      "parse_status": "complete",
      "analysis_status": "complete",
      "bbox_json": {"minLon": 144.9, "minLat": -37.9, "maxLon": 145.1, "maxLat": -37.7}
    },
    "media": [
      {
        "id": "uuid",
        "media_type": "image",
        "original_filename": "DSC_0042.jpg",
        "uploaded_by": "alice",
        "thumbnail_url": "/api/media/uuid/thumbnail",
        "file_url": "/api/media/uuid/file"
      }
    ],
    "analyzed_duration_seconds": 8280,
    "analyzed_distance_m": 42310.5,
    "analyzed_max_altitude_m": 1843.2,
    "analyzed_max_speed_mps": 14.8
  }
]
```

### 6.2 Get single entry

```
GET /logbook/:id
```

Returns one entry. `404` if not owned by the authenticated pilot.

### 6.3 Create manual entry

```
POST /logbook
Content-Type: application/json
```

```json
{
  "flight_date": "2024-06-15",
  "client_id": "ios-flight-uuid",
  "title": "Dune hop session",
  "launch_site_name": "Blue Dune",
  "landing_site_name": "Blue Dune",
  "category": "Recreational",
  "wing": "Nova Mentor 7",
  "engine": null,
  "duration_seconds": 2700,
  "distance_m": 3200.0,
  "rating": 4,
  "notes": "Light winds, smooth conditions."
}
```

`client_id` is optional but strongly recommended for idempotent retry. If an entry for `(pilot, client_id)` already exists, the server returns the existing entry rather than creating a duplicate.

**Response:** `201 Created` — the full entry object (same shape as list).

### 6.4 Update entry

```
PATCH /logbook/:id
Content-Type: application/json
```

Partial update; only include fields you want to change.

**Response:** `200 OK` — the updated entry object.

### 6.5 Delete entry

```
DELETE /logbook/:id
```

Soft-delete. Sets `deleted_at`; the entry remains in the database for tombstone propagation.

**Response:** `200 OK`

```json
{ "id": "uuid", "deleted_at": "2024-06-15T12:00:00Z" }
```

### 6.6 Delta pull (sync)

```
GET /logbook/sync?since=2024-06-01T00:00:00Z
```

Returns all entries (including tombstones) updated since `since`. Use this after the initial full pull to get only changes.

**Response:** `200 OK`

```json
{
  "entries": [ /* same shape as list */ ],
  "server_time": "2024-06-15T12:01:00Z"
}
```

Save `server_time` as your `lastSyncedAt` watermark. Use it as the `since` value on the next pull.

### 6.7 Batch push (sync)

```
POST /logbook/sync
Content-Type: application/json
```

Push new or modified entries and deletes in one call. All entries and deletes are processed atomically per-item (not all-or-nothing across the batch); the response reports the status of each.

```json
{
  "entries": [
    {
      "client_id": "ios-flight-uuid",
      "client_updated_at": "2024-06-15T11:00:00Z",
      "flight_date": "2024-06-15",
      "title": "Morning XC run",
      "duration_seconds": 8280,
      "distance_m": 42300.0,
      "avg_speed_mps": 8.2,
      "max_speed_mps": 14.7,
      "max_altitude_m": 1842.0,
      "start_at": "2024-06-15T08:23:00Z",
      "end_at": "2024-06-15T10:41:00Z",
      "takeoff_lat": -37.8136,
      "takeoff_lon": 144.9631,
      "wing": "Ozone Zeno 2",
      "category": "Cross Country",
      "rating": 5,
      "notes": "Strong thermals after 9am.",
      "equipment_refs_json": {"wingId": "uuid", "paramotorId": null, "engineId": null}
    }
  ],
  "deletes": [
    {
      "client_id": "ios-flight-uuid-2",
      "deleted_at": "2024-06-15T11:30:00Z"
    }
  ]
}
```

**Response:** `200 OK`

```json
{
  "results": [
    {
      "client_id": "ios-flight-uuid",
      "id": "server-uuid",
      "status": "created",
      "revision": 1,
      "server": { /* full entry object */ }
    }
  ],
  "delete_results": [
    {
      "client_id": "ios-flight-uuid-2",
      "status": "deleted"
    }
  ]
}
```

Possible `status` values for entries: `created`, `updated`, `server_wins` (server had newer data — use `server` for the truth). For deletes: `deleted`, `not_found`, `already_deleted`.

### 6.8 GPX upload (existing endpoint — extended)

```
POST /flights
Content-Type: multipart/form-data
```

This is the existing flight upload endpoint. It has been extended with two new optional fields:

| Field | Type | Purpose |
|---|---|---|
| `client_id` | string (UUID) | The iOS `Flight.id`. Passed as the `client_id` of the auto-created logbook entry. |
| `takeoff_lat` | number | Decimal degrees — improves weather site matching. |
| `takeoff_lon` | number | Decimal degrees — improves weather site matching. |

When `client_id` is provided, the server deduplicates on `(pilot, client_id)` — uploading the same GPX twice will not create two logbook entries.

### 6.9 Download PDF

```
GET /logbook/pdf
GET /logbook/pdf?from=2024-01-01&to=2024-12-31
```

Returns a PDF stream of the authenticated pilot's logbook. Not intended for mobile use (web only).

---

## 7. Sync flow sequences

### 7.1 GPX upload flow (automatic logbook entry creation)

```
iOS                                     Server
 |                                         |
 | POST /flights (multipart)               |
 |  body: gpx file + client_id=<flight.id> |
 |  + takeoff_lat/lon                      |
 |---------------------------------------->|
 |                                         | parse GPX async
 |                                         | create/upsert LogbookEntry
 |                                         |   client_id = <flight.id>
 |                                         |   source = 'flightnow'
 |                                         |   flight_id = <new flight.id>
 |                                         | capture weather async (fire & forget)
 |<----------------------------------------|
 | 201 { id: <flight_id>, ... }            |
 |                                         |
 | (later) GET /logbook/sync?since=...     |
 |---------------------------------------->|
 |<----------------------------------------|
 | entry appears with flight_id + weather  |
```

### 7.2 Manual flight (no GPX)

```
iOS                                     Server
 |                                         |
 | POST /logbook/sync                      |
 |  { entries: [{ client_id, flight_date,  |
 |    title, duration_seconds, ... }] }    |
 |---------------------------------------->|
 |                                         | upsert on (pilot, client_id)
 |                                         | source = 'flightnow'
 |<----------------------------------------|
 | { results: [{ status: "created", ... }]}|
```

### 7.3 Delta pull (startup / background refresh)

```
iOS                                     Server
 |                                         |
 | GET /logbook/sync?since=<lastSyncedAt>  |
 |---------------------------------------->|
 |<----------------------------------------|
 | { entries: [...], server_time: "..." }  |
 |                                         |
 | Upsert all entries into SwiftData       |
 | Update lastSyncedAt = server_time       |
```

### 7.4 Delete flow

```
iOS                                     Server
 |                                         |
 | User deletes a flight on iOS            |
 |                                         |
 | POST /logbook/sync                      |
 |  { deletes: [{ client_id,              |
 |    deleted_at: "now" }] }              |
 |---------------------------------------->|
 |                                         | sets deleted_at on entry
 |<----------------------------------------|
 | { delete_results: [{ status: "deleted"}]}|
 |                                         |
 | (On next pull, entry has deleted_at set)|
 | Remove from local SwiftData             |
```

---

## 8. Weather snapshot

Weather is captured server-side at entry creation and is a frozen JSONB snapshot. iOS should display but never overwrite it.

```json
{
  "lat": -37.8136,
  "lon": 144.9631,
  "site_id": "uuid-or-null",
  "matched_site_name": "Mystic Hill",
  "observed_at": "2024-06-15T08:00:00Z",
  "takeoff_at": "2024-06-15T08:23:00Z",
  "temperature_c": 14.2,
  "wind_speed_kmh": 18.0,
  "wind_direction_deg": 220.0,
  "gust_speed_kmh": 25.0,
  "precipitation_mm": 0.0,
  "cloud_cover_pct": 40.0,
  "cloud_base_m": 2200.0,
  "source": "forecast_cache"
}
```

`source` values:
- `forecast_cache` — from the server's weather forecast cache (most accurate for current conditions)
- `open_meteo_archive` — from the Open-Meteo historical archive (used for flights >5 days ago)
- `open_meteo_forecast` — from the Open-Meteo forecast API (fallback when no site matched)
- `none` — weather could not be captured

---

## 9. Required iOS SwiftData changes

The following additions are required to support bidirectional sync. The existing GPX upload flow in `ServerSyncService` / `ServerClient` remains intact.

### 9.1 Add sync fields to the Flight model

```swift
@Model
class Flight {
    // ... existing fields ...

    // Sync state
    var serverId: String?           // UUID from server logbook_entries.id
    var serverRevision: Int = 0     // revision from server; bump on successful push
    var clientUpdatedAt: Date?      // set to Date() whenever user edits this flight
    var deletedAt: Date?            // set when user deletes; cleared after server confirms
    var needsSync: Bool = true      // true when local changes not yet pushed
    var lastSyncedAt: Date?         // set to server_time from last successful pull
}
```

### 9.2 Wire `client_id` into the GPX upload

In `ServerSyncService.uploadFlight(flight:)` (or wherever you call `POST /flights`), add the `client_id` multipart field:

```swift
body.append(flight.id.uuidString, named: "client_id")
// If you have takeoff coordinates, include them:
if let lat = flight.takeoffLat, let lon = flight.takeoffLon {
    body.append(String(lat), named: "takeoff_lat")
    body.append(String(lon), named: "takeoff_lon")
}
```

After a successful upload, store `flight.serverId = response.logbook_entry_id` (the server will return the logbook entry ID in the flight upload response once that field is added).

### 9.3 Add a sync engine

Add these methods to `ServerSyncService` (or a new `LogbookSyncService`):

```swift
// Pull delta from server
func pullLogbook(since: Date?) async throws {
    let sinceStr = since.map { ISO8601DateFormatter().string(from: $0) }
    let url = sinceStr != nil
        ? "/api/logbook/sync?since=\(sinceStr!)"
        : "/api/logbook/sync"

    let response = try await client.get(url, as: LogbookSyncResponse.self)

    for entry in response.entries {
        let flight = fetchOrCreate(clientId: entry.clientId)
        flight.serverId = entry.id
        flight.serverRevision = entry.revision
        flight.clientUpdatedAt = entry.clientUpdatedAt
        // map all fields from entry...
        if entry.deletedAt != nil {
            flight.deletedAt = entry.deletedAt
            flight.needsSync = false
        }
    }
    lastSyncedAt = response.serverTime
}

// Push local changes to server
func pushLogbook() async throws {
    let dirty = try context.fetch(
        FetchDescriptor<Flight>(predicate: #Predicate { $0.needsSync == true })
    )

    let entries: [PushEntryDTO] = dirty.compactMap { flight in
        guard flight.deletedAt == nil else { return nil }
        return PushEntryDTO(
            clientId: flight.id.uuidString,
            clientUpdatedAt: flight.clientUpdatedAt ?? Date(),
            flightDate: flight.date.formatted(date: .iso8601, time: .omitted),
            durationSeconds: Int(flight.duration),
            distanceM: flight.distanceKm.map { $0 * 1000 },
            avgSpeedMps: flight.avgSpeedKmh.map { $0 / 3.6 },
            maxSpeedMps: flight.maxSpeedKmh.map { $0 / 3.6 },
            maxAltitudeM: flight.maxAltitudeM,
            startAt: flight.startAt.map { ISO8601DateFormatter().string(from: $0) },
            endAt: flight.endAt.map { ISO8601DateFormatter().string(from: $0) },
            takeoffLat: flight.takeoffLat,
            takeoffLon: flight.takeoffLon,
            wing: flight.glider,
            engine: flight.engine,
            category: flight.category,
            notes: flight.notes,
            title: flight.title
        )
    }

    let deletes: [DeleteRefDTO] = dirty.compactMap { flight in
        guard let deletedAt = flight.deletedAt else { return nil }
        return DeleteRefDTO(
            clientId: flight.id.uuidString,
            deletedAt: ISO8601DateFormatter().string(from: deletedAt)
        )
    }

    guard !entries.isEmpty || !deletes.isEmpty else { return }

    let response = try await client.post(
        "/api/logbook/sync",
        body: ["entries": entries, "deletes": deletes],
        as: LogbookSyncPushResponse.self
    )

    for result in response.results {
        if let flight = fetchByClientId(result.clientId) {
            flight.serverId = result.id
            flight.serverRevision = result.revision
            if result.status == "server_wins", let server = result.server {
                // Apply server's authoritative values
                applyServerEntry(server, to: flight)
            }
            flight.needsSync = false
        }
    }
}
```

### 9.4 Trigger sync

- **On app foreground:** call `pullLogbook(since: lastSyncedAt)` then `pushLogbook()`.
- **After GPX upload:** call `pullLogbook(since: nil)` once the upload completes to pick up the created logbook entry and its weather snapshot.
- **On flight edit:** set `flight.needsSync = true` and `flight.clientUpdatedAt = Date()`, then push.
- **On flight delete:** set `flight.deletedAt = Date()` and `flight.needsSync = true`, then push.

---

## 10. Error handling and retries

| HTTP status | Meaning | iOS action |
|---|---|---|
| `200`, `201` | Success | Store result |
| `400` | Validation error | Log, skip that item |
| `401` | Token expired | Re-authenticate, then retry |
| `404` | Not owned by pilot | Remove from local state |
| `409` | Conflict (rare) | Server wins; use returned `server` object |
| `429` | Rate limited | Retry after `Retry-After` header |
| `5xx` | Server error | Retry with exponential backoff (max 3 attempts) |

Network failures: use `needsSync = true` to ensure the push is retried on the next sync cycle.

---

## 11. Versioning

This contract is versioned by the `X-Logbook-Sync-Version: 1` response header. If the iOS app sees a version number higher than it supports, it should fall back to read-only pull mode and prompt the user to update.
