import { NormalizedTrackpoint } from '../gpx-normalizer.service';

/**
 * Standalone confidence scorer for flight GPS data quality.
 *
 * The normalizer already computes a basic confidence score during parsing.
 * This module provides a richer standalone version for use in the full
 * analysis pipeline, with additional factors like phase-detection quality.
 *
 * All penalties are documented with HEURISTIC comments.
 */
export function computeConfidence(trackpoints: NormalizedTrackpoint[]): number {
  if (trackpoints.length === 0) return 0;

  let score = 1.0;

  // HEURISTIC: Very few points = unreliable
  if (trackpoints.length < 100) score -= 0.2;
  else if (trackpoints.length < 300) score -= 0.05;

  // HEURISTIC: Missing elevation reduces analysis quality significantly
  const hasElevation = trackpoints.some((p) => p.elevation_m !== null);
  if (!hasElevation) score -= 0.2;

  // HEURISTIC: No timestamps = severely limited analysis capability
  const hasTimestamps = trackpoints.some((p) => p.timestamp !== null);
  if (!hasTimestamps) {
    score -= 0.3;
  } else {
    const timed = trackpoints.filter((p) => p.timestamp !== null);

    // HEURISTIC: Gaps > 5s or > 30s in timestamps degrade phase detection accuracy
    let gapPenalty = 0;
    for (let i = 1; i < timed.length; i++) {
      const dt = (timed[i].timestamp!.getTime() - timed[i - 1].timestamp!.getTime()) / 1000;
      if (dt > 30) gapPenalty += 0.02;
      else if (dt > 5) gapPenalty += 0.005;
    }
    score -= Math.min(gapPenalty, 0.3);

    // HEURISTIC: Average inter-point interval > 5s makes rolling-window analysis unreliable
    const totalDuration =
      (timed[timed.length - 1].timestamp!.getTime() - timed[0].timestamp!.getTime()) / 1000;
    const avgInterval = timed.length > 1 ? totalDuration / (timed.length - 1) : 0;
    if (avgInterval > 5) score -= 0.1;
  }

  // HEURISTIC: High fraction of noise-flagged points = unreliable GPS signal
  const noiseCount = trackpoints.filter((p) => p.noise_flag).length;
  const noiseFraction = noiseCount / trackpoints.length;
  score -= noiseFraction * 0.4;

  return Math.max(0, Math.min(1, parseFloat(score.toFixed(3))));
}
