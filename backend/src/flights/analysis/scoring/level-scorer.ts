import { PhasedTrackpoint } from '../phase-detector';
import { FlightEventData } from '../event-detector';
import { SCORING_CONFIG } from './scoring-config';
import * as T from './coaching-templates';

export interface ScorerResult {
  score: number;
  notes: string[];
}

/**
 * Score level/cruise flight quality.
 * Assesses altitude stability and total duration of cruise segments.
 */
export function scoreLevel(
  trackpoints: PhasedTrackpoint[],
  _events: FlightEventData[],
): ScorerResult {
  const tps = trackpoints.filter((p) => p.phase === 'cruise');
  if (tps.length === 0) return { score: 50, notes: [T.LEVEL_NO_DATA()] };

  const elevations = tps
    .map((p) => p.elevation_m)
    .filter((e): e is number => e !== null);

  // Total cruise duration
  const totalDuration = getCruiseDuration(tps);
  const notes: string[] = [];

  if (totalDuration < SCORING_CONFIG.LEVEL.MIN_DURATION_SEC) {
    return { score: 40, notes: [T.LEVEL_SHORT()] };
  }

  if (elevations.length < 2) {
    return { score: 50, notes: [T.LEVEL_GOOD(totalDuration)] };
  }

  const sd = stdDev(elevations);

  // HEURISTIC: Score based on altitude standard deviation during cruise
  const ratio = (sd - SCORING_CONFIG.LEVEL.IDEAL_ALT_STDDEV_M) /
    (SCORING_CONFIG.LEVEL.POOR_ALT_STDDEV_M - SCORING_CONFIG.LEVEL.IDEAL_ALT_STDDEV_M);
  const score = 100 - clamp(ratio * 80); // max 80pt deduction for variance

  if (sd <= SCORING_CONFIG.LEVEL.IDEAL_ALT_STDDEV_M &&
      totalDuration >= SCORING_CONFIG.LEVEL.EXCELLENT_DURATION_SEC) {
    notes.push(T.LEVEL_EXCELLENT(totalDuration, sd));
  } else if (sd <= SCORING_CONFIG.LEVEL.IDEAL_ALT_STDDEV_M * 2) {
    notes.push(T.LEVEL_GOOD(totalDuration));
  } else {
    notes.push(T.LEVEL_POOR_VARIANCE(sd));
  }

  return { score: clamp(score), notes };
}

function getCruiseDuration(tps: PhasedTrackpoint[]): number {
  const timestamps = tps.map((p) => p.timestamp).filter((t): t is Date => t !== null);
  if (timestamps.length < 2) return tps.length; // fallback to point count
  return (timestamps[timestamps.length - 1].getTime() - timestamps[0].getTime()) / 1000;
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
