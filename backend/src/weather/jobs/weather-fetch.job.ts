import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WeatherProcessorService } from '../services/weather-processor.service';
import { SettingsService } from '../../settings/settings.service';
import { SettingKey } from '../../settings/constants/default-settings';

@Injectable()
export class WeatherFetchJob {
  private readonly logger = new Logger(WeatherFetchJob.name);
  private isRunning = false;

  constructor(
    private readonly weatherProcessor: WeatherProcessorService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Scheduled job to fetch weather data for all enabled sites
   * Runs every hour by default
   * Uses WEATHER_FORECAST_DAYS setting to determine how many days to fetch
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

      const forecastDays = await this.settingsService.getValue(
        SettingKey.WEATHER_FORECAST_DAYS,
      ) as number;

      await this.weatherProcessor.processAllEnabledSites(forecastDays);

      this.logger.log('Successfully completed scheduled weather fetch job');
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
