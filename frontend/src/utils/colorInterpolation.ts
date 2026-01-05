/**
 * Convert PPG safety score (0-100) to heat bar color using RGB linear interpolation
 *
 * This function implements the SCORING.md color specification:
 * - Score 0: #B00020 (deep red)
 * - Score 25: #E53935 (red)
 * - Score 50: #FDD835 (yellow)
 * - Score 75: #43A047 (green)
 * - Score 100: #1B5E20 (deep green)
 *
 * @param score Safety score (0-100)
 * @returns Hex color string
 */
export function scoreToHeatColor(score: number): string {
  // Clamp score to 0-100 range
  const clampedScore = Math.max(0, Math.min(100, score));

  // Define color stops with RGB values
  const COLOR_STOPS = [
    { score: 0, r: 176, g: 0, b: 32 }, // #B00020 deep red
    { score: 25, r: 229, g: 57, b: 53 }, // #E53935 red
    { score: 50, r: 253, g: 216, b: 53 }, // #FDD835 yellow
    { score: 75, r: 67, g: 160, b: 71 }, // #43A047 green
    { score: 100, r: 27, g: 94, b: 32 }, // #1B5E20 deep green
  ];

  // Find the two color stops to interpolate between
  let lowerStop = COLOR_STOPS[0];
  let upperStop = COLOR_STOPS[COLOR_STOPS.length - 1];

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (
      clampedScore >= COLOR_STOPS[i].score &&
      clampedScore <= COLOR_STOPS[i + 1].score
    ) {
      lowerStop = COLOR_STOPS[i];
      upperStop = COLOR_STOPS[i + 1];
      break;
    }
  }

  // Calculate interpolation factor (0 to 1)
  const range = upperStop.score - lowerStop.score;
  const factor = range === 0 ? 0 : (clampedScore - lowerStop.score) / range;

  // Linear interpolation in RGB space
  const r = Math.round(lowerStop.r + (upperStop.r - lowerStop.r) * factor);
  const g = Math.round(lowerStop.g + (upperStop.g - lowerStop.g) * factor);
  const b = Math.round(lowerStop.b + (upperStop.b - lowerStop.b) * factor);

  // Convert to hex with zero-padding
  const toHex = (value: number) => value.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
