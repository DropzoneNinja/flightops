import { PhasedTrackpoint } from '../phase-detector';
import { FlightEventData } from '../event-detector';
import { computeConfidence } from '../confidence';
import { SCORING_CONFIG } from './scoring-config';
import { SCORING_VERSION } from './scoring-version';
import * as T from './coaching-templates';
import { scoreTakeoff } from './takeoff-scorer';
import { scoreClimb } from './climb-scorer';
import { scoreLevel } from './level-scorer';
import { scoreTurn } from './turn-scorer';
import { scoreDescent } from './descent-scorer';
import { scoreLanding } from './landing-scorer';
import { scoreSmoothness } from './smoothness-scorer';
import { scoreSafety } from './safety-scorer';
import { NormalizedTrackpoint } from '../../gpx-normalizer.service';

export interface FlightScoreData {
  scoring_version: string;
  overall_score: number;
  takeoff_score: number | null;
  climb_score: number | null;
  level_score: number | null;
  turn_score: number | null;
  descent_score: number | null;
  landing_score: number | null;
  smoothness_score: number | null;
  safety_score: number | null;
  explanation_json: string[];
}

/**
 * Orchestrate all category scorers and produce a final FlightScoreData.
 * Pure function — deterministic given the same inputs.
 */
export function scoreFlight(
  trackpoints: PhasedTrackpoint[],
  events: FlightEventData[],
): FlightScoreData {
  const confidence = computeConfidence(trackpoints as NormalizedTrackpoint[]);
  const allNotes: string[] = [];

  // Add confidence disclaimer when data quality is low
  if (confidence < SCORING_CONFIG.LOW_CONFIDENCE_THRESHOLD) {
    allNotes.push(T.LOW_CONFIDENCE_DISCLAIMER());
  }

  // Run all category scorers
  const takeoff = scoreTakeoff(trackpoints, events);
  const climb = scoreClimb(trackpoints, events);
  const level = scoreLevel(trackpoints, events);
  const turn = scoreTurn(trackpoints, events);
  const descent = scoreDescent(trackpoints, events);
  const landing = scoreLanding(trackpoints, events);
  const smoothness = scoreSmoothness(trackpoints, events);
  const safety = scoreSafety(trackpoints, events);

  // Collect all coaching notes
  allNotes.push(...takeoff.notes);
  allNotes.push(...climb.notes);
  allNotes.push(...level.notes);
  allNotes.push(...turn.notes);
  allNotes.push(...descent.notes);
  allNotes.push(...landing.notes);
  allNotes.push(...smoothness.notes);
  allNotes.push(...safety.notes);

  // Compute weighted overall score
  const w = SCORING_CONFIG.WEIGHTS;
  const overall =
    takeoff.score * w.takeoff +
    climb.score * w.climb +
    level.score * w.level +
    turn.score * w.turn +
    descent.score * w.descent +
    landing.score * w.landing +
    smoothness.score * w.smoothness +
    safety.score * w.safety;

  return {
    scoring_version: SCORING_VERSION,
    overall_score: Math.round(Math.max(0, Math.min(100, overall))),
    takeoff_score: takeoff.score,
    climb_score: climb.score,
    level_score: level.score,
    turn_score: turn.score,
    descent_score: descent.score,
    landing_score: landing.score,
    smoothness_score: smoothness.score,
    safety_score: safety.score,
    explanation_json: allNotes,
  };
}
