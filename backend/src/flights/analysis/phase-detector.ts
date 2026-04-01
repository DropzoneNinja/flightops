import { NormalizedTrackpoint } from '../gpx-normalizer.service';

export type FlightPhase =
  | 'pre_takeoff'
  | 'takeoff'
  | 'climb'
  | 'cruise'
  | 'turn'
  | 'descent'
  | 'approach'
  | 'landing'
  | 'post_landing'
  | 'unknown';

export interface PhasedTrackpoint extends NormalizedTrackpoint {
  phase: FlightPhase;
}

// HEURISTIC: All phase detection thresholds — adjust here to tune detection
const PHASE_CONFIG = {
  // Minimum ground speed to be considered airborne/moving (m/s)
  MIN_AIRBORNE_SPEED_MPS: 2.0,
  // Required sustained duration to confirm flight has started (seconds)
  MIN_FLIGHT_DURATION_SEC: 30,
  // Vertical speed threshold for climb phase (m/s)
  CLIMB_VS_THRESHOLD_MPS: 0.5,
  // Vertical speed threshold for descent phase (m/s, negative)
  DESCENT_VS_THRESHOLD_MPS: -0.5,
  // Heading change rate threshold to classify a turn (degrees/second)
  TURN_HEADING_RATE_DEG_S: 3.0,
  // Altitude above minimum to consider the aircraft in "approach" (metres)
  APPROACH_ALT_THRESHOLD_M: 50,
  // Rolling window for smoothed vertical speed (seconds)
  ROLLING_VS_WINDOW_SEC: 10,
  // Duration of the initial takeoff phase label after becoming airborne (seconds)
  TAKEOFF_LABEL_DURATION_SEC: 30,
};

/**
 * Assign a flight phase to each trackpoint.
 * Pure function — no side effects, deterministic output.
 */
export function detectPhases(trackpoints: NormalizedTrackpoint[]): PhasedTrackpoint[] {
  if (trackpoints.length === 0) return [];

  // Step 1: Find the airborne window (first + last point with sustained movement)
  const airborneStart = findAirborneStart(trackpoints);
  const airborneEnd = findAirborneEnd(trackpoints);

  // Step 2: Find minimum altitude during airborne window (for approach detection)
  const minAlt = findMinAltitude(trackpoints, airborneStart, airborneEnd);

  // Step 3: Assign a phase to every point
  const phased: PhasedTrackpoint[] = trackpoints.map((tp, i) => {
    let phase: FlightPhase;

    if (airborneStart === null || i < airborneStart) {
      phase = 'pre_takeoff';
    } else if (airborneEnd !== null && i > airborneEnd) {
      phase = 'post_landing';
    } else {
      phase = classifyAirbornePoint(trackpoints, i, minAlt);
    }

    return { ...tp, phase };
  });

  // Step 4: Relabel the first climb segment as "takeoff"
  if (airborneStart !== null) {
    markTakeoffPhase(phased, airborneStart);
  }

  // Step 5: Relabel the final descent near the ground as "approach"
  if (airborneEnd !== null && minAlt !== null) {
    markApproachPhase(phased, airborneEnd, minAlt);
  }

  // Step 6: Smooth out isolated single-point phase anomalies
  smoothPhases(phased);

  return phased;
}

// ---------------------------------------------------------------------------
// Airborne window detection
// ---------------------------------------------------------------------------

function findAirborneStart(trackpoints: NormalizedTrackpoint[]): number | null {
  for (let i = 0; i < trackpoints.length; i++) {
    const sp = trackpoints[i].speed_mps ?? 0;
    if (sp > PHASE_CONFIG.MIN_AIRBORNE_SPEED_MPS) {
      // Confirm sustained movement to avoid false positives on short ground rolls
      if (
        isSustainedForSeconds(
          trackpoints,
          i,
          PHASE_CONFIG.MIN_FLIGHT_DURATION_SEC,
          (tp) => (tp.speed_mps ?? 0) > PHASE_CONFIG.MIN_AIRBORNE_SPEED_MPS * 0.5,
        )
      ) {
        return i;
      }
    }
  }
  return null;
}

