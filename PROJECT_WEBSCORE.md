# PROJECT.md

## Project Title
Paramotor Album + GPX Flight Analysis Extension

## Purpose
Extend the existing **ALBUM** feature of the current paramotor weather/map web application so users can upload **GPX flight logs** on flight-day calendar entries alongside photos and videos. The new capability must analyze flights, visualize them in 2D and 3D, score pilot performance over time, and create meaningful feedback and leaderboards that help pilots improve their flying.

This is **not a greenfield app**. Claude must integrate the new capability into the **existing codebase**, preserve the current architecture and conventions where reasonable, and avoid unnecessary rewrites.

---

## Core Goals

1. Add GPX upload support to the existing Album / Flight Day workflow.
2. Parse and normalize GPX tracks into a robust backend data model.
3. Visualize single or multiple flights on a map and in 3D.
4. Analyze flights and score:
   - Takeoff
   - Climb / ascent profile
   - Level flight stability
   - Turns / smoothness / coordination proxies
   - Descents
   - Landing / flare quality proxies
5. Support comparison across:
   - A single pilot over time
   - Multiple pilots on the same day
   - Multiple pilots across many days
6. Add leaderboards and pilot trend reporting.
7. Fit naturally into the existing Album UX and data model.
8. Keep the system extensible for future analytics and sensor support.

---

## Existing App Context
Claude should assume the existing app already has:
- React frontend
- TypeScript across frontend and backend where possible
- Existing Album feature with calendar-based flight days
- Existing image/video upload and browsing workflows
- Existing map/weather-centric UI
- Existing Docker / docker-compose deployment patterns
- Existing persistence and API layers

Claude must inspect the current codebase and integrate into the existing:
- routing
- component structure
- styling system
- API conventions
- database patterns
- authentication / authorization model if one exists
- upload/storage conventions
- environment variable patterns
- logging/error handling/testing conventions

Do not replace working album/media functionality. Extend it.

---

## High-Level Product Requirements

### 1. Flight Day Integration
On each existing Album flight day, users should be able to:
- upload one or more GPX files
- see uploaded GPX files listed with metadata
- associate uploaded GPX files to a pilot
- optionally enter notes/title/launch site/glider/wing/trike metadata
- open a flight analysis view from the flight-day page

The flight day becomes a container for:
- photos
- videos
- GPX files
- per-flight analytics
- multi-flight comparisons for that day

### 2. GPX Ingestion
The system must:
- accept `.gpx` uploads
- validate structure and reject malformed files gracefully
- extract trackpoints, timestamps, elevation, and any metadata available
- support GPX files with one or multiple tracks/segments
- normalize coordinates and timestamps
- compute derived metrics
- persist raw file + parsed data + derived summaries

### 3. Analysis
Compute meaningful pilot-focused metrics from the GPX data. Since GPX is imperfect and typically lacks direct airspeed / attitude / engine telemetry, analysis must distinguish between:
- **measured values** derived directly from GPX
- **estimated / inferred values** derived heuristically

The UI must clearly label estimates.

### 4. Visualization
Provide:
- 2D map flightpath overlay
- 3D flight path playback / inspection over terrain or map
- single-flight view
- multi-flight comparison view
- synchronized metrics / events panel
- event markers for detected takeoff, landing, steep climb, max descent, etc.

### 5. Performance & Training
Provide pilot feedback with:
- flight score
- category scores
- event-based coaching notes
- trend history
- leaderboards

The scoring system must be transparent and explainable, not arbitrary.

---

## Recommended Technology Direction
Claude should prefer the app's current stack first, and introduce new libraries only where they strongly improve this feature.

### Frontend
Use existing frontend stack and add where needed:
- React
- TypeScript
- existing UI library / styling approach already present in app
- existing state/query layer already in app

### Backend
Use existing backend approach already present in app. Prefer:
- Node/TypeScript if current app already uses it
- existing API style (REST or similar)
- existing ORM / query style

### Database
Use the app's existing DB. If it already uses PostgreSQL, extend it cleanly.
Recommended additions:
- JSONB for raw/derived analysis payloads where flexible structure helps
- PostGIS if spatial queries or indexing are needed and not already present

### Storage
Reuse current media storage pattern if possible:
- local filesystem / mounted volume if that is how album media is stored
- or object storage abstraction if the app already has one

