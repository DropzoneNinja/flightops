import { PhasedTrackpoint } from '../phase-detector';
import { FlightEventData } from '../event-detector';
import { SCORING_CONFIG } from './scoring-config';
import * as T from './coaching-templates';

export interface ScorerResult {
  score: number;
  notes: string[];
}

/**
 * Score descent phase quality.
 * Assesses vertical speed consistency and average descent rate.
 */
export function scoreDescent(
  trackpoints: PhasedTrackpoint[],
  _events: FlightEventData[],
): ScorerResult {
  const tps = trackpoints.filter((p) => p.phase === 'descent');
  if (tps.length === 0) return { score: 70, notes: [T.DESCENT_NO_DATA()] };

  const vsValues = tps
    .map((p) => p.vertical_speed_mps)
    .filter((v): v is number => v !== null);

  if (vsValues.length === 0) return { score: 70, notes: [T.DESCENT_NO_DATA()] };

  const avgVS = vsValues.reduce((a, b) => a + b, 0) / vsValues.length;
  const sd = stdDev(vsValues);
  const notes: string[] = [];
  let score = 100;

  // HEURISTIC: Penalize steep average descent rate
  if (avgVS < SCORING_CONFIG.DESCENT.STEEP_DESCENT_MPS) {
    score -= 30;
    notes.push(T.DESCENT_STEEP(avgVS));
  }

  // HEURISTIC: Penalize erratic VS during descent
  if (sd > SCORING_CONFIG.DESCENT.POOR_VS_STDDEV) {
    score -= 30;
    notes.push(T.DESCENT_ERRATIC());
  } else if (sd <= SCORING_CONFIG.DESCENT.IDEAL_VS_STDDEV) {
    notes.push(T.DESCENT_CONSISTENT());
  }

  if (notes.length === 0) notes.push(T.DESCENT_CONSISTENT());

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
