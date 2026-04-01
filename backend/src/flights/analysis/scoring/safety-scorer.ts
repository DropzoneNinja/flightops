import { PhasedTrackpoint } from '../phase-detector';
import { FlightEventData } from '../event-detector';
import { SCORING_CONFIG } from './scoring-config';
import * as T from './coaching-templates';

export interface ScorerResult {
  score: number;
  notes: string[];
}

/**
 * Score flight safety proxy.
 * Penalises abrupt GPS anomalies and high descent rates.
 */
export function scoreSafety(
  trackpoints: PhasedTrackpoint[],
  events: FlightEventData[],
): ScorerResult {
  const notes: string[] = [];
  let score = 100;

  // HEURISTIC: Each abrupt_change event deducts points (capped at 40)
  const abruptEvents = events.filter((e) => e.event_type === 'abrupt_change');
  if (abruptEvents.length > 0) {
    const penalty = Math.min(40, abruptEvents.length * SCORING_CONFIG.SAFETY.ABRUPT_CHANGE_PENALTY);
    score -= penalty;
    notes.push(T.SAFETY_ABRUPT(abruptEvents.length));
  }

  // HEURISTIC: Very high descent rates are a safety concern
  const minVS = Math.min(
    ...trackpoints
      .map((p) => p.vertical_speed_mps)
      .filter((v): v is number => v !== null),
  );

  if (isFinite(minVS) && minVS < SCORING_CONFIG.SAFETY.HIGH_DESCENT_THRESHOLD_MPS) {
    score -= 20;
    notes.push(T.SAFETY_HIGH_DESCENT(minVS));
  }

  if (notes.length === 0) notes.push(T.SAFETY_EXCELLENT());

  return { score: clamp(score), notes };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}