GPX files should be stored similarly to media files, but tagged by type.

### 3D Visualization Recommendation
Recommended implementation order:
1. **Phase 1**: 2D map overlay and altitude profile
2. **Phase 2**: 3D path rendering using the web stack

Recommended options:
- **MapLibre GL JS** for map rendering and terrain-capable 2D/3D map usage citeturn600641search2turn600641search14
- **deck.gl** for path/trip rendering layers and time-based flight playback overlays citeturn600641search5turn600641search9turn600641search1
- **CesiumJS** if a true globe/terrain-centric 3D experience is desired for advanced mode or later phase citeturn600641search0turn600641search8turn600641search16

Practical recommendation:
- Build the first implementation with **MapLibre + deck.gl** because it should integrate more naturally into an existing React web app.
- Design the rendering abstraction so a later **CesiumJS** viewer can be added without changing analysis logic.

### Geospatial Analysis Libraries
Recommended:
- **Turf.js** for geospatial calculations and derived GeoJSON workflows citeturn600641search3turn600641search7turn600641search11

### GPX Parsing
Use a robust TypeScript-compatible GPX/XML parsing strategy appropriate to the current backend/frontend setup.
Preferred pattern:
- server-side parsing on upload
- normalized internal representation stored in DB
- avoid parsing large GPX files repeatedly on the client

---

## Architecture Requirements

Claude should implement this as a modular extension with clear boundaries:

### Suggested Modules
- `album-gpx-upload`
- `flight-ingestion`
- `flight-analysis-engine`
- `flight-visualization`
- `pilot-performance`
- `leaderboards`

### Separation of Concerns
1. **Raw ingestion layer**
   - file validation
   - XML/GPX parsing
   - raw extraction

2. **Normalization layer**
   - timestamps
   - coordinates
   - elevation
   - track segmentation
   - deduplication / smoothing

3. **Analysis engine**
   - derive metrics
   - detect phases/events
   - compute scores
   - generate coaching notes

4. **Presentation layer**
   - map/3D/path playback
   - charts
   - scorecards
   - comparisons
   - leaderboards

Keep analysis logic out of UI components.

---

## Functional Requirements

## A. Upload & File Management

### User Stories
- As a pilot, I can upload a GPX file to a specific flight day.
- As a pilot, I can see all GPX uploads for that day.
- As a pilot, I can edit metadata for a flight.
- As a pilot, I can delete or replace an uploaded GPX file.
- As a viewer, I can distinguish GPX items from photos/videos.

### Requirements
- Add an upload control in the Album flight-day interface.
- Support drag-and-drop and file picker upload.
- Display parsing/processing status:
  - uploaded
  - parsing
  - analyzed
  - failed
- On failure, show actionable error messages.
- Support one or many GPX files per day.
- Allow linking a GPX file to a pilot profile if such profiles already exist.
- If no pilot profile system exists, create a lightweight pilot identity model suitable for leaderboards.

---

## B. Flight Data Model
Each uploaded GPX-derived flight should persist:

### Core Fields
- flight id
- flight day id
- pilot id
- original filename
- uploaded file path / storage key
- upload timestamp
- parsed status
- analysis version

### Flight Metadata
- launch site name (optional/manual)
- landing site name (optional/manual)
- glider/wing (optional)
- harness/trike type (optional)
- notes/title/description
- timezone

### Derived Summary Metrics
- start time
- end time
- duration
- total distance
- max altitude AMSL
- min altitude AMSL
- altitude gain/loss
- average groundspeed
- max groundspeed
- vertical speed stats
- trackpoint count
- segment count
- bounding box

### Raw/Structured Data
- normalized trackpoints
- detected phases
- detected events
- analysis payload
- scoring payload
- visualization-ready geometry

Store raw points efficiently. Consider a separate trackpoint table or compressed JSON representation depending on scale.

---

## C. Flight Analysis Engine
The system must analyze the GPX and break the flight into phases.

### Required Phase Detection
- pre-takeoff / ground roll if inferable
- takeoff
- initial climb
- climb segments
- level/cruise segments
- turning segments
- descending segments
- approach
- landing
- post-landing taxi/ground movement if inferable

