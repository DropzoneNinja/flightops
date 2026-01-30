/**
 * Open-Meteo API Response Interface
 * Based on https://open-meteo.com/en/docs
 */

export interface OpenMeteoHourlyData {
  time: string[]; // ISO 8601 timestamps
  temperature_2m: number[]; // Temperature at 2 meters (°C)
  wind_speed_10m: number[]; // Wind speed at 10 meters (km/h)
  wind_direction_10m: number[]; // Wind direction at 10 meters (degrees)
  wind_gusts_10m: number[]; // Wind gusts at 10 meters (km/h)
  precipitation: number[]; // Precipitation (rain + snow) in mm
  cloud_cover: number[]; // Total cloud cover (%)
  cloud_cover_low: number[]; // Low-level cloud cover 0-3km (%)
}

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly: OpenMeteoHourlyData;
}

/**
 * Open-Meteo Multi-Height Wind Data Interface
 * For fetching wind data at multiple heights for debug visualization
 */
export interface OpenMeteoMultiHeightHourlyData {
  time: string[]; // ISO 8601 timestamps
  wind_speed_10m: number[]; // Wind speed at 10 meters (km/h)
  wind_direction_10m: number[]; // Wind direction at 10 meters (degrees)
  wind_speed_80m: number[]; // Wind speed at 80 meters (km/h)
  wind_direction_80m: number[]; // Wind direction at 80 meters (degrees)
  wind_speed_120m: number[]; // Wind speed at 120 meters (km/h)
  wind_direction_120m: number[]; // Wind direction at 120 meters (degrees)
  temperature_2m: number[]; // Temperature at 2 meters (°C)
  temperature_80m: number[]; // Temperature at 80 meters (°C)
  temperature_120m: number[]; // Temperature at 120 meters (°C)
  precipitation: number[]; // Precipitation (rain + snow) in mm
  wind_gusts_10m: number[]; // Wind gusts at 10 meters (km/h)
  cloud_cover: number[]; // Total cloud cover (%)
  cloud_cover_low: number[]; // Low-level cloud cover 0-3km (%)
}

export interface OpenMeteoMultiHeightResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly: OpenMeteoMultiHeightHourlyData;
}
