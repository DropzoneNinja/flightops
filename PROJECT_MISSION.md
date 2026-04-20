# MISSION.md

## Feature Name
Mission Planner

## Purpose
Add a full mission planning system to the existing **flightops** application so that users can create, edit, search, and manage **multiple named missions** for each flight site, instead of the current single planning path per launch site.

This feature replaces the current legacy node/path planning model with a reusable, searchable, mission-based system.

---

## Product Context
The existing `flightops` app already documents:
- flight / launch sites
- weather
- photo album
- simple flight plots

At present, only **one flight planning path per launch site** is allowed.
That limitation must be removed.

The new system must:
- support **any number of missions**
- allow missions to be optionally associated with a launch site
- support **named, searchable missions**
- support **notes / mission description**
- allow the user to **plot a mission path directly on the map**
- allow the user to **drag and reposition points/nodes after placement**
- preserve current useful path behaviors such as **time between nodes** and related plot calculations
- fully **decommission the current single-node/path planning system**

---

## High-Level Requirements

### Core Functional Requirements
1. A user can create **multiple missions**.
2. Each mission has:
   - `name` (required)
   - `notes` (optional, long text)
   - `launchSiteId` (optional foreign key to an existing launch site)
   - `path` / route composed of ordered nodes / waypoints
3. A mission can exist:
   - attached to a launch site, or
   - independently of any launch site
4. Users can search missions by:
   - name
   - notes (nice to have)
   - associated launch site
5. Users can create a mission route by clicking on the map to add nodes.
6. Users can drag-and-drop an existing node to a new location.
7. Users can reorder or delete nodes.
8. Existing mission plot calculations (for example time between nodes, segment details, totals) should continue to work in the new mission planner.
9. The legacy “single path per launch site” implementation must be removed from the UI and backend once migration is complete.

---

## User Experience Requirements

### Mission List / Discovery
Create a mission planner experience with the following views:

#### 1. Mission Browser
A dedicated mission screen or mission panel where users can:
- browse all missions
- filter by launch site
- search by mission name
- sort by recently updated, alphabetically, and optionally by launch site
- create a new mission

#### 2. Mission Detail / Editor
A mission editor page or panel where the user can:
- edit mission name
- edit notes
- associate or disassociate a launch site
- edit the plotted route on the map
- see route statistics
- save changes
- duplicate an existing mission
- delete a mission

#### 3. Embedded Launch Site Integration
When viewing a launch site, users should be able to:
- see missions associated with that site
- open an existing mission
- create a new mission pre-associated with that site

---

## Map Interaction Requirements

### Route Creation
In the mission editor, the map should support:
- click on map → create a new node at that position
- each node is added in sequence to the mission path
- polyline updates immediately as points are added
- segment metrics recalculate live after changes

### Route Editing
The user must be able to:
- drag a node marker to a new location
- delete a node
- insert a node between existing nodes (preferred)
- move node order up/down in a waypoint list (preferred)
- optionally click a segment to insert a node on that segment (nice to have)

### Node / Waypoint Behavior
Each waypoint should store at least:
- sequence index
- latitude
- longitude
- optional altitude field (future-friendly; can be nullable)
- optional dwell / planned timing data if the current plot system already supports it
- metadata required for time-between-nodes calculations

### Visual Display
The map should visually distinguish:
- mission path polyline
- waypoint markers
- selected waypoint
- launch site location if linked

Add a waypoint sidebar/table if practical, showing:
- waypoint order
- coordinates
- distance from previous point
- estimated time from previous point
- cumulative distance / time

---

## Functional Detail

### Mission Entity
Suggested mission fields:
- `id`
- `name`
- `notes`
- `launchSiteId` (nullable)
- `createdBy` (if the app already tracks ownership; otherwise omit)
- `createdAt`
- `updatedAt`
- `deletedAt` (optional, if soft delete is used)

