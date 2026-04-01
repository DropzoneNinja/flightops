# TODO_WEBSCORE.md
# Paramotor Album + GPX Flight Analysis – Implementation Plan

## Codebase Context
- **Backend**: NestJS 10, TypeScript, TypeORM, PostgreSQL 15
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Query v5, Zustand, Leaflet
- **Album "flight day"**: grouped by `flight_date` (DATE) on the `media` table
- **Storage**: `MEDIA_STORAGE_PATH/YYYY-MM-DD/UUID-originalname.ext`
- **Auth**: JWT, `JwtAuthGuard`, `AdminGuard`
- **API style**: REST, NestJS modules/controllers/services

---

## Phase 1 — Foundation
> Goal: GPX files can be uploaded, stored, parsed, and listed on a flight day.

### 1.1 Backend – New Modules & Entities

- [x] **Create `backend/src/flights/` NestJS module**
  - `flights.module.ts`
  - `flights.controller.ts`
  - `flights.service.ts`
  - Register in `app.module.ts` following existing pattern

- [x] **Create `backend/src/pilots/` NestJS module**
  - `pilots.module.ts`, `pilots.controller.ts`, `pilots.service.ts`
  - Lightweight pilot identity (no user account required)
  - Reuse existing `users.pilots[]` string array as seed data if helpful

- [x] **Add TypeORM entities** in `backend/src/database/entities/`

  **`Pilot` entity**
  ```typescript
  id: UUID (PK)
  display_name: VARCHAR
  slug: VARCHAR UNIQUE
  avatar_url: TEXT nullable
  user_id: UUID FK nullable  // link to users table if they have an account
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
  ```

  **`Flight` entity**
  ```typescript
  id: UUID (PK)
  flight_date: DATE (indexed)          // matches media.flight_date
  site_id: UUID FK nullable            // FK flight_sites.id
  pilot_id: UUID FK nullable           // FK pilots.id
  title: TEXT nullable
  notes: TEXT nullable
  launch_site_name: TEXT nullable
  landing_site_name: TEXT nullable
  glider: TEXT nullable
  harness: TEXT nullable
  timezone: VARCHAR default 'UTC'
  original_filename: TEXT
  storage_key: TEXT                    // relative path under MEDIA_STORAGE_PATH
  file_size: BIGINT
  parse_status: ENUM uploaded|parsing|analyzed|failed
  analysis_status: ENUM pending|running|complete|failed
  analysis_version: VARCHAR nullable
  start_at: TIMESTAMP nullable
  end_at: TIMESTAMP nullable
  duration_seconds: INT nullable
  total_distance_m: FLOAT nullable
  max_altitude_m: FLOAT nullable
  min_altitude_m: FLOAT nullable
  altitude_gain_m: FLOAT nullable
  altitude_loss_m: FLOAT nullable
  avg_speed_mps: FLOAT nullable
  max_speed_mps: FLOAT nullable
  max_climb_mps: FLOAT nullable
  max_descent_mps: FLOAT nullable
  trackpoint_count: INT nullable
  segment_count: INT nullable
  bbox_json: JSONB nullable            // {minLon, minLat, maxLon, maxLat}
  confidence_score: FLOAT nullable
  summary_json: JSONB nullable         // full derived summary
  trackpoints_json: JSONB nullable     // normalized trackpoints (compressed array)
  uploaded_by: UUID FK users.id
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
  ```

  **`FlightEvent` entity**
  ```typescript
  id: UUID (PK)
  flight_id: UUID FK (indexed)
  event_type: VARCHAR  // takeoff|landing|max_altitude|max_climb|max_descent|max_speed|etc.
  timestamp: TIMESTAMP
  seq_start: INT nullable
  seq_end: INT nullable
  lon: FLOAT nullable
  lat: FLOAT nullable
  elevation_m: FLOAT nullable
  confidence: FLOAT nullable
  payload_json: JSONB nullable
  ```

  **`FlightScore` entity**
  ```typescript
  id: UUID (PK)
  flight_id: UUID FK UNIQUE
  scoring_version: VARCHAR
  overall_score: FLOAT
  takeoff_score: FLOAT nullable
  climb_score: FLOAT nullable
  level_score: FLOAT nullable
  turn_score: FLOAT nullable
  descent_score: FLOAT nullable
  landing_score: FLOAT nullable
  smoothness_score: FLOAT nullable
  safety_score: FLOAT nullable
  explanation_json: JSONB nullable     // array of coaching comments
  created_at: TIMESTAMP
  ```