function findAirborneEnd(trackpoints: NormalizedTrackpoint[]): number | null {
  for (let i = trackpoints.length - 1; i >= 0; i--) {
    if ((trackpoints[i].speed_mps ?? 0) > PHASE_CONFIG.MIN_AIRBORNE_SPEED_MPS) {
      return i;
    }
  }
  return null;
}

function findMinAltitude(
  trackpoints: NormalizedTrackpoint[],
  start: number | null,
  end: number | null,
): number | null {
  if (start === null || end === null) return null;
  const elevations = trackpoints
    .slice(start, end + 1)
    .map((tp) => tp.elevation_m)
    .filter((e): e is number => e !== null);
  return elevations.length > 0 ? Math.min(...elevations) : null;
}

// ---------------------------------------------------------------------------
// Per-point phase classification (airborne section only)
// ---------------------------------------------------------------------------

function classifyAirbornePoint(
  trackpoints: NormalizedTrackpoint[],
  i: number,
  minAlt: number | null,
): FlightPhase {
  const tp = trackpoints[i];

  // HEURISTIC: Turns take priority — detect by heading change rate
  const headingRate = getHeadingChangeRate(trackpoints, i);
  if (headingRate !== null && headingRate > PHASE_CONFIG.TURN_HEADING_RATE_DEG_S) {
    return 'turn';
  }

  // HEURISTIC: Use rolling average VS to smooth out noisy GPS elevation
  const rollingVS = getRollingAvgVS(trackpoints, i, PHASE_CONFIG.ROLLING_VS_WINDOW_SEC);

  if (rollingVS !== null && rollingVS > PHASE_CONFIG.CLIMB_VS_THRESHOLD_MPS) {
    return 'climb';
  }

  if (rollingVS !== null && rollingVS < PHASE_CONFIG.DESCENT_VS_THRESHOLD_MPS) {
    return 'descent';
  }

  // HEURISTIC: Landing — slow speed near minimum altitude
  if (
    (tp.speed_mps ?? 0) < PHASE_CONFIG.MIN_AIRBORNE_SPEED_MPS &&
    minAlt !== null &&
    tp.elevation_m !== null &&
    tp.elevation_m - minAlt < PHASE_CONFIG.APPROACH_ALT_THRESHOLD_M
  ) {
    return 'landing';
  }

  return 'cruise';
}

// ---------------------------------------------------------------------------
// Post-processing passes
// ---------------------------------------------------------------------------

/**
 * HEURISTIC: Label the first TAKEOFF_LABEL_DURATION_SEC of airborne time as 'takeoff'
 * when the phase is climb. This marks the transition from ground to air.
 */
function markTakeoffPhase(phased: PhasedTrackpoint[], airborneStart: number): void {
  let i = airborneStart;
  // Skip any pre_takeoff points (shouldn't exist here, but defensive)
  while (i < phased.length && phased[i].phase === 'pre_takeoff') i++;

  const startTime = phased[i]?.timestamp;
  const cutoff = startTime
    ? new Date(startTime.getTime() + PHASE_CONFIG.TAKEOFF_LABEL_DURATION_SEC * 1000)
    : null;

  while (i < phased.length) {
    const tp = phased[i];
    if (cutoff && tp.timestamp && tp.timestamp >= cutoff) break;
    if (tp.phase === 'climb') {
      phased[i] = { ...tp, phase: 'takeoff' };
    } else if (tp.phase !== 'cruise') {
      // Non-climb/cruise phase (e.g. turn) ends the takeoff window early
      break;
    }
    i++;
  }
}

/**
 * HEURISTIC: Relabel descent points within APPROACH_ALT_THRESHOLD_M of the
 * minimum altitude as 'approach', representing the final landing approach.
 */
