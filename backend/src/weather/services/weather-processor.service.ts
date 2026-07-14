import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeatherForecast } from '../../database/entities/weather-forecast.entity';
import { WeatherHourly } from '../../database/entities/weather-hourly.entity';
import { FlightSite } from '../../database/entities/flight-site.entity';
import { OpenMeteoService } from './open-meteo.service';
import { SunCalculationService } from './sun-calculation.service';
import { WeatherScoringService } from './weather-scoring.service';

@Injectable()
export class WeatherProcessorService {
  private readonly logger = new Logger(WeatherProcessorService.name);

  constructor(
    @InjectRepository(WeatherForecast)
    private readonly forecastRepository: Repository<WeatherForecast>,
    @InjectRepository(WeatherHourly)
    private readonly hourlyRepository: Repository<WeatherHourly>,
    @InjectRepository(FlightSite)
    private readonly siteRepository: Repository<FlightSite>,
    private readonly openMeteoService: OpenMeteoService,
    private readonly sunCalcService: SunCalculationService,
    private readonly scoringService: WeatherScoringService,
  ) {}

  /**
   * Process weather data for a single flight site
   * Orchestrates: fetch → calculate → score → persist
   * @param siteId Flight site ID
   * @param forecastDays Number of days to forecast (default: 3)
   */
  async processSiteWeather(
    siteId: string,
    forecastDays = 3,
  ): Promise<void> {
    try {
      // Fetch site with user relationship
      const site = await this.siteRepository.findOne({
        where: { id: siteId },
        relations: ['user'],
      });

      if (!site) {
        throw new Error(`Site ${siteId} not found`);
      }

      if (!site.enabled || !site.include_in_weather) {
        this.logger.log(`Skipping site excluded from weather scanning: ${site.name} (${siteId})`);
        return;
      }

      this.logger.log(`Processing weather for site: ${site.name} (${siteId})`);

      // Use takeoff coordinates for weather data
      const lat = parseFloat(site.takeoff_lat.toString());
      const lon = parseFloat(site.takeoff_lon.toString());

      // Fetch weather data from Open-Meteo
      const weatherData = await this.openMeteoService.fetchForecastWithRetry(
        lat,
        lon,
        forecastDays,
      );

      // Group hourly data by date
      const dailyData = this.groupHourlyDataByDate(weatherData.hourly.time);

      // Process each day
      for (const [dateStr, hourIndices] of Object.entries(dailyData)) {
        await this.processDayForecast(
          site,
          dateStr,
          hourIndices,
          weatherData.hourly,
        );
      }

      this.logger.log(
        `Successfully processed weather for site: ${site.name} (${siteId})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process weather for site ${siteId}: ${error.message}`,
      );
      // Don't throw - allow job to continue processing other sites
    }
  }