- [x] **Write database migrations** in `backend/src/database/migrations/`
  - Migration: create `pilots` table
  - Migration: create `flights` table
  - Migration: create `flight_events` table
  - Migration: create `flight_scores` table
  - Follow existing migration naming: `YYYYMMDDHHMMSS-CreateFlights.ts`

### 1.2 Backend – GPX Upload & Storage

- [x] **Add `gpx` to accepted MIME types** in `flights.controller.ts`
  - Accepted: `application/gpx+xml`, `application/xml`, `text/xml`
  - Accepted extensions: `.gpx`
  - Max size: respect `MAX_UPLOAD_SIZE` env var (same as media)
  - File validation: reject non-XML/malformed GPX early

- [x] **Store GPX files** following media storage convention
  - Path: `MEDIA_STORAGE_PATH/YYYY-MM-DD/UUID-originalname.gpx`
  - Store relative path in `flights.storage_key`
  - Update user `storage_used` (extend existing user entity logic)

- [x] **Implement `FlightsService.uploadGpx()`**
  - Save file to disk
  - Create `Flight` record with `parse_status: 'uploaded'`
  - Trigger async parse + analysis pipeline
  - Return created flight record

- [x] **`POST /flights` endpoint** (upload)
  ```
  POST /flights
  Content-Type: multipart/form-data
  Body: file, flight_date, site_id?, pilot_id?, title?, notes?, glider?, harness?, launch_site_name?
  ```

- [x] **List / detail endpoints**
  ```
  GET /flights?date=YYYY-MM-DD     — all flights for a flight day
  GET /flights/:id                 — flight detail + summary
  GET /flights/:id/file            — stream raw GPX file (auth token like media)
  PATCH /flights/:id               — update metadata
  DELETE /flights/:id              — delete flight + file
  ```

### 1.3 Backend – GPX Parsing & Normalization

- [x] **Add parsing library**: `fast-xml-parser`
  - Server-side only; never parse on client
  - Handle both single-track and multi-track/segment GPX files

- [x] **Create `backend/src/flights/gpx-parser.service.ts`**
  - `parseGpxFile(filePath): ParsedGpxData`
  - Extract: trackpoints (lat, lon, ele, time), metadata (name, author, desc)
  - Handle missing elevation gracefully (nullable)
  - Handle missing timestamps gracefully
  - Validate: reject if no trackpoints, or if time is completely absent

- [x] **Create `backend/src/flights/gpx-normalizer.service.ts`**
  - Normalize timestamps to UTC
  - Validate coordinate ranges (lat: -90..90, lon: -180..180)
  - Compute derived per-point fields:
    - `speed_mps` from consecutive distances/time
    - `vertical_speed_mps` from elevation delta/time
    - `heading_deg` from bearing between consecutive points
  - Remove duplicate points
  - Flag GPS noise: zero-movement points, implausible jumps (>500 kph groundspeed)
  - Assign `phase` placeholder (filled by analysis engine)
  - Output: `NormalizedTrackpoint[]`

- [x] **Populate `Flight` summary fields** after normalization:
  - `start_at`, `end_at`, `duration_seconds`
  - `total_distance_m` (sum of inter-point distances using Haversine)
  - `max/min_altitude_m`, `altitude_gain/loss_m`
  - `avg/max_speed_mps`, `max_climb/descent_mps`
  - `trackpoint_count`, `segment_count`, `bbox_json`
  - `confidence_score` (see analysis section)
  - Set `parse_status: 'analyzed'` on success, `'failed'` on error

### 1.4 Frontend – GPX Upload in DailyGallery

- [x] **Add "Flights" tab to `DailyGallery` page** (`frontend/src/pages/DailyGallery.tsx`)
  - Tabs: Photos/Videos | Flights
  - Flights tab shows `FlightsSection` component

- [ ] **Create `frontend/src/components/Flights/FlightUploadButton.tsx`**
  - Similar to existing upload button in DailyGallery
  - Opens `FlightUploadModal`
  - _Note: upload button implemented inline in `FlightsSection.tsx` — extract to standalone component if reuse is needed_

- [x] **Create `frontend/src/components/Flights/FlightUploadModal.tsx`**
  - Drag-and-drop + file picker (`.gpx` only)
  - Fields: pilot (select/create), title, notes, glider, harness, launch site
  - Upload progress indicator (reuse `uploadProgress` from mediaStore pattern)
  - Status messages: uploading → parsing → analyzed / failed

