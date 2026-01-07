import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';
import { WeatherForecast } from '../database/entities/weather-forecast.entity';
import { WeatherHourly } from '../database/entities/weather-hourly.entity';
import { WeatherMultiHeight } from '../database/entities/weather-multi-height.entity';
import { FlightSite } from '../database/entities/flight-site.entity';
import { OpenMeteoService } from './services/open-meteo.service';
import { OpenMeteoMultiHeightResponse } from './interfaces/open-meteo-response.interface';

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(
    @InjectRepository(WeatherForecast)
    private readonly forecastRepository: Repository<WeatherForecast>,
    @InjectRepository(WeatherHourly)
    private readonly hourlyRepository: Repository<WeatherHourly>,
    @InjectRepository(WeatherMultiHeight)
    private readonly multiHeightRepository: Repository<WeatherMultiHeight>,
    @InjectRepository(FlightSite)
    private readonly siteRepository: Repository<FlightSite>,
    private readonly openMeteoService: OpenMeteoService,
  ) {}

  /**
   * Get forecast data for a site (next 3 days from today)
   * Returns forecast with hourly data included
   */
  async getForecastBySite(siteId: string, userId: string) {
    // Verify the site exists and user has access
    const site = await this.siteRepository.findOne({
      where: { id: siteId, user_id: userId },
    });

    if (!site) {
      throw new NotFoundException('Site not found or access denied');
    }

    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get date 3 days from now
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Fetch forecasts for the next 3 days, including hourly data
    const forecasts = await this.forecastRepository.find({
      where: {
        site: { id: siteId },
        forecast_date: Between(today, threeDaysFromNow),
      },
      relations: ['hourly_data'],
      order: {
        forecast_date: 'ASC',
        hourly_data: {
          timestamp: 'ASC',
        },
      },
    });

    return forecasts.map((forecast) => this.formatForecastResponse(forecast));
  }

  /**
   * Get forecast for a specific date
   */
  async getForecastByDate(siteId: string, userId: string, dateString: string) {
    // Verify the site exists and user has access
    const site = await this.siteRepository.findOne({
      where: { id: siteId, user_id: userId },
    });

    if (!site) {
      throw new NotFoundException('Site not found or access denied');
    }

    // Parse the date string (YYYY-MM-DD)
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);

    // Get the next day to create a range
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // Fetch the forecast for the specific date
    const forecast = await this.forecastRepository.findOne({
      where: {
        site: { id: siteId },
        forecast_date: Between(date, nextDay),
      },
      relations: ['hourly_data'],
      order: {
        hourly_data: {
          timestamp: 'ASC',
        },
      },
    });

    if (!forecast) {
      return null;
    }

    return this.formatForecastResponse(forecast);
  }

  /**
   * Format forecast response for frontend consumption
   */
  private formatForecastResponse(forecast: WeatherForecast) {
    return {
      id: forecast.id,
      siteId: forecast.site_id,
      date: forecast.forecast_date,
      sunrise: forecast.sunrise,
      sunset: forecast.sunset,
      hourlyData: forecast.hourly_data.map((hourly) => ({
        timestamp: hourly.timestamp,
        temperature: parseFloat(hourly.temperature.toString()),
        windSpeed: parseFloat(hourly.wind_speed.toString()),
        windDirection: parseFloat(hourly.wind_direction.toString()),
        gustSpeed: parseFloat(hourly.gust_speed.toString()),
        gustSpread: parseFloat(hourly.gust_spread.toString()),
        rain: parseFloat(hourly.rain.toString()),
        windScore: hourly.wind_score,
        gustScore: hourly.gust_score,
        gustSpreadScore: hourly.gust_spread_score,
        rainScore: hourly.rain_score,
        overallScore: hourly.overall_score,
      })),
    };
  }

  /**
   * Get multi-height wind data for a specific date (debug mode)
   * Checks database cache first, fetches from Open-Meteo if not cached
   */
  async getMultiHeightData(
    siteId: string,
    userId: string,
    dateString: string,
  ) {
    // 1. Verify site access
    const site = await this.siteRepository.findOne({
      where: { id: siteId, user_id: userId },
    });

    if (!site) {
      throw new NotFoundException('Site not found or access denied');
    }

    // 2. Get forecast for this date
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const forecast = await this.forecastRepository.findOne({
      where: {
        site: { id: siteId },
        forecast_date: Between(date, nextDay),
      },
      relations: ['multi_height_data'],
    });

    if (!forecast) {
      throw new NotFoundException(`No forecast data for ${dateString}`);
    }

    // 3. Check if multi-height data exists in DB
    if (forecast.multi_height_data && forecast.multi_height_data.length > 0) {
      this.logger.log(`Using cached multi-height data for ${dateString}`);
      return this.formatMultiHeightResponse(forecast);
    }

    // 4. Fetch from Open-Meteo
    this.logger.log(`Fetching fresh multi-height data for ${dateString}`);
    const openMeteoData = await this.openMeteoService.fetchMultiHeightForecast(
      parseFloat(site.takeoff_lat.toString()),
      parseFloat(site.takeoff_lon.toString()),
      dateString,
    );

    // 5. Save to database
    const multiHeightRecords = this.createMultiHeightRecords(
      forecast.id,
      openMeteoData,
    );
    await this.multiHeightRepository.save(multiHeightRecords);

    // 6. Reload forecast with new data
    const updatedForecast = await this.forecastRepository.findOne({
      where: { id: forecast.id },
      relations: ['multi_height_data'],
    });

    return this.formatMultiHeightResponse(updatedForecast);
  }

  /**
   * Convert Open-Meteo response to WeatherMultiHeight entity records
   */
  private createMultiHeightRecords(
    forecastId: string,
    openMeteoData: OpenMeteoMultiHeightResponse,
  ): WeatherMultiHeight[] {
    const {
      time,
      wind_speed_10m,
      wind_direction_10m,
      wind_speed_80m,
      wind_direction_80m,
      wind_speed_120m,
      wind_direction_120m,
    } = openMeteoData.hourly;

    return time.map((timestamp, index) => {
      return this.multiHeightRepository.create({
        forecast_id: forecastId,
        timestamp: new Date(timestamp),
        wind_speed_10m: wind_speed_10m[index],
        wind_direction_10m: wind_direction_10m[index],
        wind_speed_80m: wind_speed_80m[index],
        wind_direction_80m: wind_direction_80m[index],
        wind_speed_120m: wind_speed_120m[index],
        wind_direction_120m: wind_direction_120m[index],
      });
    });
  }

  /**
   * Format multi-height data for frontend consumption
   */
  private formatMultiHeightResponse(forecast: WeatherForecast) {
    return {
      date: forecast.forecast_date,
      sunrise: forecast.sunrise,
      sunset: forecast.sunset,
      hourlyData: forecast.multi_height_data.map((data) => ({
        timestamp: data.timestamp,
        wind_10m: {
          speed: parseFloat(data.wind_speed_10m.toString()),
          direction: parseFloat(data.wind_direction_10m.toString()),
        },
        wind_80m: {
          speed: parseFloat(data.wind_speed_80m.toString()),
          direction: parseFloat(data.wind_direction_80m.toString()),
        },
        wind_120m: {
          speed: parseFloat(data.wind_speed_120m.toString()),
          direction: parseFloat(data.wind_direction_120m.toString()),
        },
      })),
    };
  }
}