### Event Detection
Detect and persist events such as:
- takeoff point
- landing point
- maximum altitude
- maximum climb rate
- maximum descent rate
- maximum groundspeed
- longest sustained level flight
- largest turn rate / bank proxy event
- unusually abrupt altitude/speed changes
- possible launch abort / touch-and-go if inferable

### Derived Analytics
At minimum compute:
- distance traveled
- speed over ground per point/segment
- vertical speed per point/segment
- smoothed heading changes
- turn radius proxy
- stability metrics
- glide/efficiency approximations where possible
- time in climb / cruise / descent
- takeoff roll proxy if inferable from ground segment
- landing vertical speed near touchdown
- flare proxy near landing based on descent-rate arrest

### Important Constraint
Because GPX does not provide all flight dynamics, Claude must not pretend to measure values that cannot be known directly.
Any metric based on inference must be labeled as:
- estimated
- heuristic
- confidence scored

### Confidence
For each flight analysis, compute a confidence level based on:
- point density
- timestamp continuity
- GPS noise
- missing elevation data
- unrealistic jumps

---

## D. Scoring Model
The scoring system must be explainable and tunable.

### Overall Flight Score
Provide:
- overall score (0-100)
- sub-scores
- confidence indicator
- textual explanation of what improved or reduced the score

### Required Sub-Scores
- takeoff score
- climb management score
- level flight score
- turn smoothness/control score
- descent management score
- landing score
- consistency/smoothness score
- flight discipline/safety proxy score

### Scoring Principles
- deterministic and documented
- versioned so future improvements do not corrupt historical comparisons
- configurable through constants or admin config
- designed to avoid over-penalizing noisy consumer GPS data
- normalized for different flight lengths where sensible

### Coaching Output
Generate comments such as:
- “Landing descent rate remained high close to touchdown.”
- “Level flight showed consistent altitude control for 6m 32s.”
- “Turns during mid-flight were smoother than your 30-day average.”

These should be template-driven from analytics, not LLM-generated at runtime.

---

## E. Leaderboards & Progress Tracking

### Leaderboards
Support leaderboards for:
- best landing scores
- best takeoff scores
- best all-round flight score
- most improved pilot (rolling window)
- longest stable level flight
- smoothest turn performance
- best climb efficiency proxy

### Filters
- all time
- last 30 days
- season
- specific launch site
- specific pilot group / club if applicable later

### Pilot Progress
Each pilot should have a progress view with:
- recent flights
- score trends over time
- category trends over time
- personal bests
- rolling averages
- comparisons against own history
- comparison against group average

---

## F. Visualization Requirements

### 2D View
- render flight path on the existing map context where possible
- start/end markers
- event markers
- color by altitude, speed, or phase
- hover/click tooltips
- optional playback scrubber

### 3D View
- render flight path with altitude in 3D
- terrain-aware or pseudo-3D map mode
- camera orbit / follow / free mode
- time scrubber
- event markers or timeline events
- compare one or several pilots

### Supporting Charts
Add linked charts such as:
- altitude over time
- speed over time
- vertical speed over time
- phase timeline
- score breakdown

Interaction goal:
clicking on chart sections should highlight the corresponding path segment on the map/3D viewer.

---

## G. Multi-Pilot / Multi-Flight Comparison
Support:
- overlay multiple pilots on one day
- compare two flights from the same pilot across dates
- compare summary metrics in cards/charts/tables
- synchronize playback if timestamps make sense
- normalize playback by “time since takeoff” for comparison mode

---

## Non-Functional Requirements

### Performance
- Handle reasonably large GPX uploads without locking the UI.
- Server-side analysis should be asynchronous from the request lifecycle if needed, but integrated cleanly into the app.
- The UI should show processing states.
- Use caching or precomputed summary payloads for heavy views.

### Reliability
- Invalid GPX should not crash processing.
- Corrupt or partial files should be isolated and recoverable.
- Analysis failures should be logged with enough diagnostic detail.

### Maintainability
- Strong TypeScript typing across DTOs, domain objects, and analysis outputs.
- Analysis logic should be unit tested.
- Scoring thresholds should be centralized and documented.
- Version analysis outputs.

### Security
- Validate uploaded file type and size.
- Sanitize filenames.
- Prevent path traversal.
- Enforce upload limits and safe storage handling.
- Respect the app's existing auth model.

---

## Suggested Data Model Changes
Claude should adapt these to the existing schema conventions.