- [x] **Create `frontend/src/components/Flights/FlightCard.tsx`**
  - Pilot name, filename/title
  - Duration, distance, max altitude
  - Overall score badge (if analyzed)
  - Status badge: uploaded / parsing / analyzed / failed
  - Actions: View Analysis, Compare, Edit, Delete

- [x] **Create `frontend/src/components/Flights/FlightsSection.tsx`**
  - Grid of `FlightCard` components
  - Empty state when no flights
  - Polling/refetch while any flight is `parsing`

- [x] **Create `frontend/src/services/flights.service.ts`**
  - `uploadFlight(date, file, metadata)`
  - `getFlightsByDate(date)`
  - `getFlightById(id)`
  - `updateFlight(id, metadata)`
  - `deleteFlight(id)`
  - _Note: `pilotsService` included in same file rather than a separate `pilots.service.ts`_

- [x] **Create `frontend/src/hooks/useFlights.ts`**
  - React Query hooks following `useMedia` pattern
  - `useFlightsByDate(date)`
  - `useFlightById(id)`
  - `useFlightAnalysis(id)` — fetches score + events from `GET /flights/:id/analysis`
  - _Note: `usePilots`, `usePilotCreate` also included in this file_

---

## Phase 2 — Analysis Engine
> Goal: Flights are analyzed, scored, and display useful metrics and coaching notes.

### 2.1 Analysis Engine – Phase Detection

- [x] **Create `backend/src/flights/analysis/phase-detector.ts`**
  - Pure function: `detectPhases(trackpoints: NormalizedTrackpoint[]): PhasedTrackpoint[]`
  - Assign one of: `pre_takeoff | takeoff | climb | cruise | turn | descent | approach | landing | post_landing`
  - Heuristics (all configurable via constants):
    - **pre_takeoff**: speed < 2 m/s, low altitude variance
    - **takeoff**: transition from ground movement to sustained vertical rate > 0.5 m/s
    - **climb**: sustained vertical speed > 0.5 m/s for > 10s
    - **cruise**: altitude variance < 15m over 30s window, speed > 3 m/s
    - **turn**: heading change rate > 3 deg/s sustained
    - **descent**: sustained vertical speed < -0.5 m/s
    - **approach**: final descent sequence ending within 50m of landing elevation
    - **landing**: final point cluster near minimum altitude, speed approaching zero
  - Document all thresholds with `// HEURISTIC: ...` comments
  - Mark all inferred values as `estimated: true`

### 2.2 Analysis Engine – Event Detection

- [x] **Create `backend/src/flights/analysis/event-detector.ts`**
  - Pure function: `detectEvents(trackpoints, phases): FlightEventData[]`
  - Detect:
    - `takeoff` — first trackpoint of takeoff phase
    - `landing` — last trackpoint before post_landing
    - `max_altitude` — highest elevation point
    - `max_climb_rate` — highest 10s rolling climb average
    - `max_descent_rate` — steepest 10s rolling descent
    - `max_groundspeed` — fastest ground speed point
    - `longest_level` — start/end of longest cruise segment
    - `largest_turn` — sharpest turn detected
    - `abrupt_change` — implausible speed or altitude jump (GPS noise flag)
  - Each event includes `confidence` score

### 2.3 Analysis Engine – Confidence Scoring

- [x] **Create `backend/src/flights/analysis/confidence.ts`**
  - `computeConfidence(trackpoints): number` (0.0–1.0)
  - Factors:
    - Point density (avg seconds between points; > 5s = penalty)
    - Timestamp continuity (gaps > 30s = penalty)
    - Elevation availability (missing = moderate penalty)
    - Noise level (fraction of implausible jumps)
    - Total point count (< 100 points = low confidence)
  - _Note: confidence scoring is already implemented inside `gpx-normalizer.service.ts` and stored on `Flight.confidence_score`. Extract to standalone module and expand when wiring full analysis pipeline._

### 2.4 Analysis Engine – Scoring Model

- [x] **Create `backend/src/flights/analysis/scoring/` directory**
  - `scoring-config.ts` — centralized constants for all thresholds
  - `scoring-version.ts` — export `SCORING_VERSION = '1.0'`
  - `takeoff-scorer.ts`
  - `climb-scorer.ts`
  - `level-scorer.ts`
  - `turn-scorer.ts`
  - `descent-scorer.ts`
  - `landing-scorer.ts`
  - `smoothness-scorer.ts`
  - `safety-scorer.ts`
  - `flight-scorer.ts` — orchestrator, returns `FlightScoreData`

