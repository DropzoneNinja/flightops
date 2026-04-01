import { PhasedTrackpoint } from '../phase-detector';
import { FlightEventData } from '../event-detector';
import { SCORING_CONFIG } from './scoring-config';
import * as T from './coaching-templates';

export interface ScorerResult {
  score: number;
  notes: string[];
}

/**
 * Score the takeoff phase.
 * Assesses initial climb rate and vertical speed consistency.
 */
export function scoreTakeoff(
  trackpoints: PhasedTrackpoint[],
  _events: FlightEventData[],
): ScorerResult {
  const tps = trackpoints.filter((p) => p.phase === 'takeoff');
  if (tps.length === 0) return { score: 50, notes: [T.TAKEOFF_NO_DATA()] };

  const vsValues = tps
    .map((p) => p.vertical_speed_mps)
    .filter((v): v is number => v !== null);

  if (vsValues.length === 0) return { score: 50, notes: [T.TAKEOFF_NO_DATA()] };

  const avgVS = vsValues.reduce((a, b) => a + b, 0) / vsValues.length;
  const sd = stdDev(vsValues);
  const notes: string[] = [];
  let score = 100;

  // HEURISTIC: Penalize weak initial climb rate
  if (avgVS < SCORING_CONFIG.TAKEOFF.MIN_CLIMB_RATE_MPS) {
    score -= 40;
    notes.push(T.TAKEOFF_WEAK_CLIMB(avgVS));
  } else if (avgVS >= SCORING_CONFIG.TAKEOFF.IDEAL_CLIMB_RATE_MPS) {
    notes.push(T.TAKEOFF_STRONG_CLIMB(avgVS));
  }

  // HEURISTIC: Penalize erratic VS during takeoff
  if (sd > SCORING_CONFIG.TAKEOFF.ERRATIC_VS_STDDEV) {
    score -= 30;
    notes.push(T.TAKEOFF_ERRATIC());
  } else if (sd <= SCORING_CONFIG.TAKEOFF.SMOOTH_VS_STDDEV) {
    notes.push(T.TAKEOFF_SMOOTH());
  }

  if (notes.length === 0) notes.push(T.TAKEOFF_SMOOTH());

  return { score: clamp(score), notes };
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