### New / Extended Tables

#### `pilots`
If not already present:
- id
- display_name
- slug
- avatar_url (optional)
- created_at
- updated_at

#### `flight_days` (existing)
Extend if needed but do not break existing album relations.

#### `album_media` (existing)
If a unified media model already exists, consider extending it with a new media type:
- `photo`
- `video`
- `gpx`

If the current design makes this awkward, create a dedicated `flight_files` or `flight_uploads` table.

#### `flights`
- id
- flight_day_id
- pilot_id
- media_id or upload_id
- title
- notes
- source_filename
- storage_key
- parse_status
- analysis_status
- analysis_version
- start_at
- end_at
- duration_seconds
- total_distance_m
- max_altitude_m
- min_altitude_m
- avg_speed_mps
- max_speed_mps
- max_climb_mps
- max_descent_mps
- bbox_json
- confidence_score
- summary_json
- created_at
- updated_at

#### `flight_trackpoints`
Only if needed for queryability/performance:
- id
- flight_id
- seq
- timestamp
- lon
- lat
- elevation_m
- speed_mps
- vertical_speed_mps
- heading_deg
- phase
- flags_json

Or use compressed JSONB if that better suits the current architecture.

#### `flight_events`
- id
- flight_id
- event_type
- timestamp
- seq_start
- seq_end
- lon
- lat
- elevation_m
- confidence
- payload_json

#### `flight_scores`
- id
- flight_id
- scoring_version
- overall_score
- takeoff_score
- climb_score
- level_score
- turn_score
- descent_score
- landing_score
- smoothness_score
- safety_score
- explanation_json
- created_at

#### `pilot_leaderboard_snapshots` (optional)
Only if needed for performance/caching.

---

## API Requirements
Claude should follow the current app's API style.

### Suggested Endpoints / Actions
- upload GPX to flight day
- list GPX flights for a flight day
- get flight details
- get flight analysis
- re-run analysis
- update flight metadata
- delete flight
- get pilot history
- get leaderboard(s)
- compare flights

### Example Capabilities
- `POST /flight-days/:id/gpx`
- `GET /flight-days/:id/flights`
- `GET /flights/:id`
- `GET /flights/:id/analysis`
- `POST /flights/:id/reanalyze`
- `GET /leaderboards`
- `GET /pilots/:id/performance`
- `POST /flights/compare`

Adjust naming to current codebase conventions.

---

## UI / UX Requirements

### Album Integration
In the Album day view:
- show a new GPX section or media-type tabs
- preserve the current photo/video experience
- allow quick upload of GPX files alongside existing media workflows
- show per-flight cards with summary stats and quick actions

### Flight Card
Each uploaded GPX file should show:
- pilot
- filename / title
- duration
- distance
- max altitude
- overall score
- status badge
- buttons: View Analysis, Compare, Edit, Delete

### Flight Analysis Page / Panel
Include:
- score summary
- coaching notes
- 2D/3D viewer toggle
- metric charts
- detected events list
- phase breakdown
- confidence indicators

### Leaderboard UI
- compact but visually engaging
- sortable/filterable
- click pilot for detail page
- click score to inspect the flight(s) that contributed

### Design
Use the app's existing look and feel.
The UX should feel like a natural extension of the Album, not a separate product.

---

## Analysis Heuristics Guidance
Claude should implement a first-pass analysis system that is practical, documented, and easy to improve.

### Example Heuristics
These are examples, not rigid formulas.

#### Takeoff Detection
Infer from:
- start of sustained movement
- transition from low altitude / ground-speed variability to sustained climb
- reduction in ground contact-like behavior

#### Landing Detection
Infer from:
- final sustained descent
- transition to near-ground elevation and reduced speed
- low or zero movement after touchdown

#### Flare Proxy
Estimate from:
- reduction in descent rate shortly before touchdown
- smoothing of sink rate in final segment
- final groundspeed change pattern

#### Level Flight Quality
Measure with:
- low altitude variance over sustained windows
- smooth heading/speed changes
- absence of abrupt oscillations

#### Turn Quality
Measure with:
- smooth heading change over time
- consistency of turn radius proxy
- stability of altitude through turns

#### Climb/Descent Quality
Measure with:
- smoothness
- consistency
- absence of abrupt spikes unless clearly noise