- [x] **Scoring principles**:
  - All scorers: `(phases, events, trackpoints, config) => { score: number, notes: string[] }`
  - Score range: 0–100 per category
  - Overall = weighted average (weights in `scoring-config.ts`)
  - Normalize for short/long flights where applicable
  - Confidence-gate: if `confidence < 0.4`, add disclaimer to notes
  - Notes are template strings, not LLM-generated

- [x] **Coaching note templates** in `backend/src/flights/analysis/scoring/coaching-templates.ts`
  - e.g. `LANDING_HIGH_SINK = (rate) => \`Landing descent rate was ${rate.toFixed(1)} m/s — aim for below 2 m/s.\``
  - e.g. `LEVEL_GOOD = (duration) => \`Maintained stable level flight for ${formatDuration(duration)}.\``

### 2.5 Analysis Pipeline Wiring

- [x] **Create `backend/src/flights/flight-analysis.service.ts`**
  - `analyzeFlightAsync(flightId)` — called after parse completes
  - Steps:
    1. Load `Flight` + `trackpoints_json`
    2. `detectPhases(trackpoints)`
    3. `detectEvents(trackpoints, phases)`
    4. `computeConfidence(trackpoints)`
    5. `scoreFlight(phases, events, trackpoints)`
    6. Persist `FlightEvent[]` records
    7. Persist `FlightScore` record
    8. Update `Flight.analysis_status = 'complete'`
  - On any error: set `analysis_status = 'failed'`, log structured error

- [x] **`POST /flights/:id/reanalyze`** — re-run analysis on existing flight

- [x] **`GET /flights/:id/analysis`** — return score + events + coaching notes

### 2.6 Frontend – Score Display

- [x] **Update `FlightCard.tsx`** to show overall score badge (color-coded 0–100)

- [x] **Create `frontend/src/components/Flights/FlightScoreCard.tsx`**
  - Overall score (large, prominent)
  - Per-category scores with labels
  - Confidence indicator
  - Coaching notes list

- [x] **Create `frontend/src/components/Flights/CoachingNotes.tsx`**
  - List of string coaching notes
  - Distinguish positive vs. advisory notes visually

---

## Phase 3 — 2D Visualization & Charts
> Goal: Flight paths visible on map with linked metric charts.

### 3.1 Map Integration

- [x] **Reuse existing Leaflet (`react-leaflet`) for Phase 3** — already in the codebase
  - Add `@geoman-io/leaflet-geoman-free` only if needed for editable paths
  - For Phase 4 (3D), introduce MapLibre as a new component alongside Leaflet

- [x] **Create `frontend/src/components/Flights/FlightMap2D.tsx`**
  - Render flight path as polyline on map
  - Color-code by phase (pre_takeoff/takeoff/climb/cruise/turn/descent/approach/landing)
  - Start marker (green) + end marker (red)
  - Event markers (icons for takeoff, landing, max altitude, etc.)
  - Hover/click on path → bidirectional linking with charts via `activePointIndex`
  - Phase legend overlay

- [x] **Bounding box auto-zoom**: fit map to flight bbox on load via `FitBounds` child component

- [ ] **Multi-flight mode**: accept `flights[]` prop, render each in different color

### 3.2 Metric Charts

- [x] **Add `recharts`** to frontend dependencies (installed v3.8.1)

- [x] **Create `frontend/src/components/Flights/FlightCharts.tsx`**
  - Altitude over time (AreaChart)
  - Ground speed over time (LineChart)
  - Vertical speed over time (AreaChart with ± fill)
  - Score breakdown (horizontal bar chart)
  - Event reference lines on all charts

- [x] **Bidirectional linking**: chart hover sets `activePointIndex` → FlightMap2D shows highlighted marker; chart shows blue reference line

### 3.3 Flight Analysis Page

- [x] **Create `frontend/src/pages/FlightAnalysis.tsx`**
  - Route: `/flights/:id`
  - Sections: score summary | 2D/3D toggle | FlightMap2D | FlightCharts | PhaseTimeline | FlightEventsList | notes
  - Bidirectional linking: chart hover ↔ map highlight via shared `activePointIndex` state
  - Event click → scrolls map to event location

