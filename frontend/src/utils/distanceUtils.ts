/**
 * Distance utilities for plot/measurement functionality
 * Uses Haversine formula to calculate distances between geographic coordinates
 */

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two geographic points using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert kilometers to miles
 * @param km Distance in kilometers
 * @returns Distance in miles
 */
export function kmToMiles(km: number): number {
  return km * 0.621371;
}

/**
 * Format distance with appropriate unit
 * @param distanceKm Distance in kilometers
 * @param unit 'km' or 'mi'
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted distance string (e.g., "1.23 km")
 */
export function formatDistance(
  distanceKm: number,
  unit: 'km' | 'mi',
  decimals: number = 2
): string {
  const distance = unit === 'mi' ? kmToMiles(distanceKm) : distanceKm;
  return `${distance.toFixed(decimals)} ${unit}`;
}

/**
 * Calculate time based on distance and speed
 * @param distanceKm Distance in kilometers
 * @param speedKmh Average speed in km/h
 * @returns Time in hours
 */
export function calculateTime(distanceKm: number, speedKmh: number): number {
  if (speedKmh <= 0) return 0;
  return distanceKm / speedKmh;
}

/**
 * Format time in hours to readable format
 * @param hours Time in hours
 * @returns Formatted time string (e.g., "1h 23m" or "15m")
 */
export function formatTime(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

/**
 * Calculate total distance of a plot (closed polygon)
 * Includes all segments between consecutive points plus the closing segment
 * @param points Array of lat/lon points
 * @returns Total perimeter distance in kilometers
 */
export function calculatePlotDistance(
  points: Array<{ lat: number; lon: number }>
): number {
  if (points.length < 2) return 0;

  let total = 0;

  // Calculate distance between consecutive points
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateDistance(
      points[i].lat,
      points[i].lon,
      points[i + 1].lat,
      points[i + 1].lon
    );
  }

  // Add closing segment (last point back to first)
  if (points.length > 2) {
    total += calculateDistance(
      points[points.length - 1].lat,
      points[points.length - 1].lon,
      points[0].lat,
      points[0].lon
    );
  }

  return total;
}

/**
 * Calculate compass bearing from point A to point B
 * @returns Bearing in degrees (0–360, clockwise from North)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLon = toRad(lon2 - lon1);
  const lat1R = toRad(lat1);
  const lat2R = toRad(lat2);
  const y = Math.sin(dLon) * Math.cos(lat2R);
  const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Effective ground speed accounting for wind.
 * @param airSpeed Aircraft airspeed in km/h
 * @param windSpeed Wind speed in km/h
 * @param windFromDeg Direction wind is coming FROM in degrees (meteorological convention)
 * @param bearingDeg Flight bearing in degrees
 * @returns Ground speed in km/h (minimum 1)
 */
export function windAdjustedSpeed(
  airSpeed: number,
  windSpeed: number,
  windFromDeg: number,
  bearingDeg: number,
): number {
  const headwind = windSpeed * Math.cos(toRad(bearingDeg - windFromDeg));
  return Math.max(1, airSpeed - headwind);
}

/**
 * Calculate total time for a plot based on average speed
 * @param points Array of lat/lon points
 * @param speedKmh Average speed in km/h
 * @returns Total time in hours
 */
export function calculatePlotTime(
  points: Array<{ lat: number; lon: number }>,
  speedKmh: number
): number {
  const totalDistance = calculatePlotDistance(points);
  return calculateTime(totalDistance, speedKmh);
}
