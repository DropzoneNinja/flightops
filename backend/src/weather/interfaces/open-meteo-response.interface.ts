/**
 * Open-Meteo API Response Interface
 * Based on https://open-meteo.com/en/docs
 */

export interface OpenMeteoHourlyData {
  time: string[]; // ISO 8601 timestamps
  temperature_2m: number[]; // Temperature at 2 meters (°C)
  wind_speed_10m: number[]; // Wind speed at 10 meters (km/h)
  wind_gusts_10m: number[]; // Wind gusts at 10 meters (km/h)
  precipitation: number[]; // Precipitation (rain + snow) in mm
}

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly: OpenMeteoHourlyData;
}