- [x] **Route exists in `App.tsx`**:
  ```tsx
  <Route path="/flights/:id" element={<ProtectedRoute><FlightAnalysis /></ProtectedRoute>} />
  ```

- [x] **Create `frontend/src/components/Flights/FlightEventsList.tsx`**
  - List of detected events with timestamp, type, icon, payload details, confidence indicator
  - Click event → highlight on map + chart via `activeEventId` state

- [x] **Create `frontend/src/components/Flights/PhaseTimeline.tsx`**
  - Horizontal colour-coded bar with hover tooltips per phase
  - Legend with phase name + duration below the bar

---

## Phase 4 — 3D Viewer
> Goal: Three-dimensional flight path visualization with playback.

### 4.1 3D Rendering

- [x] **Add `maplibre-gl`, `deck.gl`, `@deck.gl/react`, `@deck.gl/layers`** to frontend dependencies
  - Use `PathLayer` or `TripsLayer` for flight path
  - Use MapLibreGL as base map for the 3D view
  - _Installed: maplibre-gl ^5.x, @deck.gl/core|react|layers ^9.x, react-map-gl ^8.x_

- [x] **Create `frontend/src/components/Flights/FlightViewer3D.tsx`**
  - 3D path rendered with altitude as Z axis
  - Camera modes: orbit | follow | free
  - Time scrubber for playback animation
  - Event markers in 3D space
  - Multi-flight: each pilot in different color

- [x] **Abstract viewer interface**: `FlightViewerProps` shared between `FlightMap2D` and `FlightViewer3D`
  - Defined in `frontend/src/components/Flights/flight-viewer.types.ts`
  - `FlightMap2DProps` is now a type alias of `FlightViewerProps`
  - Design for future CesiumJS swap-in

- [x] **2D/3D toggle button** in `FlightAnalysis.tsx`
  - `FlightViewer3D` is lazy-loaded (deck.gl kept out of initial bundle)

---

## Phase 5 — Leaderboards & Pilot Progress
> Goal: Pilots can track improvement; leaderboards are visible.

### 5.1 Pilots API

- [x] **`GET /pilots`** — list all pilots
- [x] **`POST /pilots`** — create pilot
- [x] **`GET /pilots/:id`** — pilot profile
- [x] **`PATCH /pilots/:id`** — update pilot
- [x] **`GET /pilots/:id/performance`** — recent flights, score trends, personal bests

### 5.2 Leaderboard API

- [x] **`GET /leaderboards`** — configurable leaderboard
  - Query params: `category` (landing|takeoff|overall|level|turn|climb|smoothness|most_improved), `period` (alltime|30d|season), `site_id?`
  - Returns ranked pilot entries with top flight for that category

- [x] **`POST /flights/compare`**
  - Body: `{ flight_ids: string[] }`
  - Returns normalized comparison data for selected flights

### 5.3 Frontend – Leaderboard Page

- [x] **Create `frontend/src/pages/Leaderboards.tsx`**
  - Route: `/leaderboards`
  - Category tabs + period filter
  - Ranked table: rank | pilot | score | flight date | site
  - Click pilot → pilot detail page
  - Click score → flight analysis page

- [x] **Add Leaderboards to navigation** (bottom nav bar on mobile, header on desktop)

### 5.4 Frontend – Pilot Performance Page

- [x] **Create `frontend/src/pages/PilotPerformance.tsx`**
  - Route: `/pilots/:id`
  - Recent flights list
  - Score trend chart (overall over time)
  - Per-category trend charts
  - Personal bests cards
  - Rolling 30-day average vs. group average

### 5.5 Frontend – Pilot Selector

- [x] **Create `frontend/src/components/Flights/PilotSelect.tsx`**
  - Reusable autocomplete for pilot selection
  - Used in upload modal and edit modal
  - Create new pilot inline if not found
  - _Note: inline pilot create already implemented inside `FlightUploadModal.tsx`_

### 5.6 Multi-Flight Comparison

- [x] **Create `frontend/src/pages/FlightComparison.tsx`**
  - Route: `/flights/compare?ids=id1,id2,...`
  - Side-by-side summary stats cards
  - Overlay paths on shared map
  - Synchronized charts (normalized to "time since takeoff")
  - Score comparison bar chart

---

## Data Model Summary

