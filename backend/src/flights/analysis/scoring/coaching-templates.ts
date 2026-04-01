/**
 * Template-driven coaching note generators.
 * All coaching strings are produced here from analytics — not LLM-generated at runtime.
 */

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// --- Confidence ---
export const LOW_CONFIDENCE_DISCLAIMER = () =>
  'Note: GPS data quality is low — scores and analysis may be less accurate than usual.';

// --- Takeoff ---
export const TAKEOFF_SMOOTH = () =>
  'Takeoff was smooth with a well-established initial climb.';
export const TAKEOFF_STRONG_CLIMB = (rate: number) =>
  `Strong initial climb rate of ${rate.toFixed(1)} m/s at takeoff.`;
export const TAKEOFF_WEAK_CLIMB = (rate: number) =>
  `Initial climb rate was low at ${rate.toFixed(1)} m/s — aim for above 1.0 m/s sustained.`;
export const TAKEOFF_ERRATIC = () =>
  'Takeoff climb showed variable vertical speed — aim for a more consistent initial climb.';
export const TAKEOFF_NO_DATA = () =>
  'Takeoff phase could not be clearly assessed from GPS data.';

// --- Climb ---
export const CLIMB_CONSISTENT = () =>
  'Climb phases showed consistent vertical speed and controlled altitude gain.';
export const CLIMB_ERRATIC = (stddev: number) =>
  `Climb vertical speed varied significantly (±${stddev.toFixed(1)} m/s) — aim for smoother sustained climbs.`;
export const CLIMB_NO_DATA = () =>
  'No significant climb phase detected in this flight.';

// --- Level flight ---
export const LEVEL_EXCELLENT = (duration: number, stddev: number) =>
  `Excellent altitude control — maintained stable level flight for ${formatDuration(duration)} with only ±${Math.round(stddev * 3.28084)}ft variation.`;
export const LEVEL_GOOD = (duration: number) =>
  `Maintained level flight for ${formatDuration(duration)}.`;
export const LEVEL_POOR_VARIANCE = (stddev: number) =>
  `Altitude varied by ±${Math.round(stddev * 3.28084)}ft during cruise — aim for smoother level flight.`;
export const LEVEL_SHORT = () =>
  'Limited cruise/level flight detected — most flight time was spent in climb or descent transitions.';
export const LEVEL_NO_DATA = () =>
  'No level cruise phase detected in this flight.';

// --- Turns ---
export const TURN_SMOOTH = () =>
  'Turns were smooth and well-coordinated.';
export const TURN_ALT_LOSS = (loss: number) =>
  `Average altitude loss of ${Math.round(loss * 3.28084)}ft per turn — work on maintaining altitude through turns.`;
export const TURN_ERRATIC = () =>
  'Turn heading rate was inconsistent — aim for smoother, more sustained turns.';
export const TURN_NO_DATA = () =>
  'No significant turning segments detected in this flight.';

// --- Descent ---
export const DESCENT_CONSISTENT = () =>
  'Descent phases were controlled and consistent.';
export const DESCENT_STEEP = (rate: number) =>
  `Average descent rate of ${Math.abs(rate).toFixed(1)} m/s — consider a gentler descent profile.`;
export const DESCENT_ERRATIC = () =>
  'Descent vertical speed was variable — aim for a more controlled, consistent descent.';
export const DESCENT_NO_DATA = () =>
  'No significant descent phase detected.';

// --- Landing ---
export const LANDING_SMOOTH = (rate: number) =>
  `Good landing approach — final descent rate was ${Math.abs(rate).toFixed(1)} m/s.`;
export const LANDING_HIGH_SINK = (rate: number) =>
  `Landing descent rate of ${Math.abs(rate).toFixed(1)} m/s — aim for below 2 m/s on final approach.`;
export const LANDING_VERY_HIGH_SINK = (rate: number) =>
  `High descent rate of ${Math.abs(rate).toFixed(1)} m/s detected near touchdown — prioritize a gentler landing flare.`;
export const LANDING_NO_DATA = () =>
  'Landing phase could not be clearly assessed from GPS data.';

// --- Smoothness ---
export const SMOOTH_EXCELLENT = () =>
  'Overall flight showed excellent smoothness and precise control inputs.';
export const SMOOTH_GOOD = () =>
  'Flight was generally smooth with minor speed variations.';
export const SMOOTH_POOR = () =>
  'Flight showed significant speed and vertical speed variations — work on smoother transitions between phases.';
export const SMOOTH_NOISY_GPS = () =>
  'Note: GPS data contained noise flags that may affect smoothness assessment.';

// --- Safety ---
export const SAFETY_EXCELLENT = () =>
  'No safety concerns detected in the GPS data.';
export const SAFETY_ABRUPT = (count: number) =>
  `${count} abrupt GPS anomaly${count !== 1 ? 'ies' : ''} detected — these may indicate turbulence or GPS signal loss.`;
export const SAFETY_HIGH_DESCENT = (rate: number) =>
  `High descent rate of ${Math.abs(rate).toFixed(1)} m/s detected — ensure adequate altitude margin above terrain.`;
