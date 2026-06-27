# API Documentation

All endpoints require a `Bearer` token in the `Authorization` header unless otherwise noted. Tokens are obtained via the login endpoint.

> **Mobile App Note:** For native mobile clients, include `Authorization: Bearer <token>` on every request. Tokens expire per the server's `JWT_EXPIRATION` setting (default `7d`). The CSRF token endpoint is only needed for browser-based clients.

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
  "needs_password_reset": false
}
```

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
  "new_password": "NewSecurePassword456"
}
```

---

### Adding a Pre-authorized Email

Add an email to the whitelist via psql:
```bash
docker compose exec postgres psql -U flightops -d flightops -c \
  "INSERT INTO pre_authorized_emails (email, role) VALUES ('your@email.com', 'admin');"
```

---

## Equipment

Equipment (paramotors, engines, and wings) is private to the authenticated user. All endpoints require `Authorization: Bearer <token>`.

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
    "tank_size_litres": 10,
    "fuel_consumption_lph": 3.5,
    "notes": null,
    "created_at": "2026-01-15T10:00:00.000Z",
    "updated_at": "2026-01-15T10:00:00.000Z"
  }
]
```

---

### Create Engine
```http
POST /equipment/engines
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Vittorazi Moster 185",
  "tank_size_litres": 10,
  "fuel_consumption_lph": 3.5,
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

{
  "name": "Vittorazi Moster 185 Plus",
  "tank_size_litres": 12
}
```

---

### Delete Engine
```http
DELETE /equipment/engines/:id
Authorization: Bearer <token>
```

Response: `{ "message": "Engine deleted" }`

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
    "notes": null,
    "created_at": "2026-01-15T10:00:00.000Z",
    "updated_at": "2026-01-15T10:00:00.000Z"
  }
]
```

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

---

### List Paramotors
```http
GET /equipment/paramotors
Authorization: Bearer <token>
```

Response includes the nested `engine` object when an engine is linked:
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "My Paramotor",
    "engine_id": "uuid",
    "engine": {
      "id": "uuid",
      "name": "Vittorazi Moster 185",
      "tank_size_litres": 10,
      "fuel_consumption_lph": 3.5
    },
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
  "notes": "Optional notes"
}
```

`engine_id` is optional — omit or pass `null` for a paramotor with no linked engine.

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

{ "engine_id": "uuid" }
```

---

### Delete Paramotor
```http
DELETE /equipment/paramotors/:id
Authorization: Bearer <token>
```

Response: `{ "message": "Paramotor deleted" }`

---

## Sites

### List Sites
```http
GET /sites
Authorization: Bearer <token>
```

Returns all flight sites for the current user.

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
  "parkingNotes": "Park in the layby, not the farmer's field"
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

### List Missions
```http
GET /missions
Authorization: Bearer <token>
```

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

---

### Delete Mission
```http
DELETE /missions/:id
Authorization: Bearer <token>
```

> Returns `204 No Content`.

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

---

### Delete Pilot
```http
DELETE /pilots/:id
Authorization: Bearer <token>
```

---

### Update My Position *(Live Tracking)*
```http
PUT /pilots/me/position
Authorization: Bearer <token>
Content-Type: application/json

{
  "lat": 51.5074,
  "lon": -0.1278,
  "state": "Flying"
}
```

`state` must be `"Flying"` or `"Landed"`.

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

Aircraft are sourced from the [OpenSky Network](https://opensky-network.org/) and queried on each pilot position update, subject to a 10-second minimum interval between API calls. `aircraft.updated_at` is the ISO timestamp of the last successful OpenSky response (`null` if no query has succeeded yet). When position updates arrive faster than the 10-second window, the cached positions from the previous query are returned — use `updated_at` to decide whether the data is still relevant. `aircraft.positions` is empty when no pilots are actively flying. The airspace query radius is controlled by the `opensky.airspace_radius_km` setting (default 5 km).

Response:
```json
{
  "pilots": [
    {
      "pilot_id": "uuid",
      "display_name": "Alice",
      "lat": 51.5074,
      "lon": -0.1278,
      "state": "Flying",
      "updated_at": "2026-06-16T14:30:00.000Z"
    },
    {
      "pilot_id": "uuid",
      "display_name": "Bob",
      "lat": 51.5100,
      "lon": -0.1300,
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

### List Flights by Date
```http
GET /flights?date=2026-01-15
Authorization: Bearer <token>
```

---

### Upload Flight (GPX)
```http
POST /flights
Authorization: Bearer <token>
Content-Type: multipart/form-data

file:         <GPX file>
flight_date:  2026-01-15
pilot_id:     uuid
site_id:      uuid (optional)
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

Returns normalized trackpoints and stats for side-by-side comparison.

---

### Get Flight
```http
GET /flights/:id
Authorization: Bearer <token>
```

Response includes parsed stats: duration, distance, max altitude, speeds, climb rate, bounding box, parse and analysis status.

---

### Stream GPX File
```http
GET /flights/:id/file
Authorization: Bearer <token>
```

Returns the raw `.gpx` file as `application/gpx+xml`.

---

### Get Flight Analysis
```http
GET /flights/:id/analysis
Authorization: Bearer <token>
```

Returns per-phase scores, events (takeoff, landing, thermals), and coaching notes.

---

### Re-run Analysis
```http
POST /flights/:id/reanalyze
Authorization: Bearer <token>
```

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

---

### Delete Flight
```http
DELETE /flights/:id
Authorization: Bearer <token>
```

Deletes the flight record and the GPX file from disk.

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

### Upload Media
```http
POST /media
Authorization: Bearer <token>
Content-Type: multipart/form-data

file:         <File>
flight_date:  2026-01-15
pilots:       ["Alice", "Bob"]
notes:        Optional notes
site_id:      uuid (optional)
mission_id:   uuid (optional)
```

---

### Search Media
```http
GET /media/search
Authorization: Bearer <token>
```

Query params: `uploaded_by`, `pilots` (comma-separated), `year`, `month`

---

### List Media by Date or Site
```http
GET /media?date=2026-01-15
GET /media?site=uuid
Authorization: Bearer <token>
```

---

### Get Media Item
```http
GET /media/:id
Authorization: Bearer <token>
```

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

Streams the raw media file. Supports `Range` requests for video scrubbing. Requires a token from `GET /media/:id/token`.

---

### Get Media Thumbnail
```http
GET /media/:id/thumbnail?token=<media-token>
```

Returns the JPEG thumbnail. Requires a token from `GET /media/:id/token`.

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

### Update Media Metadata
```http
PATCH /media/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "notes": "Updated notes",
  "pilots": ["Alice", "Charlie"],
  "site_id": "uuid"
}
```

> Uploader or admin only.

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
| `MAX_GPX_UPLOAD_SIZE` | Maximum GPX file upload size (bytes) | `52428800` | No |

### Frontend

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000` | Yes |
| `VITE_MAP_CENTER_LAT` | Default map center latitude | `51.5074` | No |
| `VITE_MAP_CENTER_LON` | Default map center longitude | `-0.1278` | No |
| `VITE_MAP_ZOOM` | Default map zoom level | `6` | No |