### New Tables
| Table | Purpose |
|-------|---------|
| `pilots` | Lightweight pilot identity for leaderboards |
| `flights` | Core GPX flight record + summary metrics |
| `flight_events` | Detected in-flight events (takeoff, landing, etc.) |
| `flight_scores` | Versioned scoring results per flight |

### Existing Tables – No Breaking Changes
| Table | Change |
|-------|--------|
| `media` | None — flights are separate; link by `flight_date` |
| `flight_sites` | None — flights reference `site_id` optionally |
| `users` | Add `storage_used` increment logic for GPX files |

---

## API Endpoints Summary

| Method | Path | Description |
|--------|------|-------------|
| POST | `/flights` | Upload GPX file |
| GET | `/flights?date=` | List flights for a date |
| GET | `/flights/:id` | Flight detail |
| GET | `/flights/:id/analysis` | Score + events + coaching |
| GET | `/flights/:id/file` | Stream raw GPX file |
| POST | `/flights/:id/reanalyze` | Re-run analysis |
| PATCH | `/flights/:id` | Update metadata |
| DELETE | `/flights/:id` | Delete |
| POST | `/flights/compare` | Compare multiple flights |
| GET | `/pilots` | List pilots |
| POST | `/pilots` | Create pilot |
| GET | `/pilots/:id` | Pilot profile |
| PATCH | `/pilots/:id` | Update pilot |
| GET | `/pilots/:id/performance` | Pilot stats + trends |
| GET | `/leaderboards` | Ranked leaderboard |

---

## New Frontend Files

```
frontend/src/
├── pages/
│   ├── FlightAnalysis.tsx
│   ├── FlightComparison.tsx
│   ├── Leaderboards.tsx
│   └── PilotPerformance.tsx
├── components/Flights/
│   ├── FlightCard.tsx
│   ├── FlightCharts.tsx
│   ├── FlightEventsList.tsx
│   ├── FlightMap2D.tsx
│   ├── FlightScoreCard.tsx
│   ├── FlightsSection.tsx
│   ├── FlightUploadButton.tsx
│   ├── FlightUploadModal.tsx
│   ├── FlightViewer3D.tsx
│   ├── CoachingNotes.tsx
│   ├── PhaseTimeline.tsx
│   ├── PilotSelect.tsx
│   └── FlightMetadataForm.tsx
├── services/
│   ├── flights.service.ts
│   ├── pilots.service.ts
│   └── leaderboards.service.ts
└── hooks/
    ├── useFlights.ts
    ├── usePilots.ts
    └── useLeaderboards.ts
```

---

## New Backend Files

```
backend/src/
├── flights/
│   ├── flights.module.ts
│   ├── flights.controller.ts
│   ├── flights.service.ts
│   ├── flight-analysis.service.ts
│   ├── gpx-parser.service.ts
│   ├── gpx-normalizer.service.ts
│   ├── dto/
│   │   ├── create-flight.dto.ts
│   │   ├── update-flight.dto.ts
│   │   └── flight-response.dto.ts
│   └── analysis/
│       ├── phase-detector.ts
│       ├── event-detector.ts
│       ├── confidence.ts
│       └── scoring/
│           ├── scoring-config.ts
│           ├── scoring-version.ts
│           ├── flight-scorer.ts
│           ├── takeoff-scorer.ts
│           ├── climb-scorer.ts
│           ├── level-scorer.ts
│           ├── turn-scorer.ts
│           ├── descent-scorer.ts
│           ├── landing-scorer.ts
│           ├── smoothness-scorer.ts
│           ├── safety-scorer.ts
│           └── coaching-templates.ts
└── pilots/
    ├── pilots.module.ts
    ├── pilots.controller.ts
    ├── pilots.service.ts
    └── dto/
        ├── create-pilot.dto.ts
        └── update-pilot.dto.ts
```

---

## New Dependencies

### Backend (`backend/package.json`)
```json
"fast-xml-parser": "^4.x",     // GPX/XML parsing
"@turf/turf": "^6.x"           // Geospatial calculations (distance, bearing, etc.)
```

### Frontend (`frontend/package.json`)
```json
"recharts": "^2.x",            // Charts (altitude, speed, score breakdown)
"maplibre-gl": "^4.x",         // Map base for 3D viewer (Phase 4)
"@deck.gl/core": "^9.x",       // 3D path rendering (Phase 4)
"@deck.gl/react": "^9.x",
"@deck.gl/layers": "^9.x"
```

---

## New Environment Variables