  /**
   * Process weather forecast for a single day
   */
  private async processDayForecast(
    site: FlightSite,
    dateStr: string,
    hourIndices: number[],
    hourlyData: any,
  ): Promise<void> {
    const forecastDate = new Date(dateStr);
    const lat = parseFloat(site.takeoff_lat.toString());
    const lon = parseFloat(site.takeoff_lon.toString());

    // Calculate sunrise/sunset
    const sunTimes = this.sunCalcService.getSunTimes(forecastDate, lat, lon);
    const sunrise = this.sunCalcService.formatTime(sunTimes.sunrise);
    const sunset = this.sunCalcService.formatTime(sunTimes.sunset);

    // Filter to daylight hours only
    // Include an hour if any part of it overlaps with daylight period
    const daylightIndices = hourIndices.filter((index) => {
      const timestamp = new Date(hourlyData.time[index]);

      // An hour overlaps with daylight if:
      // - The hour ends after sunrise (timestamp + 1 hour > sunrise), AND
      // - The hour starts before sunset (timestamp < sunset)
      const hourEnd = new Date(timestamp.getTime() + 60 * 60 * 1000); // Add 1 hour
      const overlapsWithDaylight =
        hourEnd > sunTimes.sunrise && timestamp < sunTimes.sunset;

      // Debug logging
      if (index === hourIndices[0]) {
        this.logger.debug(
          `First hour check - Time: ${hourlyData.time[index]}, ` +
          `Parsed: ${timestamp.toISOString()}, ` +
          `Hour end: ${hourEnd.toISOString()}, ` +
          `Sunrise: ${sunTimes.sunrise.toISOString()}, ` +
          `Sunset: ${sunTimes.sunset.toISOString()}, ` +
          `Overlaps: ${overlapsWithDaylight}`,
        );
      }

      return overlapsWithDaylight;
    });

    if (daylightIndices.length === 0) {
      this.logger.warn(
        `No daylight hours for ${site.name} on ${dateStr} (sunrise: ${sunrise}, sunset: ${sunset})`,
      );
      this.logger.warn(
        `Total hours for day: ${hourIndices.length}, Sample: ${hourIndices.slice(0, 3).map(i => hourlyData.time[i]).join(', ')}`,
      );
      return;
    }

    // Upsert forecast record
    let forecast = await this.forecastRepository.findOne({
      where: { site_id: site.id, forecast_date: forecastDate },
    });

    if (forecast) {
      // Update existing forecast
      forecast.sunrise = sunrise;
      forecast.sunset = sunset;
      forecast = await this.forecastRepository.save(forecast);
    } else {
      // Create new forecast
      forecast = this.forecastRepository.create({
        site_id: site.id,
        forecast_date: forecastDate,
        sunrise,
        sunset,
      });
      forecast = await this.forecastRepository.save(forecast);
    }

    // Delete existing hourly data for this forecast
    await this.hourlyRepository.delete({ forecast_id: forecast.id });

    // Process hourly data for daylight hours
    const hourlyRecords = await Promise.all(
      daylightIndices.map(async (index) => {
        const timestamp = new Date(hourlyData.time[index]);
        const temperature = hourlyData.temperature_2m[index];
        const windSpeed = hourlyData.wind_speed_10m[index];
        const windDirection = hourlyData.wind_direction_10m[index];
        const gustSpeed = hourlyData.wind_gusts_10m[index];
        const rain = hourlyData.precipitation[index];
        const cloudCover = hourlyData.cloud_cover?.[index] ?? null;
        const cloudCoverLow = hourlyData.cloud_cover_low?.[index] ?? null;

        // Calculate gust spread
        const gustSpread = gustSpeed - windSpeed;

        // Estimate cloud base from low-level cloud cover
        // High low-level cloud cover indicates low cloud base
        let cloudBase: number | null = null;
        if (cloudCoverLow !== null && cloudCoverLow > 10) {
          // Estimate cloud base in feet based on low-level cloud percentage
          // Higher percentage = lower base
          // cloud_cover_low represents 0-3km (0-9843ft)
          // Rough estimate: 80%+ → ~300ft, 50% → ~1500ft, 20% → ~3000ft
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

        // Calculate PPG safety scores
        const scores = await this.scoringService.calculateScores(
          windSpeed,
          gustSpeed,
          rain,
          cloudBase,
          cloudCover,
        );

        return this.hourlyRepository.create({
          forecast_id: forecast.id,
          timestamp,
          temperature,
          wind_speed: windSpeed,
          wind_direction: windDirection,
          gust_speed: gustSpeed,
          gust_spread: gustSpread,
          rain,
          cloud_cover: cloudCover,
          cloud_base: cloudBase,
          wind_score: scores.wind_score,
          gust_score: scores.gust_score,
          gust_spread_score: scores.gust_spread_score,
          rain_score: scores.rain_score,
          cloud_score: scores.cloud_score,
          overall_score: scores.overall_score,
        });
      }),
    );

    // Bulk insert hourly records
    await this.hourlyRepository.save(hourlyRecords);

    this.logger.log(
      `Saved ${hourlyRecords.length} hourly records for ${site.name} on ${dateStr}`,
    );
  }

  /**
   * Group hourly timestamps by date (YYYY-MM-DD)
   * @param timestamps Array of ISO 8601 timestamps
   * @returns Map of date strings to hour indices
   */
  private groupHourlyDataByDate(
    timestamps: string[],
  ): Record<string, number[]> {
    return timestamps.reduce((acc, timestamp, index) => {
      const date = timestamp.split('T')[0]; // Extract YYYY-MM-DD
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(index);
      return acc;
    }, {} as Record<string, number[]>);
  }

  /**
   * Process weather for all enabled sites
   * @param forecastDays Number of days to forecast
   */
  async processAllEnabledSites(forecastDays = 3): Promise<void> {
    this.logger.log('Starting weather processing for all enabled sites');

    const enabledSites = await this.siteRepository.find({
      where: { enabled: true, include_in_weather: true },
    });

    this.logger.log(`Found ${enabledSites.length} enabled sites to process`);

    for (const site of enabledSites) {
      await this.processSiteWeather(site.id, forecastDays);
    }

    this.logger.log('Completed weather processing for all enabled sites');
  }
}
