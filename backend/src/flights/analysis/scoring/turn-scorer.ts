import { PhasedTrackpoint } from '../phase-detector';
import { FlightEventData } from '../event-detector';
import { SCORING_CONFIG } from './scoring-config';
import * as T from './coaching-templates';

export interface ScorerResult {
  score: number;
  notes: string[];
}

/**
 * Score turn quality.
 * Assesses heading-rate consistency and altitude loss during turns.
 */
export function scoreTurn(
  trackpoints: PhasedTrackpoint[],
  _events: FlightEventData[],
): ScorerResult {
  const tps = trackpoints.filter((p) => p.phase === 'turn');
  if (tps.length === 0) return { score: 70, notes: [T.TURN_NO_DATA()] };

  const notes: string[] = [];
  let score = 100;

  // HEURISTIC: Assess altitude loss during turns
  const elevations = tps
    .map((p) => p.elevation_m)
    .filter((e): e is number => e !== null);

  if (elevations.length >= 2) {
    const altLoss = Math.max(0, Math.max(...elevations) - Math.min(...elevations));
    const avgAltLossPerSeg = altLoss / Math.max(1, countTurnSegments(trackpoints));

    if (avgAltLossPerSeg > SCORING_CONFIG.TURN.POOR_ALT_LOSS_M) {
      score -= 30;
      notes.push(T.TURN_ALT_LOSS(avgAltLossPerSeg));
    }
  }

  // HEURISTIC: Assess heading rate consistency
  const headingRates = computeHeadingRates(tps);
  if (headingRates.length >= 2) {
    const sd = stdDev(headingRates);
    if (sd > SCORING_CONFIG.TURN.IDEAL_HEADING_RATE_STDDEV * 3) {
      score -= 20;
      notes.push(T.TURN_ERRATIC());
    }
  }

  if (notes.length === 0) notes.push(T.TURN_SMOOTH());

  return { score: clamp(score), notes };
}

function countTurnSegments(trackpoints: PhasedTrackpoint[]): number {
  let count = 0;
  let inTurn = false;
  for (const tp of trackpoints) {
    if (tp.phase === 'turn' && !inTurn) { count++; inTurn = true; }
    else if (tp.phase !== 'turn') { inTurn = false; }
  }
  return Math.max(1, count);
}

function computeHeadingRates(tps: PhasedTrackpoint[]): number[] {
  const rates: number[] = [];
  for (let i = 0; i < tps.length - 1; i++) {
    const curr = tps[i];
    const next = tps[i + 1];
    if (curr.heading_deg !== null && next.heading_deg !== null &&
        curr.timestamp && next.timestamp) {
      const dt = (next.timestamp.getTime() - curr.timestamp.getTime()) / 1000;
      if (dt > 0) {
        rates.push(headingDiff(curr.heading_deg, next.heading_deg) / dt);
      }
    }
  }
  return rates;
}

function headingDiff(h1: number, h2: number): number {
  let diff = Math.abs(h2 - h1) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
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
