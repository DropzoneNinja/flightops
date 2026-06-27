/**
 * Utilities for converting wind speed from the backend's storage unit (km/h)
 * to the user-preferred display unit (units.wind_speed setting: 'kmh'|'mph'|'ms').
 */

export function convertWindSpeed(kmh: number, unit: string): number {
  switch (unit) {
    case 'mph': return kmh * 0.621371;
    case 'ms':  return kmh * 0.277778;
    default:    return kmh;
  }
}

export function windSpeedUnitLabel(unit: string): string {
  switch (unit) {
    case 'mph': return 'mph';
    case 'ms':  return 'm/s';
    default:    return 'km/h';
  }
}

/** Round and format a km/h value with the correct unit label. */
export function formatWindSpeed(kmh: number, unit: string, decimals = 1): string {
  return `${convertWindSpeed(kmh, unit).toFixed(decimals)} ${windSpeedUnitLabel(unit)}`;
}
