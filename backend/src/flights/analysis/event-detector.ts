import { PhasedTrackpoint } from './phase-detector';

export interface FlightEventData {
  event_type: string;
  timestamp: Date | null;
  seq_start: number | null;
  seq_end: number | null;
  lon: number | null;
  lat: number | null;
  elevation_m: number | null;
  confidence: number;
  payload_json: Record<string, unknown> | null;
}

// Rolling window for climb/descent rate events (seconds)
const ROLLING_WINDOW_SEC = 10;

/**
 * Detect significant in-flight events from phased trackpoints.
 * Pure function — deterministic, no side effects.
 */
export function detectEvents(trackpoints: PhasedTrackpoint[]): FlightEventData[] {
  if (trackpoints.length === 0) return [];

  const events: FlightEventData[] = [];

  const takeoffEvt = detectTakeoff(trackpoints);
  if (takeoffEvt) events.push(takeoffEvt);

  const landingEvt = detectLanding(trackpoints);
  if (landingEvt) events.push(landingEvt);

  const maxAltEvt = detectMaxAltitude(trackpoints);
  if (maxAltEvt) events.push(maxAltEvt);

  const maxClimbEvt = detectMaxRollingVS(trackpoints, 'max_climb_rate', (v) => v > 0, (a, b) => b > a);
  if (maxClimbEvt) events.push(maxClimbEvt);

  const maxDescentEvt = detectMaxRollingVS(trackpoints, 'max_descent_rate', (v) => v < 0, (a, b) => b < a);
  if (maxDescentEvt) events.push(maxDescentEvt);

  const maxSpeedEvt = detectMaxGroundspeed(trackpoints);
  if (maxSpeedEvt) events.push(maxSpeedEvt);

  const longestLevelEvt = detectLongestLevel(trackpoints);
  if (longestLevelEvt) events.push(longestLevelEvt);

  const largestTurnEvt = detectLargestTurn(trackpoints);
  if (largestTurnEvt) events.push(largestTurnEvt);

  events.push(...detectAbruptChanges(trackpoints));

  return events;
}

// ---------------------------------------------------------------------------
// Individual event detectors
// ---------------------------------------------------------------------------

function detectTakeoff(trackpoints: PhasedTrackpoint[]): FlightEventData | null {
  const tp = trackpoints.find((p) => p.phase === 'takeoff' || p.phase === 'climb');
  if (!tp) return null;
  return {
    event_type: 'takeoff',
    timestamp: tp.timestamp,
    seq_start: tp.seq,
    seq_end: tp.seq,
    lon: tp.lon,
    lat: tp.lat,
    elevation_m: tp.elevation_m,
    confidence: 0.8,
    payload_json: null,
  };
}

function detectLanding(trackpoints: PhasedTrackpoint[]): FlightEventData | null {
  // Last point before post_landing phase
  let idx = -1;
  for (let i = trackpoints.length - 1; i >= 0; i--) {
    if (trackpoints[i].phase !== 'post_landing') {
      idx = i;
      break;
    }
  }
  if (idx < 0) return null;
  const tp = trackpoints[idx];
  return {
    event_type: 'landing',
    timestamp: tp.timestamp,
    seq_start: tp.seq,
    seq_end: tp.seq,
    lon: tp.lon,
    lat: tp.lat,
    elevation_m: tp.elevation_m,
    confidence: 0.8,
    payload_json: null,
  };
}

function detectMaxAltitude(trackpoints: PhasedTrackpoint[]): FlightEventData | null {
  let maxElev = -Infinity;
  let maxIdx = -1;
  for (let i = 0; i < trackpoints.length; i++) {
    const e = trackpoints[i].elevation_m;
    if (e !== null && e > maxElev) {
      maxElev = e;
      maxIdx = i;
    }
  }
  if (maxIdx < 0) return null;
  const tp = trackpoints[maxIdx];
  return {
    event_type: 'max_altitude',
    timestamp: tp.timestamp,
    seq_start: tp.seq,
    seq_end: tp.seq,
    lon: tp.lon,
    lat: tp.lat,
    elevation_m: tp.elevation_m,
    confidence: 0.95,
    payload_json: { altitude_m: parseFloat(maxElev.toFixed(1)) },
  };
}

function detectMaxRollingVS(
  trackpoints: PhasedTrackpoint[],
  eventType: string,
  filterFn: (v: number) => boolean,
  betterFn: (best: number, current: number) => boolean,
): FlightEventData | null {
  let bestRate: number | null = null;
  let bestIdx = -1;

  for (let i = 0; i < trackpoints.length; i++) {
    const tp = trackpoints[i];
    if (!tp.timestamp) continue;

    const endTime = tp.timestamp.getTime() + ROLLING_WINDOW_SEC * 1000;
    const windowVs = trackpoints
      .slice(i)
      .filter((p) => p.timestamp !== null && p.timestamp.getTime() <= endTime)
      .map((p) => p.vertical_speed_mps)
      .filter((v): v is number => v !== null && filterFn(v));

    if (windowVs.length === 0) continue;
    const avg = windowVs.reduce((a, b) => a + b, 0) / windowVs.length;
    if (bestRate === null || betterFn(bestRate, avg)) {
      bestRate = avg;
      bestIdx = i;
    }
  }

  if (bestIdx < 0 || bestRate === null) return null;
  const tp = trackpoints[bestIdx];
  return {
    event_type: eventType,
    timestamp: tp.timestamp,
    seq_start: tp.seq,
    seq_end: tp.seq,
    lon: tp.lon,
    lat: tp.lat,
    elevation_m: tp.elevation_m,
    confidence: 0.75,
    payload_json: { rate_mps: parseFloat(bestRate.toFixed(2)) },
  };
}

