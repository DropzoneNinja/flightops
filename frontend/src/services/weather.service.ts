import { api } from './api';

export interface HourlyWeatherData {
  timestamp: string;
  temperature: number;
  windSpeed: number;
  gustSpeed: number;
  gustSpread: number;
  rain: number;
  windScore: number;
  gustScore: number;
  gustSpreadScore: number;
  rainScore: number;
  overallScore: number;
}

export interface WeatherForecast {
  id: string;
  siteId: string;
  date: string;
  sunrise: string;
  sunset: string;
  hourlyData: HourlyWeatherData[];
}

export const weatherService = {
  /**
   * Get forecast for a site (next 3 days)
   */
  async getForecastBySite(siteId: string): Promise<WeatherForecast[]> {
    const response = await api.get(`/sites/${siteId}/forecast`);
    return response.data;
  },

  /**
   * Get forecast for a specific date
   */
  async getForecastByDate(
    siteId: string,
    date: string,
  ): Promise<WeatherForecast> {
    const response = await api.get(`/sites/${siteId}/forecast/${date}`);
    return response.data;
  },
};
