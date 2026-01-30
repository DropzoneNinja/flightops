import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import * as http from 'http';
import {
  OpenMeteoResponse,
  OpenMeteoMultiHeightResponse,
} from '../interfaces/open-meteo-response.interface';
import { WeatherStatsService } from './weather-stats.service';

@Injectable()
export class OpenMeteoService {
  private readonly logger = new Logger(OpenMeteoService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly BASE_URL = 'https://api.open-meteo.com/v1/forecast';

  constructor(private readonly weatherStatsService: WeatherStatsService) {
    // Force IPv4 by creating custom agents
    const httpsAgent = new https.Agent({
      family: 4, // Force IPv4 (4 = IPv4, 6 = IPv6)
      keepAlive: true,
      timeout: 30000,
    });

    const httpAgent = new http.Agent({
      family: 4, // Force IPv4
      keepAlive: true,
      timeout: 30000,
    });

    this.axiosInstance = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000, // 30 second timeout (increased for production)
      httpAgent,
      httpsAgent,
      headers: {
        'User-Agent': 'FlightOps-Weather-Service/1.0',
      },
    });

    // Log axios request/response for debugging network issues
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.debug(`Requesting: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error(`Request setup failed: ${error.message}`);
        return Promise.reject(error);
      },
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.debug(`Response received: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        if (error.code === 'ETIMEDOUT') {
          this.logger.error(
            `Connection timeout - unable to reach ${this.BASE_URL}. ` +
            `Check network connectivity and DNS resolution.`,
          );
        } else if (error.code === 'ENOTFOUND') {
          this.logger.error(
            `DNS resolution failed for ${this.BASE_URL}. ` +
            `Check DNS configuration in Docker.`,
          );
        } else if (error.code === 'ECONNREFUSED') {
          this.logger.error(
            `Connection refused by ${this.BASE_URL}. ` +
            `Check firewall settings.`,
          );
        }
        return Promise.reject(error);
      },
    );
  }

  /**
   * Fetch weather forecast for a specific location
   * @param latitude Site latitude
   * @param longitude Site longitude
   * @param forecastDays Number of forecast days (default: 3)
   * @returns Open-Meteo API response with hourly data
   */
  async fetchForecast(
    latitude: number,
    longitude: number,
    forecastDays = 3,
  ): Promise<OpenMeteoResponse> {
    try {
      this.logger.log(
        `Fetching ${forecastDays}-day forecast for (${latitude}, ${longitude})`,
      );

      const response = await this.axiosInstance.get<OpenMeteoResponse>('', {
        params: {
          latitude,
          longitude,
          hourly: [
            'temperature_2m',
            'wind_speed_10m',
            'wind_direction_10m',
            'wind_gusts_10m',
            'precipitation',
            'cloud_cover',
            'cloud_cover_low',
          ].join(','),
          timezone: 'auto',
          forecast_days: forecastDays,
        },
      });

      this.logger.log(
        `Successfully fetched forecast for (${latitude}, ${longitude})`,
      );

      // Log external API call to Open-Meteo
      await this.weatherStatsService.logApiCall(
        'Open-Meteo: GET /forecast (standard)',
      );

      return response.data;
    } catch (error) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
      };
      this.logger.error(
        `Failed to fetch forecast for (${latitude}, ${longitude}): ${JSON.stringify(errorDetails)}`,
      );
      throw new Error(
        `Open-Meteo API error: ${error.response?.data?.reason || error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Fetch forecast with retry logic
   * @param latitude Site latitude
   * @param longitude Site longitude
   * @param forecastDays Number of forecast days
   * @param maxRetries Maximum number of retry attempts
   * @returns Open-Meteo API response
   */
  async fetchForecastWithRetry(
    latitude: number,
    longitude: number,
    forecastDays = 3,
    maxRetries = 3,
  ): Promise<OpenMeteoResponse> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.fetchForecast(latitude, longitude, forecastDays);
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Attempt ${attempt}/${maxRetries} failed for (${latitude}, ${longitude})`,
        );

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(
      `All ${maxRetries} attempts failed for (${latitude}, ${longitude})`,
    );
    throw lastError;
  }

  /**
   * Fetch multi-height wind forecast for a specific date and location
   * Used for debug visualization of wind data at different altitudes
   * @param latitude Site latitude
   * @param longitude Site longitude
   * @param dateString Date in YYYY-MM-DD format
   * @returns Open-Meteo API response with multi-height wind data
   */
  async fetchMultiHeightForecast(
    latitude: number,
    longitude: number,
    dateString: string,
  ): Promise<OpenMeteoMultiHeightResponse> {
    try {
      this.logger.log(
        `Fetching multi-height forecast for (${latitude}, ${longitude}) on ${dateString}`,
      );

      const response = await this.axiosInstance.get<OpenMeteoMultiHeightResponse>(
        '',
        {
          params: {
            latitude,
            longitude,
            hourly: [
              'wind_speed_10m',
              'wind_direction_10m',
              'wind_speed_80m',
              'wind_direction_80m',
              'wind_speed_120m',
              'wind_direction_120m',
              'temperature_2m',
              'temperature_80m',
              'temperature_120m',
              'precipitation',
              'wind_gusts_10m',
              'cloud_cover',
              'cloud_cover_low',
            ].join(','),
            timezone: 'auto',
            start_date: dateString,
            end_date: dateString,
          },
        },
      );

      this.logger.log(
        `Successfully fetched multi-height forecast for (${latitude}, ${longitude})`,
      );

      // Log external API call to Open-Meteo
      await this.weatherStatsService.logApiCall(
        'Open-Meteo: GET /forecast (multi-height)',
      );

      return response.data;
    } catch (error) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
      };
      this.logger.error(
        `Failed to fetch multi-height forecast: ${JSON.stringify(errorDetails)}`,
      );
      throw new Error(
        `Open-Meteo API error: ${error.response?.data?.reason || error.message || 'Unknown error'}`,
      );
    }
  }
}
