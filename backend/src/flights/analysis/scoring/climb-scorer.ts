import { PhasedTrackpoint } from '../phase-detector';
import { FlightEventData } from '../event-detector';
import { SCORING_CONFIG } from './scoring-config';
import * as T from './coaching-templates';

export interface ScorerResult {
  score: number;
  notes: string[];
}

/**
 * Score climb phases.
 * Assesses vertical speed consistency across all climb segments.
 */
export function scoreClimb(
  trackpoints: PhasedTrackpoint[],
  _events: FlightEventData[],
): ScorerResult {
  const tps = trackpoints.filter((p) => p.phase === 'climb' || p.phase === 'takeoff');
  if (tps.length === 0) return { score: 50, notes: [T.CLIMB_NO_DATA()] };

  const vsValues = tps
    .map((p) => p.vertical_speed_mps)
    .filter((v): v is number => v !== null);

  if (vsValues.length === 0) return { score: 50, notes: [T.CLIMB_NO_DATA()] };

  const sd = stdDev(vsValues);
  const notes: string[] = [];

  // HEURISTIC: Score based on how consistent (low std dev) the VS was during climb
  const ratio = (sd - SCORING_CONFIG.CLIMB.IDEAL_VS_STDDEV) /
    (SCORING_CONFIG.CLIMB.POOR_VS_STDDEV - SCORING_CONFIG.CLIMB.IDEAL_VS_STDDEV);
  const score = 100 - clamp(ratio * 100);

  if (sd <= SCORING_CONFIG.CLIMB.IDEAL_VS_STDDEV) {
    notes.push(T.CLIMB_CONSISTENT());
  } else {
    notes.push(T.CLIMB_ERRATIC(sd));
  }

  return { score: clamp(score), notes };
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
