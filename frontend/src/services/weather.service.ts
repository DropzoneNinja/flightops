import { api } from './api';

export interface HourlyWeatherData {
  timestamp: string;
  temperature: number;
  windSpeed: number;
  windDirection: number;
  gustSpeed: number;
  gustSpread: number;
  rain: number;
  cloudCover?: number | null;
  cloudBase?: number | null;
  windScore: number;
  gustScore: number;
  gustSpreadScore: number;
  rainScore: number;
  cloudScore: number;
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
  fog?: boolean;
}

export interface MultiHeightHourlyData {
  timestamp: string;
  cloud_base?: number | null;
  cloud_cover?: number | null;
  has_fog?: boolean;
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
    date: string; // YYYY-MM-DD format
    count: number;
  };
  maxPerHour: {
    hour: string; // ISO 8601 timestamp (e.g., '2024-01-15T14:00:00.000Z')
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

  /**
   * Connect to weather update event stream
   * Returns EventSource instance - caller should close() when done
   * @param onUpdate Callback when weather is updated for a site
   */
  connectToWeatherUpdates(onUpdate: (siteId: string) => void): EventSource {
    // Use the same base URL as the rest of the API for consistency
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

    // EventSource doesn't support custom headers, so we pass the token as a query parameter
    const token = localStorage.getItem('access_token');
    const url = token
      ? `${baseUrl}/weather/events?token=${encodeURIComponent(token)}`
      : `${baseUrl}/weather/events`;

    const eventSource = new EventSource(url, {
      withCredentials: true,
    });

    eventSource.addEventListener('weather-update', (event) => {
      try {
        const data = JSON.parse(event.data);
        onUpdate(data.siteId);
      } catch (error) {
        console.error('Failed to parse weather update event:', error);
      }
    });

    eventSource.onerror = (error) => {
      console.error('Weather SSE connection error:', error);
    };

    return eventSource;
  },
};
