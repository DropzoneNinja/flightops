import { Injectable } from '@nestjs/common';
import { RawTrackpoint } from './gpx-parser.service';

export interface NormalizedTrackpoint {
  seq: number;
  lat: number;
  lon: number;
  elevation_m: number | null;
  timestamp: Date | null;        // UTC
  speed_mps: number | null;      // ground speed computed from consecutive points
  vertical_speed_mps: number | null;
  heading_deg: number | null;    // bearing to next point
  phase: string;                 // filled in by analysis engine; placeholder 'unknown'
  estimated: boolean;            // true for all derived fields
  noise_flag: boolean;           // true if point looks like GPS noise
  // Gaggle app per-point telemetry (present only in Gaggle-recorded files)
  gaggle_speed_mps?: number;
  gaggle_climb_rate_mps?: number;
  gaggle_agl_m?: number;
  gaggle_g_force?: number;
}

export interface FlightSummaryMetrics {
  start_at: Date | null;
  end_at: Date | null;
  duration_seconds: number | null;
  total_distance_m: number;
  max_altitude_m: number | null;
  min_altitude_m: number | null;
  altitude_gain_m: number;
  altitude_loss_m: number;
  avg_speed_mps: number | null;
  max_speed_mps: number | null;
  max_climb_mps: number | null;
  max_descent_mps: number | null;
  trackpoint_count: number;
  bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number };
  confidence_score: number;
}

// HEURISTIC: Ground speed above this value is treated as GPS noise
const MAX_PLAUSIBLE_SPEED_MPS = 500 / 3.6; // ~138 m/s ≈ 500 km/h

// HEURISTIC: Consider a point duplicate if distance < this value AND same timestamp
const MIN_MOVEMENT_M = 0.1;

@Injectable()
export class GpxNormalizerService {
  /**
   * Convert raw trackpoints to normalized form with derived per-point fields.
   * Returns the normalized array and computed summary metrics.
   */
  normalize(raw: RawTrackpoint[]): {
    trackpoints: NormalizedTrackpoint[];
    summary: FlightSummaryMetrics;
  } {
    const deduped = this.deduplicatePoints(raw);
    const normalized = this.computePerPointFields(deduped);
    const summary = this.computeSummary(normalized, deduped);
    return { trackpoints: normalized, summary };
  }

  // ---------------------------------------------------------------------------
  // Step 1 – deduplicate
  // ---------------------------------------------------------------------------

