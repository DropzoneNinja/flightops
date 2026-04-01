import { PhasedTrackpoint } from '../phase-detector';
import { FlightEventData } from '../event-detector';
import { SCORING_CONFIG } from './scoring-config';
import * as T from './coaching-templates';

export interface ScorerResult {
  score: number;
  notes: string[];
}

/**
 * Score overall flight smoothness.
 * Measures speed variability and vertical speed variability across the whole flight.
 */
export function scoreSmoothness(
  trackpoints: PhasedTrackpoint[],
  _events: FlightEventData[],
): ScorerResult {
  const airborne = trackpoints.filter(
    (p) => p.phase !== 'pre_takeoff' && p.phase !== 'post_landing',
  );

  if (airborne.length === 0) return { score: 50, notes: [T.SMOOTH_GOOD()] };

  const notes: string[] = [];
  let score = 100;

  // HEURISTIC: Speed variability
  const speeds = airborne
    .map((p) => p.speed_mps)
    .filter((s): s is number => s !== null);

  if (speeds.length >= 2) {
    const speedSd = stdDev(speeds);
    const speedRatio = (speedSd - SCORING_CONFIG.SMOOTHNESS.IDEAL_SPEED_STDDEV) /
      (SCORING_CONFIG.SMOOTHNESS.POOR_SPEED_STDDEV - SCORING_CONFIG.SMOOTHNESS.IDEAL_SPEED_STDDEV);
    score -= Math.max(0, Math.min(40, speedRatio * 40));
  }

  // HEURISTIC: Vertical speed variability
  const vsVals = airborne
    .map((p) => p.vertical_speed_mps)
    .filter((v): v is number => v !== null);

  if (vsVals.length >= 2) {
    const vsSd = stdDev(vsVals);
    const vsRatio = (vsSd - SCORING_CONFIG.SMOOTHNESS.IDEAL_VS_STDDEV) /
      (SCORING_CONFIG.SMOOTHNESS.POOR_VS_STDDEV - SCORING_CONFIG.SMOOTHNESS.IDEAL_VS_STDDEV);
    score -= Math.max(0, Math.min(40, vsRatio * 40));
  }

  // HEURISTIC: GPS noise penalty
  const noiseFraction = airborne.filter((p) => p.noise_flag).length / airborne.length;
  if (noiseFraction > SCORING_CONFIG.SMOOTHNESS.MAX_NOISE_FRACTION) {
    score -= 20;
    notes.push(T.SMOOTH_NOISY_GPS());
  }

  const finalScore = clamp(score);
  if (finalScore >= 85) {
    notes.push(T.SMOOTH_EXCELLENT());
  } else if (finalScore >= 60) {
    notes.push(T.SMOOTH_GOOD());
  } else {
    notes.push(T.SMOOTH_POOR());
  }

  return { score: finalScore, notes };
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}