Add to `.env.example` and `docker-compose.yml`:
```env
# GPX / Flight Analysis
MAX_GPX_UPLOAD_SIZE=52428800        # 50MB default
ANALYSIS_SCORING_VERSION=1.0
MAPTILER_API_KEY=                   # Optional: for MapLibre terrain tiles (Phase 4)
CESIUM_ION_TOKEN=                   # Optional: future 3D globe mode
```

---

## Security Checklist

- [x] Validate uploaded file is valid XML before parsing (prevent XML bomb / entity expansion)
- [x] Sanitize `original_filename` before storing in DB
- [x] Prevent path traversal in storage key generation (use UUID prefix)
- [x] Enforce `MAX_GPX_UPLOAD_SIZE`
- [ ] Restrict GPX file access to authenticated users (token-based like media)
  - _Currently protected by `JwtAuthGuard`; short-lived token system (like `MediaTokenGuard`) not yet implemented_
- [ ] Admin guard on bulk `reanalyze` endpoints
  - _Per-flight reanalyze endpoint added in Phase 2; bulk admin guard deferred to Phase 5_

---

## Testing

### Backend Unit Tests
- [ ] `gpx-parser.service.spec.ts` — valid, malformed, multi-track, missing elevation
- [ ] `gpx-normalizer.service.spec.ts` — coordinate validation, speed computation, noise filtering
- [ ] `phase-detector.spec.ts` — phase transitions on sample trackpoints
- [ ] `event-detector.spec.ts` — takeoff/landing/events detected correctly
- [ ] `flight-scorer.spec.ts` — score range, coaching note generation
- [ ] `confidence.spec.ts` — confidence scoring for sparse/dense/noisy data

### Backend Integration Tests
- [ ] `flights.controller.spec.ts` — upload, list, analyze, delete flow
- [ ] `pilots.controller.spec.ts` — CRUD and performance endpoint

### Frontend Tests
- [ ] `FlightUploadModal` — file selection, metadata form, upload progress
- [ ] `FlightCard` — status badges render correctly
- [ ] `FlightCharts` — renders without crashing with sample data
- [ ] `Leaderboards` — filter UI, sorted rows

### GPX Fixtures (`backend/test/fixtures/gpx/`)
- [ ] `normal_flight.gpx` — complete flight with elevation and timestamps
- [ ] `sparse_gpx.gpx` — low point density
- [ ] `noisy_gpx.gpx` — GPS jumps and noise
- [ ] `short_hop.gpx` — aborted launch or touch-and-go
- [ ] `multi_segment.gpx` — GPX with multiple trk/trkseg elements
- [ ] `no_elevation.gpx` — elevation element absent
- [ ] `no_timestamps.gpx` — time element absent

---

## Migration & Backward Compatibility

- [x] All new migrations: `addColumn`/`createTable` only — no modification of existing tables
- [x] `flight_date` links flights to media days without foreign key (no coupling)
- [x] Existing media routes and components remain untouched
- [x] Existing `DailyGallery` photos/videos tab unaffected by Flights tab addition
- [ ] Run `npm run migration:run` in CI to validate migration chain

---

## Observability

- [x] Structured log on parse start/complete/fail: `{ flightId, filename, duration_ms, trackpointCount }`
- [x] Structured log on analysis start/complete/fail: `{ flightId, scoringVersion, duration_ms }`
- [x] Store `analysis_version` on `Flight` to allow future reanalysis detection
- [x] Score calculation must be deterministic: same input always produces same output

---

## Documentation

- [ ] `docs/gpx-analysis-architecture.md` — module overview, data flow
- [ ] `docs/scoring-model.md` — scoring categories, weights, threshold table
- [ ] `docs/heuristics.md` — all phase/event detection heuristics documented
- [x] Update `.env.example` with new variables
- [ ] Update `README.md` with new routes and features

---

## Definition of Done

- [x] User can upload GPX on a flight day
- [x] Flights are parsed, normalized, and stored
- [x] Analysis engine runs and produces scores + coaching notes
- [x] Flight analysis page shows 2D map, charts, events, scores
- [x] Multiple flights can be compared on map and in charts
- [x] Leaderboards show ranked pilots by category
- [x] Pilot progress page shows trend over time
- [x] Existing photo/video album functionality unchanged
- [ ] All unit tests for analysis engine pass
- [x] Docker local dev still works (`docker compose up`)
- [ ] Security checklist complete
