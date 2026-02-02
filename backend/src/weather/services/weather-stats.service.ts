import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, DataSource } from 'typeorm';
import { WeatherApiStatsDaily } from '../../database/entities/weather-api-stats-daily.entity';
import { WeatherApiStatsHourly } from '../../database/entities/weather-api-stats-hourly.entity';
import { WeatherApiStatsEndpoints } from '../../database/entities/weather-api-stats-endpoints.entity';

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
  totalCalls: number;
}

@Injectable()
export class WeatherStatsService {
  private readonly logger = new Logger(WeatherStatsService.name);

  constructor(
    @InjectRepository(WeatherApiStatsDaily)
    private readonly dailyStatsRepo: Repository<WeatherApiStatsDaily>,
    @InjectRepository(WeatherApiStatsHourly)
    private readonly hourlyStatsRepo: Repository<WeatherApiStatsHourly>,
    @InjectRepository(WeatherApiStatsEndpoints)
    private readonly endpointStatsRepo: Repository<WeatherApiStatsEndpoints>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Update statistics for an API call (replaces logApiCall)
   */
  async updateStats(endpoint: string, userId?: string): Promise<void> {
    const now = new Date();

    // Format date as YYYY-MM-DD
    const dateOnly = now.toISOString().split('T')[0];

    // Truncate to hour (set minutes, seconds, ms to 0)
    const hourTimestamp = new Date(now);
    hourTimestamp.setMinutes(0, 0, 0);

    try {
      await this.dataSource.transaction(async (manager) => {
        await this.updateDailyStats(manager, dateOnly);
        await this.updateHourlyStats(manager, hourTimestamp);
        await this.updateEndpointStats(manager, endpoint);
      });
    } catch (error) {
      this.logger.error(`Failed to update stats: ${error.message}`, error.stack);
      // Don't throw - stats are non-critical and shouldn't block API requests
    }
  }

  /**
   * Get API call statistics
   */
  async getStats(): Promise<WeatherApiStats> {
    try {
      // Get max day
      const maxDay = await this.dailyStatsRepo.findOne({
        where: { is_max: true },
        order: { total_calls: 'DESC' },
      });

      // Get max hour
      const maxHour = await this.hourlyStatsRepo.findOne({
        where: { is_max: true },
        order: { total_calls: 'DESC' },
      });

      // Get endpoint counts (sorted by count desc)
      const endpoints = await this.endpointStatsRepo.find({
        order: { total_calls: 'DESC' },
      });

      // Calculate total calls
      const totalResult = await this.endpointStatsRepo
        .createQueryBuilder('endpoints')
        .select('SUM(endpoints.total_calls)', 'total')
        .getRawOne();

      return {
        endpointCounts: endpoints.map((e) => ({
          endpoint: e.endpoint,
          count: e.total_calls,
        })),
        maxPerDay: {
          date: maxDay?.date || '',
          count: maxDay?.total_calls || 0,
        },
        maxPerHour: {
          hour: maxHour?.hour_timestamp?.toISOString() || '',
          count: maxHour?.total_calls || 0,
        },
        totalCalls: parseInt(totalResult?.total || '0', 10),
      };
    } catch (error) {
      this.logger.error(`Failed to get stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Reset all statistics
   */
  async resetStats(): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.clear(WeatherApiStatsDaily);
        await manager.clear(WeatherApiStatsHourly);
        await manager.clear(WeatherApiStatsEndpoints);
      });
      this.logger.log('Weather API statistics reset');
    } catch (error) {
      this.logger.error(`Failed to reset stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update daily statistics
   */
  private async updateDailyStats(manager: EntityManager, date: string): Promise<void> {
    // Upsert the daily record
    await manager.query(
      `
      INSERT INTO "weather_api_stats_daily" ("date", "total_calls", "updated_at")
      VALUES ($1, 1, NOW())
      ON CONFLICT ("date")
      DO UPDATE SET
        "total_calls" = "weather_api_stats_daily"."total_calls" + 1,
        "updated_at" = NOW()
      RETURNING "total_calls"
      `,
      [date],
    );

    // Find current max
    const currentMax = await manager.query(
      `SELECT "date", "total_calls" FROM "weather_api_stats_daily" WHERE "is_max" = true`,
    );

    // Get the record we just updated
    const updatedRecord = await manager.query(
      `SELECT "total_calls" FROM "weather_api_stats_daily" WHERE "date" = $1`,
      [date],
    );

    const newCount = updatedRecord[0]?.total_calls || 0;
    const maxCount = currentMax[0]?.total_calls || 0;

    // If new count exceeds current max, update flags
    if (newCount > maxCount) {
      await manager.query(
        `UPDATE "weather_api_stats_daily" SET "is_max" = false WHERE "is_max" = true`,
      );
      await manager.query(
        `UPDATE "weather_api_stats_daily" SET "is_max" = true WHERE "date" = $1`,
        [date],
      );
    }
  }

  /**
   * Update hourly statistics
   */
  private async updateHourlyStats(manager: EntityManager, hourTimestamp: Date): Promise<void> {
    // Upsert the hourly record
    await manager.query(
      `
      INSERT INTO "weather_api_stats_hourly" ("hour_timestamp", "total_calls", "updated_at")
      VALUES ($1, 1, NOW())
      ON CONFLICT ("hour_timestamp")
      DO UPDATE SET
        "total_calls" = "weather_api_stats_hourly"."total_calls" + 1,
        "updated_at" = NOW()
      RETURNING "total_calls"
      `,
      [hourTimestamp],
    );

    // Find current max
    const currentMax = await manager.query(
      `SELECT "hour_timestamp", "total_calls" FROM "weather_api_stats_hourly" WHERE "is_max" = true`,
    );

    // Get the record we just updated
    const updatedRecord = await manager.query(
      `SELECT "total_calls" FROM "weather_api_stats_hourly" WHERE "hour_timestamp" = $1`,
      [hourTimestamp],
    );

    const newCount = updatedRecord[0]?.total_calls || 0;
    const maxCount = currentMax[0]?.total_calls || 0;

    // If new count exceeds current max, update flags
    if (newCount > maxCount) {
      await manager.query(
        `UPDATE "weather_api_stats_hourly" SET "is_max" = false WHERE "is_max" = true`,
      );
      await manager.query(
        `UPDATE "weather_api_stats_hourly" SET "is_max" = true WHERE "hour_timestamp" = $1`,
        [hourTimestamp],
      );
    }
  }

  /**
   * Update endpoint statistics
   */
  private async updateEndpointStats(manager: EntityManager, endpoint: string): Promise<void> {
    // Simple upsert - no max tracking
    await manager.query(
      `
      INSERT INTO "weather_api_stats_endpoints" ("endpoint", "total_calls", "updated_at")
      VALUES ($1, 1, NOW())
      ON CONFLICT ("endpoint")
      DO UPDATE SET
        "total_calls" = "weather_api_stats_endpoints"."total_calls" + 1,
        "updated_at" = NOW()
      `,
      [endpoint],
    );
  }
}
