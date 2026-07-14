import {
  Injectable,
  NotFoundException,
  Logger,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';
import { WeatherForecast } from '../database/entities/weather-forecast.entity';
import { WeatherHourly } from '../database/entities/weather-hourly.entity';
import { WeatherMultiHeight } from '../database/entities/weather-multi-height.entity';
import { FlightSite } from '../database/entities/flight-site.entity';
import { OpenMeteoService } from './services/open-meteo.service';
import { OpenMeteoMultiHeightResponse } from './interfaces/open-meteo-response.interface';
import { SettingsService } from '../settings/settings.service';
import { SettingKey } from '../settings/constants/default-settings';
import { WeatherProcessorService } from './services/weather-processor.service';
import { WeatherEventsService } from './weather-events.service';

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
    private readonly settingsService: SettingsService,
    @Inject(forwardRef(() => WeatherProcessorService))
    private readonly weatherProcessorService: WeatherProcessorService,
    private readonly weatherEventsService: WeatherEventsService,
  ) {}

  /**
   * Check if weather data for a site needs refreshing
   * Compares the last update timestamp with WEATHER_REFRESH_FREQUENCY setting
   * @param siteId Flight site ID
   * @returns true if data is stale or missing
   */
  async needsRefresh(siteId: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get forecast days from settings
    const forecastDays = await this.settingsService.getValue(
      SettingKey.WEATHER_FORECAST_DAYS,
    ) as number;

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + forecastDays);

    // Find the most recently updated forecast for this site
    const forecasts = await this.forecastRepository.find({
      where: {
        site: { id: siteId },
        forecast_date: Between(today, endDate),
      },
      order: { updated_at: 'DESC' },
      take: 1,
    });

    // If no forecasts exist, needs refresh
    if (forecasts.length === 0) {
      this.logger.log(`No forecast data exists for site ${siteId}`);
      return true;
    }

    const latestForecast = forecasts[0];
    const now = new Date();
    const lastUpdate = new Date(latestForecast.updated_at);
    const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / 1000 / 60;

    // Get refresh frequency from settings (in hours)
    const refreshFrequencyHours = await this.settingsService.getValue(
      SettingKey.WEATHER_REFRESH_FREQUENCY,
    ) as number;
    const refreshFrequencyMinutes = refreshFrequencyHours * 60;

    const isStale = minutesSinceUpdate >= refreshFrequencyMinutes;

    this.logger.log(
      `Site ${siteId}: Last update ${minutesSinceUpdate.toFixed(1)} minutes ago. ` +
      `Refresh threshold: ${refreshFrequencyMinutes} minutes. Stale: ${isStale}`,
    );

    return isStale;
  }

  /**
   * Get forecast data for a site (based on WEATHER_FORECAST_DAYS setting)
   * Returns forecast with hourly data included
   * Checks cache freshness and triggers async refresh if needed
   */
  async getForecastBySite(siteId: string, _userId: string) {
    // Verify the site exists (all authenticated users can view weather data)
    const site = await this.siteRepository.findOne({
      where: { id: siteId },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    // Check if we need to refresh data
    const needsRefresh = await this.needsRefresh(siteId);

    if (needsRefresh && site.include_in_weather) {
      this.logger.log(`Weather data stale for site ${siteId}, triggering refresh`);

      const forecastDays = await this.settingsService.getValue(
        SettingKey.WEATHER_FORECAST_DAYS,
      ) as number;

      // Trigger async refresh (don't wait - serve cached data immediately)
      // Note: do NOT emit SSE here - that would cause the client to re-fetch,
      // see stale data again (race), and create an infinite refresh loop.
      // SSE notifications are handled by the scheduled cron job instead.
      this.weatherProcessorService
        .processSiteWeather(siteId, forecastDays)
        .then(() => {
          this.logger.log(`Successfully refreshed weather for site ${siteId}`);
        })
        .catch((error) => {
          this.logger.error(
            `Failed to refresh weather for site ${siteId}: ${error.message}`,
          );
        });
    }

    // Get forecast days from settings
    const forecastDays = await this.settingsService.getValue(
      SettingKey.WEATHER_FORECAST_DAYS,
    ) as number;

    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get date N days from now based on setting
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + forecastDays);

    // Fetch forecasts for the configured number of days, including hourly data
    const forecasts = await this.forecastRepository.find({
      where: {
        site: { id: siteId },
        forecast_date: Between(today, endDate),
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
  async getForecastByDate(siteId: string, _userId: string, dateString: string) {
    // Verify the site exists (all authenticated users can view weather data)
    const site = await this.siteRepository.findOne({
      where: { id: siteId },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
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
        cloudCover: hourly.cloud_cover !== null ? parseFloat(hourly.cloud_cover.toString()) : null,
        cloudBase: hourly.cloud_base !== null ? parseFloat(hourly.cloud_base.toString()) : null,
        windScore: hourly.wind_score,
        gustScore: hourly.gust_score,
        gustSpreadScore: hourly.gust_spread_score,
        rainScore: hourly.rain_score,
        cloudScore: hourly.cloud_score,
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
    _userId: string,
    dateString: string,
  ) {
    // 1. Verify site exists (all authenticated users can view weather data)
    const site = await this.siteRepository.findOne({
      where: { id: siteId },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
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
      temperature_2m,
      temperature_80m,
      temperature_120m,
      precipitation,
      wind_gusts_10m,
      cloud_cover,
      cloud_cover_low,
    } = openMeteoData.hourly;

    return time.map((timestamp, index) => {
      const cloudCover = cloud_cover?.[index] ?? null;
      const cloudCoverLow = cloud_cover_low?.[index] ?? null;

      // Estimate cloud base from low-level cloud cover
      let cloudBase: number | null = null;
      if (cloudCoverLow !== null && cloudCoverLow > 10) {
        if (cloudCoverLow >= 80) {
          cloudBase = 300; // Very low ceiling, likely fog
        } else if (cloudCoverLow >= 60) {
          cloudBase = 800; // Low ceiling
        } else if (cloudCoverLow >= 40) {
          cloudBase = 1500; // Moderate low ceiling
        } else {
          cloudBase = 3000; // Higher cloud base in low layer
        }
      }

      return this.multiHeightRepository.create({
        forecast_id: forecastId,
        timestamp: new Date(timestamp),
        wind_speed_10m: wind_speed_10m[index],
        wind_direction_10m: wind_direction_10m[index],
        wind_speed_80m: wind_speed_80m[index],
        wind_direction_80m: wind_direction_80m[index],
        wind_speed_120m: wind_speed_120m[index],
        wind_direction_120m: wind_direction_120m[index],
        temperature_2m: temperature_2m?.[index] ?? null,
        temperature_80m: temperature_80m?.[index] ?? null,
        temperature_120m: temperature_120m?.[index] ?? null,
        precipitation: precipitation?.[index] ?? null,
        wind_gusts_10m: wind_gusts_10m?.[index] ?? null,
        cloud_cover: cloudCover,
        cloud_base: cloudBase,
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
      hourlyData: forecast.multi_height_data.map((data) => {
        const cloudBase = data.cloud_base
          ? parseFloat(data.cloud_base.toString())
          : null;
        const cloudCover = data.cloud_cover
          ? parseFloat(data.cloud_cover.toString())
          : null;

        // Determine fog conditions
        // Fog is indicated when cloud base < 500ft
        const hasFog = cloudBase !== null && cloudBase < 500;

        // Determine which height levels are affected by fog/low clouds
        const fogAtSurface = hasFog; // 10m/33ft
        const fogAt80m = cloudBase !== null && cloudBase < 262; // 80m = 262ft
        const fogAt120m = cloudBase !== null && cloudBase < 394; // 120m = 394ft

        return {
          timestamp: data.timestamp,
          cloud_base: cloudBase,
          cloud_cover: cloudCover,
          has_fog: hasFog,
          wind_10m: {
            speed: parseFloat(data.wind_speed_10m.toString()),
            direction: parseFloat(data.wind_direction_10m.toString()),
            temperature: data.temperature_2m
              ? parseFloat(data.temperature_2m.toString())
              : null,
            precipitation: data.precipitation
              ? parseFloat(data.precipitation.toString())
              : null,
            gusts: data.wind_gusts_10m
              ? parseFloat(data.wind_gusts_10m.toString())
              : null,
            fog: fogAtSurface,
          },
          wind_80m: {
            speed: parseFloat(data.wind_speed_80m.toString()),
            direction: parseFloat(data.wind_direction_80m.toString()),
            temperature: data.temperature_80m
              ? parseFloat(data.temperature_80m.toString())
              : null,
            fog: fogAt80m,
          },
          wind_120m: {
            speed: parseFloat(data.wind_speed_120m.toString()),
            direction: parseFloat(data.wind_direction_120m.toString()),
            temperature: data.temperature_120m
              ? parseFloat(data.temperature_120m.toString())
              : null,
            fog: fogAt120m,
          },
        };
      }),
    };
  }
}