All heuristics must be configurable and documented in code.

---

## Implementation Strategy
Claude should implement incrementally.

### Phase 1 - Foundation
- add GPX upload to Album flight day
- parse and store GPX
- save summary metrics
- show flights list in flight day view

### Phase 2 - Basic Analysis
- derive core metrics
- detect takeoff / landing / climb / level / turn / descent segments
- compute first-pass scores
- show score cards and simple charts

### Phase 3 - Visualization
- 2D map overlays
- event markers
- linked charts
- comparison mode

### Phase 4 - 3D Viewer
- 3D path rendering
- playback timeline
- multi-flight comparison in 3D

### Phase 5 - Leaderboards & Trends
- pilot profile / stats pages
- leaderboards
- rolling improvement metrics

Claude may implement all phases in one codebase pass, but the architecture should support staged delivery.

---

## Migration & Backward Compatibility
- Existing album photos/videos must continue to work unchanged.
- Existing flight-day entries must remain valid.
- DB migrations must be safe and reversible.
- If introducing a new pilot model, provide a migration/seed/backfill strategy.
- If old album items can be associated with pilots later, design for it but do not block the core feature.

---

## Testing Requirements

### Unit Tests
Cover:
- GPX parsing
- normalization
- phase detection
- scoring logic
- edge cases with noisy or sparse GPS data

### Integration Tests
Cover:
- upload flow
- DB persistence
- API responses
- reanalysis flow
- leaderboard calculations

### Frontend Tests
Cover:
- upload UI
- analysis cards
- charts/view toggles
- leaderboard filters

### Fixture Data
Include sample GPX fixtures for:
- normal flight
- sparse GPX
- noisy GPX
- short hop / aborted launch
- multi-segment file
- multi-pilot day comparison

---

## Observability & Ops
- Add structured logging around parse/analyze stages.
- Record analysis duration and failure reason.
- Version the analysis engine.
- Make score calculation reproducible.
- Add feature flags if the current app uses them.

---

## Deliverables Claude Should Produce
Claude should generate or modify code to provide:

1. Database migrations
2. Backend models / services / controllers / routes
3. GPX parser + normalization pipeline
4. Analysis engine with scoring
5. Album UI updates for GPX upload/listing
6. Flight analysis pages/components
7. 2D and initial 3D visualization support
8. Leaderboard pages/components
9. Tests
10. Documentation

---

## Required Documentation
Claude should also create:
- architecture notes for the new GPX/analysis subsystem
- scoring model documentation
- environment variable documentation
- developer setup notes
- future extension notes

---

## Environment Variables (suggested)
Only add what is necessary and match current project naming conventions.
Possible additions:
- media/flight upload base path
- max GPX upload size
- analysis worker concurrency
- map provider config
- terrain / tiles provider config if needed
- optional Cesium token if advanced 3D mode is enabled

Do not introduce unnecessary secrets.

---

## Future-Proofing
Design so the system can later support:
- IGC file ingestion
- device telemetry merging
- weather overlay at flight time
- launch/landing site intelligence
- club events / competitions
- badges/achievements
- AI-generated coaching summaries later
- video sync with GPX playback

The first implementation must not depend on these future features, but should not block them.

---

## Coding Guidance for Claude
- Inspect the existing album/media implementation first.
- Follow established naming and patterns unless there is a strong reason not to.
- Keep components and services small and well typed.
- Prefer pure functions for analytics/scoring.
- Document assumptions in code comments where GPX heuristics are used.
- Never present inferred metrics as precise truths.
- Keep the UI modern, clean, and map-centric.
- Avoid overengineering, but leave clear extension points.

---

## Definition of Done
This feature is complete when:
- a user can upload GPX files on an Album flight day
- flights are parsed and stored reliably
- users can open analysis for a single flight
- users can compare multiple flights/pilots
- the app displays useful, explainable scores
- leaderboards work
- existing album functionality remains intact
- tests pass
- docker-based local development still works

---

## Final Instruction to Claude
Build this as an extension of the existing codebase, centered on the **ALBUM** feature and its flight-day pages. Reuse the current app's technology and patterns wherever practical. Add only the minimum necessary new dependencies. Prioritize maintainability, explainable analysis, and a polished user experience for paramotor pilots reviewing and improving their flights.