### Mission Waypoint Entity
Suggested waypoint fields:
- `id`
- `missionId`
- `sortOrder`
- `latitude`
- `longitude`
- `altitude` (nullable)
- `plannedSpeed` or equivalent if current system uses speed/time derivation
- `legMinutes` or equivalent if current system stores time to next node
- `createdAt`
- `updatedAt`

Use the existing plot calculation logic wherever possible, but refactor it into reusable services/utilities rather than leaving it coupled to the old launch-site path model.

---

## Migration / Legacy Decommissioning
The current node system is to be decommissioned.

Claude should:
1. Identify the current data structures, API routes, UI components, and database tables tied to the existing **single path per launch site** approach.
2. Refactor or replace them with the mission-based system.
3. Migrate existing data where practical:
   - If a launch site currently has a legacy path, create a new mission automatically for that site.
   - Suggested migrated mission name: `Default Mission` or `<Launch Site Name> Mission 1`
4. Ensure existing routes / plots are not silently lost during upgrade.
5. Remove or retire old UI flows that assume a single path per launch site.
6. Add a migration script and document rollback assumptions.

### Migration Expectations
If legacy data exists:
- every old site path should become a mission
- migrated missions should remain editable in the new planner
- no frontend area should continue writing to the deprecated model after cutover

---

## Search Requirements
Mission search should support:
- exact / partial name matching
- filtering by associated launch site
- optional text search over notes

Search should be available:
- on the global mission browser
- optionally from within a launch site detail page

If the existing app already has a search framework, integrate with it.

---

## Backend Requirements
Claude should implement the full backend support required for missions.

### API Expectations
Create or adapt endpoints roughly along these lines:
- `GET /api/missions`
- `POST /api/missions`
- `GET /api/missions/:id`
- `PUT /api/missions/:id`
- `DELETE /api/missions/:id`
- `POST /api/missions/:id/waypoints`
- `PUT /api/missions/:id/waypoints/:waypointId`
- `DELETE /api/missions/:id/waypoints/:waypointId`
- optional batch reorder endpoint

The final route structure can match the project conventions, but the feature must support:
- CRUD for missions
- CRUD for waypoints
- search / filtering
- validation
- migration from old schema

### Validation Rules
At minimum:
- mission name required
- mission name length reasonable (e.g. 1–120 chars)
- notes optional
- coordinates must be valid lat/lon
- waypoint sort order must remain stable and deterministic
- deleting a mission deletes or cascades its waypoints appropriately

---

## Frontend Requirements
Claude should create production-quality UI consistent with the existing flightops design.

### Frontend Features
- mission browser/list page or panel
- create/edit mission dialog or page
- searchable mission list
- route editing map
- draggable waypoint markers
- waypoint list/sidebar
- save / cancel flows
- confirmation before delete
- clear loading and error states
- responsive layout if practical

### UX Notes
- Avoid making map editing feel fragile.
- Edits should feel immediate.
- Dragging a point should update route metrics live or near-live.
- Waypoint handles must be easy to grab.
- Search should be fast and forgiving.

### Preferred Interaction Model
A strong UX would be:
- left panel: mission list and search
- main area: map
- right panel or drawer: mission details + waypoint metrics

If the current app structure suggests a better fit, Claude may adapt while preserving usability.

---

## Calculation / Plot Compatibility
The current plot system already has useful behavior such as:
- time between nodes
- route/path metrics
- other segment-based calculations

Claude must preserve these behaviors by:
- extracting current calculation logic into reusable utilities/services
- making the mission planner consume those shared utilities
- ensuring parity with the current plot output where appropriate

### Important
Do not reimplement route math in an ad hoc way if the current system already does it correctly.
Instead:
- locate the current logic
- refactor it cleanly
- apply it to missions

---

## Data Model Guidance
Use the project’s existing stack and conventions.

If the app uses PostgreSQL, introduce tables similar to:

### `missions`
- `id` UUID / PK
- `name`
- `notes`
- `launch_site_id` nullable FK
- timestamps

