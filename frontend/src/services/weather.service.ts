import { api } from './api';

export interface HourlyWeatherData {
  timestamp: string;
  temperature: number;
  windSpeed: number;
  windDirection: number;
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

export interface MultiHeightWindData {
  speed: number;
  direction: number;
  temperature?: number | null;
  precipitation?: number | null;
  gusts?: number | null;
}

export interface MultiHeightHourlyData {
  timestamp: string;
  wind_10m: MultiHeightWindData;
  wind_80m: MultiHeightWindData;
  wind_120m: MultiHeightWindData;
}

export interface MultiHeightForecast {
  date: string;
  sunrise: string;
  sunset: string;
  hourlyData: MultiHeightHourlyData[];
}

export interface EndpointStats {
  endpoint: string;
  count: number;
}

export interface WeatherApiStats {
  endpointCounts: EndpointStats[];
  maxPerDay: {
    date: string;
    count: number;
  };
  maxPerHour: {
    hour: string;
    count: number;
  };
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

  /**
   * Get multi-height wind data for a specific date (debug mode)
   */
  async getMultiHeightData(
    siteId: string,
    date: string,
  ): Promise<MultiHeightForecast> {
    const response = await api.get(`/sites/${siteId}/forecast/${date}/multi-height`);
    return response.data;
  },

  /**
   * Get weather API statistics (admin only)
   */
  async getStats(): Promise<WeatherApiStats> {
    const response = await api.get('/weather/stats');
    return response.data;
  },

  /**
   * Reset weather API statistics (admin only)
   */
  async resetStats(): Promise<void> {
    await api.delete('/weather/stats');
  },
};