  private deduplicatePoints(raw: RawTrackpoint[]): RawTrackpoint[] {
    const result: RawTrackpoint[] = [];
    for (let i = 0; i < raw.length; i++) {
      const pt = raw[i];
      // Validate coordinate ranges
      if (pt.lat < -90 || pt.lat > 90 || pt.lon < -180 || pt.lon > 180) continue;

      if (result.length === 0) {
        result.push(pt);
        continue;
      }

      const prev = result[result.length - 1];
      const dist = haversineM(prev.lat, prev.lon, pt.lat, pt.lon);
      const sameTime =
        prev.time !== null &&
        pt.time !== null &&
        prev.time.getTime() === pt.time.getTime();

      if (dist < MIN_MOVEMENT_M && sameTime) continue; // exact duplicate

      result.push(pt);
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Step 2 – derive per-point fields
  // ---------------------------------------------------------------------------

  private computePerPointFields(raw: RawTrackpoint[]): NormalizedTrackpoint[] {
    const out: NormalizedTrackpoint[] = [];

    for (let i = 0; i < raw.length; i++) {
      const cur = raw[i];
      const next = raw[i + 1] ?? null;
      const prev = i > 0 ? raw[i - 1] : null;

      // Ground speed from current → next pair (or prev → current for last point)
      let speed_mps: number | null = null;
      let noise_flag = false;

      if (next && cur.time && next.time) {
        const dtSec = (next.time.getTime() - cur.time.getTime()) / 1000;
        if (dtSec > 0) {
          const dist = haversineM(cur.lat, cur.lon, next.lat, next.lon);
          speed_mps = dist / dtSec;
          // HEURISTIC: flag implausible ground-speed jumps
          if (speed_mps > MAX_PLAUSIBLE_SPEED_MPS) {
            noise_flag = true;
            speed_mps = null; // discard noisy value
          }
        }
      } else if (prev && cur.time && prev.time && !out[i - 1]?.noise_flag) {
        // Fallback: use previous interval for last point
        const dtSec = (cur.time.getTime() - prev.time.getTime()) / 1000;
        if (dtSec > 0) {
          const dist = haversineM(prev.lat, prev.lon, cur.lat, cur.lon);
          speed_mps = dist / dtSec;
          if (speed_mps > MAX_PLAUSIBLE_SPEED_MPS) {
            noise_flag = true;
            speed_mps = null;
          }
        }
      }

      // Vertical speed
      let vertical_speed_mps: number | null = null;
      if (
        next &&
        cur.elevation !== null &&
        next.elevation !== null &&
        cur.time &&
        next.time
      ) {
        const dtSec = (next.time.getTime() - cur.time.getTime()) / 1000;
        if (dtSec > 0) {
          vertical_speed_mps = (next.elevation! - cur.elevation!) / dtSec;
        }
      }

      // Heading (bearing to next point)
      const heading_deg = next ? bearingDeg(cur.lat, cur.lon, next.lat, next.lon) : null;

      const normalized: NormalizedTrackpoint = {
        seq: i,
        lat: cur.lat,
        lon: cur.lon,
        elevation_m: cur.elevation,
        timestamp: cur.time,
        speed_mps,
        vertical_speed_mps,
        heading_deg,
        phase: 'unknown',
        estimated: true,
        noise_flag,
      };

      // Carry through Gaggle per-point telemetry when present
      if (cur.gaggle_speed_mps !== undefined) normalized.gaggle_speed_mps = cur.gaggle_speed_mps;
      if (cur.gaggle_climb_rate_mps !== undefined) normalized.gaggle_climb_rate_mps = cur.gaggle_climb_rate_mps;
      if (cur.gaggle_agl_m !== undefined) normalized.gaggle_agl_m = cur.gaggle_agl_m;
      if (cur.gaggle_g_force !== undefined) normalized.gaggle_g_force = cur.gaggle_g_force;

      out.push(normalized);
    }

    return out;
  }

  // ---------------------------------------------------------------------------
  // Step 3 – summary metrics
  // ---------------------------------------------------------------------------

  private computeSummary(
    normalized: NormalizedTrackpoint[],
    raw: RawTrackpoint[],
  ): FlightSummaryMetrics {
    if (normalized.length === 0) {
      return {
        start_at: null, end_at: null, duration_seconds: null,
        total_distance_m: 0, max_altitude_m: null, min_altitude_m: null,
        altitude_gain_m: 0, altitude_loss_m: 0,
        avg_speed_mps: null, max_speed_mps: null,
        max_climb_mps: null, max_descent_mps: null,
        trackpoint_count: 0,
        bbox: { minLon: 0, minLat: 0, maxLon: 0, maxLat: 0 },
        confidence_score: 0,
      };
    }

    const timestamps = normalized.map((p) => p.timestamp).filter((t): t is Date => t !== null);
    const start_at = timestamps.length > 0 ? timestamps[0] : null;
    const end_at = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;
    const duration_seconds =
      start_at && end_at
        ? Math.round((end_at.getTime() - start_at.getTime()) / 1000)
        : null;

    let total_distance_m = 0;
    for (let i = 1; i < raw.length; i++) {
      total_distance_m += haversineM(raw[i - 1].lat, raw[i - 1].lon, raw[i].lat, raw[i].lon);
    }

    const elevations = normalized
      .map((p) => p.elevation_m)
      .filter((e): e is number => e !== null);
    const max_altitude_m = elevations.length > 0 ? Math.max(...elevations) : null;
    const min_altitude_m = elevations.length > 0 ? Math.min(...elevations) : null;

    let altitude_gain_m = 0;
    let altitude_loss_m = 0;
    for (let i = 1; i < elevations.length; i++) {
      const delta = elevations[i] - elevations[i - 1];
      if (delta > 0) altitude_gain_m += delta;
      else altitude_loss_m += Math.abs(delta);
    }

    const speeds = normalized
      .map((p) => p.speed_mps)
      .filter((s): s is number => s !== null);
    const avg_speed_mps =
      speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;
    const max_speed_mps = speeds.length > 0 ? Math.max(...speeds) : null;

    const climbs = normalized
      .map((p) => p.vertical_speed_mps)
      .filter((v): v is number => v !== null);
    const max_climb_mps = climbs.length > 0 ? Math.max(...climbs) : null;
    const max_descent_mps = climbs.length > 0 ? Math.min(...climbs) : null; // most negative

    const bbox = {
      minLon: Math.min(...normalized.map((p) => p.lon)),
      minLat: Math.min(...normalized.map((p) => p.lat)),
      maxLon: Math.max(...normalized.map((p) => p.lon)),
      maxLat: Math.max(...normalized.map((p) => p.lat)),
    };

    const confidence_score = this.computeConfidence(normalized);

    return {
      start_at, end_at, duration_seconds,
      total_distance_m,
      max_altitude_m, min_altitude_m,
      altitude_gain_m, altitude_loss_m,
      avg_speed_mps, max_speed_mps,
      max_climb_mps, max_descent_mps,
      trackpoint_count: normalized.length,
      bbox,
      confidence_score,
    };
  }

  // ---------------------------------------------------------------------------
  // Confidence scoring
  // ---------------------------------------------------------------------------

  private computeConfidence(trackpoints: NormalizedTrackpoint[]): number {
    if (trackpoints.length === 0) return 0;

    let score = 1.0;

    // Penalty: low total point count
    if (trackpoints.length < 100) score -= 0.2;
    else if (trackpoints.length < 300) score -= 0.05;

    // Penalty: no elevation data
    const hasElevation = trackpoints.some((p) => p.elevation_m !== null);
    if (!hasElevation) score -= 0.2;

    // Penalty: no timestamps
    const hasTimestamps = trackpoints.some((p) => p.timestamp !== null);
    if (!hasTimestamps) score -= 0.3;

    if (hasTimestamps) {
      const timed = trackpoints.filter((p) => p.timestamp !== null);

      // Penalty: large timestamp gaps (> 30 s between consecutive points)
      let gapPenalty = 0;
      for (let i = 1; i < timed.length; i++) {
        const dt = (timed[i].timestamp!.getTime() - timed[i - 1].timestamp!.getTime()) / 1000;
        if (dt > 30) gapPenalty += 0.02;
        if (dt > 5) gapPenalty += 0.005;
      }
      score -= Math.min(gapPenalty, 0.3);
    }

    // Penalty: high noise fraction
    const noiseCount = trackpoints.filter((p) => p.noise_flag).length;
    const noiseFraction = noiseCount / trackpoints.length;
    score -= noiseFraction * 0.4;

    return Math.max(0, Math.min(1, parseFloat(score.toFixed(3))));
  }
}

// ---------------------------------------------------------------------------
// Pure geo helpers (no external library required for basic calculations)
// ---------------------------------------------------------------------------

/** Haversine distance in metres */
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Compass bearing from point 1 to point 2 (0–360°) */
function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const lat1R = toRad(lat1);
  const lat2R = toRad(lat2);
  const x = Math.sin(dLon) * Math.cos(lat2R);
  const y = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLon);
  return (toDeg(Math.atan2(x, y)) + 360) % 360;
}