### `mission_waypoints`
- `id` UUID / PK
- `mission_id` FK
- `sort_order`
- `latitude`
- `longitude`
- `altitude` nullable
- timing / speed fields as needed for compatibility
- timestamps

Add indexes for:
- mission name search
- launch site filtering
- mission_id + sort_order

If full text search is already used in the project, wire notes/name into it.
Otherwise, simple indexed partial matching is acceptable.

---

## Technical Expectations
Claude should:
- follow the existing architecture and coding style of flightops
- reuse current mapping technology already used in the application
- keep components modular
- separate map interaction logic from business/data logic
- avoid large monolithic components
- write maintainable, typed code
- update DB schema/migrations cleanly
- remove deprecated code paths where safe

### Refactoring Expectations
As part of this feature, Claude should identify and refactor:
- legacy plot model assumptions
- any components that assume one path per site
- route calculation logic tightly coupled to launch sites

---

## Permissions / Ownership
Unless the existing app already has a more advanced permission model, assume:
- any user can create and edit missions

If ownership already exists in the application, Claude should integrate with current conventions instead of inventing a conflicting permission model.

---

## Non-Goals
Do **not** add unnecessary complexity unless already present in the app. For now, the mission planner does **not** need:
- turn-by-turn navigation
- live tracking
- collaborative editing
- version history
- GPX import/export unless it already exists and is trivial to retain
- approval workflows

Focus on a clean mission planning and editing experience.

---

## Acceptance Criteria
The feature is complete when all of the following are true:

1. Users can create any number of missions.
2. A mission can optionally be associated with a launch site.
3. Missions have a name and notes.
4. Missions are searchable by name.
5. Users can create a route by clicking on the map.
6. Users can drag existing nodes to reposition them.
7. Users can remove and reorder nodes.
8. Route metrics such as time between nodes continue to work.
9. Existing legacy site paths are migrated to missions, or a clear migration strategy is implemented and documented.
10. The old single-path-per-site node system is no longer the active system.
11. The UI exposes mission creation, editing, browsing, and deletion cleanly.
12. Backend APIs, DB schema, and frontend are aligned and tested.

---

## Testing Requirements
Claude should add or update tests for:

### Backend
- mission CRUD
- waypoint CRUD
- validation failures
- search/filter behavior
- migration behavior from legacy path data
- calculation parity for route metrics

### Frontend
- mission list rendering
- search/filter behavior
- create/edit mission flows
- waypoint add/delete flows
- drag interaction behavior where testable
- route metric updates

### Manual QA Checklist
Include a QA checklist covering:
- create mission without launch site
- create mission with launch site
- add multiple nodes to map
- drag a node and confirm recalculation
- delete waypoint in middle of route
- reorder waypoints
- search by mission name
- launch site mission listing
- migrated legacy route becomes editable mission

---

## Deliverables Expected From Claude
Claude should produce:
1. database migration(s)
2. backend model/schema updates
3. API endpoints / service layer updates
4. frontend mission planner UI
5. map editing support with draggable waypoints
6. migration from legacy path model
7. removal/refactor of deprecated node system
8. tests
9. concise implementation notes in code comments or project docs where needed

---

## Implementation Advice to Claude
- Start by auditing the current launch-site plot implementation.
- Identify everything that assumes one path per launch site.
- Extract reusable route calculation logic first.
- Introduce the new mission data model.
- Build migration support.
- Then wire the new frontend mission planner.
- Only remove the old system after migration paths are in place.

Be pragmatic, but do not leave the old and new systems awkwardly overlapping longer than necessary.

---

## Preferred Quality Bar
The final implementation should feel like a first-class feature of flightops, not an add-on. The mission planner should be intuitive for pilots, map editing should be smooth, and the code should be maintainable enough for future additions such as GPX import/export, altitude-aware planning, fuel estimates, or route templates.