function markApproachPhase(
  phased: PhasedTrackpoint[],
  airborneEnd: number,
  minAlt: number,
): void {
  for (let i = airborneEnd; i >= 0; i--) {
    const tp = phased[i];
    if (tp.phase === 'landing' || tp.phase === 'post_landing') continue;
    if (tp.phase !== 'descent' && tp.phase !== 'cruise') break;
    if (
      tp.elevation_m !== null &&
      tp.elevation_m - minAlt < PHASE_CONFIG.APPROACH_ALT_THRESHOLD_M
    ) {
      phased[i] = { ...tp, phase: 'approach' };
    }
  }
}

/**
 * Smooth out single-point phase anomalies by inheriting the previous point's phase.
 * Does not override takeoff or landing events.
 */
function smoothPhases(phased: PhasedTrackpoint[]): void {
  const PROTECTED: FlightPhase[] = ['takeoff', 'landing', 'pre_takeoff', 'post_landing'];
  for (let i = 1; i < phased.length - 1; i++) {
    const curr = phased[i];
    const prev = phased[i - 1];
    const next = phased[i + 1];
    if (
      curr.phase !== prev.phase &&
      curr.phase !== next.phase &&
      !PROTECTED.includes(curr.phase)
    ) {
      // Isolated single point — inherit from previous
      phased[i] = { ...curr, phase: prev.phase };
    }
  }
}

// ---------------------------------------------------------------------------
// Rolling window helpers (pure functions, no external deps)
// ---------------------------------------------------------------------------

/**
 * Compute the average vertical speed over a time window centred on index i.
 * Falls back to a ±5-point window when timestamps are absent.
 */
function getRollingAvgVS(
  trackpoints: NormalizedTrackpoint[],
  i: number,
  windowSec: number,
): number | null {
  const tp = trackpoints[i];

  if (!tp.timestamp) {
    const start = Math.max(0, i - 5);
    const end = Math.min(trackpoints.length - 1, i + 5);
    const vals = trackpoints
      .slice(start, end + 1)
      .map((p) => p.vertical_speed_mps)
      .filter((v): v is number => v !== null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  const halfMs = (windowSec * 1000) / 2;
  const lo = tp.timestamp.getTime() - halfMs;
  const hi = tp.timestamp.getTime() + halfMs;
  const vals = trackpoints
    .filter((p) => p.timestamp !== null && p.timestamp.getTime() >= lo && p.timestamp.getTime() <= hi)
    .map((p) => p.vertical_speed_mps)
    .filter((v): v is number => v !== null);
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Compute heading change rate in degrees/second between point i and i+1. */
function getHeadingChangeRate(trackpoints: NormalizedTrackpoint[], i: number): number | null {
  const curr = trackpoints[i];
  const next = trackpoints[i + 1] ?? null;
  if (
    curr.heading_deg === null ||
    !next?.heading_deg ||
    !curr.timestamp ||
    !next.timestamp
  ) {
    return null;
  }
  const dt = (next.timestamp.getTime() - curr.timestamp.getTime()) / 1000;
  if (dt <= 0) return null;
  return headingDiff(curr.heading_deg, next.heading_deg) / dt;
}

/**
 * Returns true if `condition` holds for every trackpoint starting at `start`
 * for at least `durationSec` seconds. Falls back to point count if no timestamps.
 */
function isSustainedForSeconds(
  trackpoints: NormalizedTrackpoint[],
  start: number,
  durationSec: number,
  condition: (tp: NormalizedTrackpoint) => boolean,
): boolean {
  const startTp = trackpoints[start];
  if (!startTp.timestamp) {
    const endIdx = Math.min(trackpoints.length - 1, start + durationSec);
    return trackpoints.slice(start, endIdx + 1).every(condition);
  }
  const endTime = startTp.timestamp.getTime() + durationSec * 1000;
  for (let i = start; i < trackpoints.length; i++) {
    if (!condition(trackpoints[i])) return false;
    const ts = trackpoints[i].timestamp;
    if (ts && ts.getTime() >= endTime) return true;
  }
  return false;
}

/** Angular difference between two headings in degrees (0–180). */
function headingDiff(h1: number, h2: number): number {
  let diff = Math.abs(h2 - h1) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}