function detectMaxGroundspeed(trackpoints: PhasedTrackpoint[]): FlightEventData | null {
  let maxSpeed: number | null = null;
  let maxIdx = -1;
  for (let i = 0; i < trackpoints.length; i++) {
    const s = trackpoints[i].speed_mps;
    if (s !== null && (maxSpeed === null || s > maxSpeed)) {
      maxSpeed = s;
      maxIdx = i;
    }
  }
  if (maxIdx < 0) return null;
  const tp = trackpoints[maxIdx];
  return {
    event_type: 'max_groundspeed',
    timestamp: tp.timestamp,
    seq_start: tp.seq,
    seq_end: tp.seq,
    lon: tp.lon,
    lat: tp.lat,
    elevation_m: tp.elevation_m,
    confidence: 0.9,
    payload_json: {
      speed_mps: parseFloat((maxSpeed ?? 0).toFixed(2)),
      speed_kph: parseFloat(((maxSpeed ?? 0) * 3.6).toFixed(1)),
    },
  };
}

function detectLongestLevel(trackpoints: PhasedTrackpoint[]): FlightEventData | null {
  let longestDuration = 0;
  let longestStart = -1;
  let longestEnd = -1;
  let segStart = -1;

  const checkSegment = (end: number) => {
    if (segStart < 0) return;
    const dur = getSegmentDuration(trackpoints, segStart, end);
    if (dur > longestDuration) {
      longestDuration = dur;
      longestStart = segStart;
      longestEnd = end;
    }
    segStart = -1;
  };

  for (let i = 0; i < trackpoints.length; i++) {
    if (trackpoints[i].phase === 'cruise') {
      if (segStart < 0) segStart = i;
    } else {
      checkSegment(i - 1);
    }
  }
  checkSegment(trackpoints.length - 1);

  // Only report if cruise lasted more than 10 seconds
  if (longestStart < 0 || longestDuration < 10) return null;
  const tp = trackpoints[longestStart];
  return {
    event_type: 'longest_level',
    timestamp: tp.timestamp,
    seq_start: trackpoints[longestStart].seq,
    seq_end: trackpoints[longestEnd].seq,
    lon: tp.lon,
    lat: tp.lat,
    elevation_m: tp.elevation_m,
    confidence: 0.8,
    payload_json: { duration_sec: Math.round(longestDuration) },
  };
}

function detectLargestTurn(trackpoints: PhasedTrackpoint[]): FlightEventData | null {
  let bestRate: number | null = null;
  let bestStart = -1;
  let bestEnd = -1;
  let segStart = -1;
  let segRates: number[] = [];

  const evaluateSeg = (end: number) => {
    if (segStart < 0 || segRates.length === 0) return;
    const avg = segRates.reduce((a, b) => a + b, 0) / segRates.length;
    if (bestRate === null || avg > bestRate) {
      bestRate = avg;
      bestStart = segStart;
      bestEnd = end;
    }
    segStart = -1;
    segRates = [];
  };

  for (let i = 0; i < trackpoints.length; i++) {
    const tp = trackpoints[i];
    if (tp.phase === 'turn') {
      if (segStart < 0) segStart = i;
      const next = trackpoints[i + 1];
      if (tp.heading_deg && next?.heading_deg && tp.timestamp && next.timestamp) {
        const dt = (next.timestamp.getTime() - tp.timestamp.getTime()) / 1000;
        if (dt > 0) {
          segRates.push(headingDiff(tp.heading_deg, next.heading_deg) / dt);
        }
      }
    } else {
      evaluateSeg(i - 1);
    }
  }
  evaluateSeg(trackpoints.length - 1);

  if (bestStart < 0) return null;
  const tp = trackpoints[bestStart];
  return {
    event_type: 'largest_turn',
    timestamp: tp.timestamp,
    seq_start: trackpoints[bestStart].seq,
    seq_end: trackpoints[bestEnd].seq,
    lon: tp.lon,
    lat: tp.lat,
    elevation_m: tp.elevation_m,
    confidence: 0.7,
    payload_json: { avg_heading_rate_deg_s: parseFloat((bestRate ?? 0).toFixed(2)) },
  };
}

function detectAbruptChanges(trackpoints: PhasedTrackpoint[]): FlightEventData[] {
  return trackpoints
    .filter((tp) => tp.noise_flag)
    .map((tp) => ({
      event_type: 'abrupt_change',
      timestamp: tp.timestamp,
      seq_start: tp.seq,
      seq_end: tp.seq,
      lon: tp.lon,
      lat: tp.lat,
      elevation_m: tp.elevation_m,
      confidence: 0.6,
      payload_json: { reason: 'GPS noise: implausible ground speed detected' },
    }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSegmentDuration(
  trackpoints: PhasedTrackpoint[],
  startIdx: number,
  endIdx: number,
): number {
  if (endIdx < startIdx) return 0;
  const t0 = trackpoints[startIdx].timestamp;
  const t1 = trackpoints[endIdx].timestamp;
  if (!t0 || !t1) return endIdx - startIdx; // fallback: point count ≈ seconds
  return (t1.getTime() - t0.getTime()) / 1000;
}

function headingDiff(h1: number, h2: number): number {
  let diff = Math.abs(h2 - h1) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}
