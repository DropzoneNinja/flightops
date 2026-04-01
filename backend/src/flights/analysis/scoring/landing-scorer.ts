import { PhasedTrackpoint } from '../phase-detector';
import { FlightEventData } from '../event-detector';
import { SCORING_CONFIG } from './scoring-config';
import * as T from './coaching-templates';

export interface ScorerResult {
  score: number;
  notes: string[];
}

/**
 * Score the landing phase.
 * Assesses final descent rate in the FINAL_WINDOW_SEC before touchdown.
 * This is the most heavily weighted category.
 */
export function scoreLanding(
  trackpoints: PhasedTrackpoint[],
  _events: FlightEventData[],
): ScorerResult {
  // Find landing and approach points
  const approachPoints = trackpoints.filter(
    (p) => p.phase === 'approach' || p.phase === 'landing',
  );

  if (approachPoints.length === 0) return { score: 50, notes: [T.LANDING_NO_DATA()] };

  // Get VS values from the final approach window
  const lastPoint = approachPoints[approachPoints.length - 1];
  const windowStart = lastPoint.timestamp
    ? new Date(lastPoint.timestamp.getTime() - SCORING_CONFIG.LANDING.FINAL_WINDOW_SEC * 1000)
    : null;

  const finalPoints = windowStart
    ? approachPoints.filter(
        (p) => p.timestamp !== null && p.timestamp >= windowStart,
      )
    : approachPoints.slice(-10); // fallback: last 10 points

  const vsValues = finalPoints
    .map((p) => p.vertical_speed_mps)
    .filter((v): v is number => v !== null && v < 0); // only descending values

  if (vsValues.length === 0) return { score: 60, notes: [T.LANDING_NO_DATA()] };

  const avgFinalVS = vsValues.reduce((a, b) => a + b, 0) / vsValues.length;
  const notes: string[] = [];
  let score = 100;

  // HEURISTIC: Score based on final approach descent rate
  if (avgFinalVS < SCORING_CONFIG.LANDING.VERY_HIGH_SINK_MPS) {
    score -= 60;
    notes.push(T.LANDING_VERY_HIGH_SINK(avgFinalVS));
  } else if (avgFinalVS < SCORING_CONFIG.LANDING.HIGH_SINK_MPS) {
    score -= 30;
    notes.push(T.LANDING_HIGH_SINK(avgFinalVS));
  } else {
    notes.push(T.LANDING_SMOOTH(avgFinalVS));
  }

  return { score: clamp(score), notes };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}
