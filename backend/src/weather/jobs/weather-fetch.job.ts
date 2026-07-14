import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeatherProcessorService } from '../services/weather-processor.service';
import { SettingsService } from '../../settings/settings.service';
import { SettingKey } from '../../settings/constants/default-settings';
import { FlightSite } from '../../database/entities/flight-site.entity';
import { WeatherService } from '../weather.service';
import { WeatherEventsService } from '../weather-events.service';

@Injectable()
export class WeatherFetchJob {
  private readonly logger = new Logger(WeatherFetchJob.name);
  private isRunning = false;

  constructor(
    private readonly weatherProcessor: WeatherProcessorService,
    private readonly settingsService: SettingsService,
    @Inject(forwardRef(() => WeatherService))
    private readonly weatherService: WeatherService,
    private readonly weatherEventsService: WeatherEventsService,
    @InjectRepository(FlightSite)
    private readonly siteRepository: Repository<FlightSite>,
  ) {}

  /**
   * Scheduled job to fetch weather data for all enabled sites
   * Runs every hour by default
   * Uses WEATHER_FORECAST_DAYS setting to determine how many days to fetch
   * Checks cache freshness using WEATHER_REFRESH_FREQUENCY setting
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleWeatherFetch(): Promise<void> {
    // Prevent overlapping executions
    if (this.isRunning) {
      this.logger.warn('Weather fetch job already running, skipping this execution');
      return;
    }

    try {
      this.isRunning = true;
      this.logger.log('Starting scheduled weather fetch job');

      const refreshFrequencyHours = await this.settingsService.getValue(
        SettingKey.WEATHER_REFRESH_FREQUENCY,
      ) as number;

      this.logger.log(`Weather refresh frequency: ${refreshFrequencyHours} hour(s)`);

      // Get all enabled sites that are included in weather scanning
      const enabledSites = await this.siteRepository.find({
        where: { enabled: true, include_in_weather: true },
      });

      this.logger.log(`Found ${enabledSites.length} enabled sites to check`);

      const forecastDays = await this.settingsService.getValue(
        SettingKey.WEATHER_FORECAST_DAYS,
      ) as number;

      // Check each site and only fetch if stale
      let refreshedCount = 0;
      let skippedCount = 0;

      for (const site of enabledSites) {
        const needsRefresh = await this.weatherService.needsRefresh(site.id);

        if (needsRefresh) {
          this.logger.log(`Refreshing weather for site: ${site.name} (${site.id})`);
          await this.weatherProcessor.processSiteWeather(site.id, forecastDays);
          this.weatherEventsService.emitWeatherUpdate(site.id);
          refreshedCount++;
        } else {
          this.logger.log(`Skipping site ${site.name} - data still fresh`);
          skippedCount++;
        }
      }

      this.logger.log(
        `Successfully completed scheduled weather fetch job. ` +
        `Refreshed: ${refreshedCount}, Skipped: ${skippedCount}`,
      );
    } catch (error) {
      this.logger.error(`Weather fetch job failed: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual trigger for weather fetch (can be called via API)
   * @param forecastDays Number of days to forecast (default: 3)
   */
  async triggerManualFetch(forecastDays = 3): Promise<void> {
    this.logger.log(`Triggering manual weather fetch (${forecastDays} days)`);

    try {
      await this.weatherProcessor.processAllEnabledSites(forecastDays);
      this.logger.log('Manual weather fetch completed successfully');
    } catch (error) {
      this.logger.error(`Manual weather fetch failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
