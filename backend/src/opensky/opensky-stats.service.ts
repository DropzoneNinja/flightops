import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { OpenSkyApiStatsDaily } from '../database/entities/opensky-api-stats-daily.entity';
import { OpenSkyApiStatsHourly } from '../database/entities/opensky-api-stats-hourly.entity';

export interface OpenSkyStats {
  totalCalls: number;
  totalRejected: number;
  maxPerDay: { date: string; count: number; rejected: number };
  maxPerHour: { hour: string; count: number; rejected: number };
}

@Injectable()
export class OpenSkyStatsService {
  private readonly logger = new Logger(OpenSkyStatsService.name);

  constructor(
    @InjectRepository(OpenSkyApiStatsDaily)
    private readonly dailyRepo: Repository<OpenSkyApiStatsDaily>,
    @InjectRepository(OpenSkyApiStatsHourly)
    private readonly hourlyRepo: Repository<OpenSkyApiStatsHourly>,
    private readonly dataSource: DataSource,
  ) {}

  async recordCall(rejected: boolean): Promise<void> {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const hour = new Date(now);
    hour.setMinutes(0, 0, 0);

    try {
      await this.dataSource.transaction(async (manager) => {
        await this.upsertDaily(manager, date, rejected);
        await this.upsertHourly(manager, hour, rejected);
      });
    } catch (error) {
      this.logger.error(`Failed to record OpenSky stat: ${error.message}`);
    }
  }

  async getStats(): Promise<OpenSkyStats> {
    const maxDay = await this.dailyRepo.findOne({
      where: { is_max: true },
      order: { total_calls: 'DESC' },
    });

    const maxHour = await this.hourlyRepo.findOne({
      where: { is_max: true },
      order: { total_calls: 'DESC' },
    });

    const totals = await this.dailyRepo
      .createQueryBuilder('d')
      .select('SUM(d.total_calls)', 'calls')
      .addSelect('SUM(d.rejected_calls)', 'rejected')
      .getRawOne();

    return {
      totalCalls: parseInt(totals?.calls || '0', 10),
      totalRejected: parseInt(totals?.rejected || '0', 10),
      maxPerDay: {
        date: maxDay?.date || '',
        count: maxDay?.total_calls || 0,
        rejected: maxDay?.rejected_calls || 0,
      },
      maxPerHour: {
        hour: maxHour?.hour_timestamp?.toISOString() || '',
        count: maxHour?.total_calls || 0,
        rejected: maxHour?.rejected_calls || 0,
      },
    };
  }

  async resetStats(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.clear(OpenSkyApiStatsDaily);
      await manager.clear(OpenSkyApiStatsHourly);
    });
    this.logger.log('OpenSky API statistics reset');
  }

  private async upsertDaily(manager: EntityManager, date: string, rejected: boolean): Promise<void> {
    await manager.query(
      `INSERT INTO opensky_api_stats_daily (date, total_calls, rejected_calls, updated_at)
       VALUES ($1, 1, $2, NOW())
       ON CONFLICT (date) DO UPDATE SET
         total_calls    = opensky_api_stats_daily.total_calls + 1,
         rejected_calls = opensky_api_stats_daily.rejected_calls + $2,
         updated_at     = NOW()`,
      [date, rejected ? 1 : 0],
    );

    const [current] = await manager.query(
      `SELECT total_calls FROM opensky_api_stats_daily WHERE date = $1`,
      [date],
    );
    const [currentMax] = await manager.query(
      `SELECT total_calls FROM opensky_api_stats_daily WHERE is_max = true`,
    );

    if ((current?.total_calls || 0) > (currentMax?.total_calls || 0)) {
      await manager.query(`UPDATE opensky_api_stats_daily SET is_max = false WHERE is_max = true`);
      await manager.query(`UPDATE opensky_api_stats_daily SET is_max = true WHERE date = $1`, [date]);
    }
  }

  private async upsertHourly(manager: EntityManager, hour: Date, rejected: boolean): Promise<void> {
    await manager.query(
      `INSERT INTO opensky_api_stats_hourly (hour_timestamp, total_calls, rejected_calls, updated_at)
       VALUES ($1, 1, $2, NOW())
       ON CONFLICT (hour_timestamp) DO UPDATE SET
         total_calls    = opensky_api_stats_hourly.total_calls + 1,
         rejected_calls = opensky_api_stats_hourly.rejected_calls + $2,
         updated_at     = NOW()`,
      [hour, rejected ? 1 : 0],
    );

    const [current] = await manager.query(
      `SELECT total_calls FROM opensky_api_stats_hourly WHERE hour_timestamp = $1`,
      [hour],
    );
    const [currentMax] = await manager.query(
      `SELECT total_calls FROM opensky_api_stats_hourly WHERE is_max = true`,
    );

    if ((current?.total_calls || 0) > (currentMax?.total_calls || 0)) {
      await manager.query(`UPDATE opensky_api_stats_hourly SET is_max = false WHERE is_max = true`);
      await manager.query(`UPDATE opensky_api_stats_hourly SET is_max = true WHERE hour_timestamp = $1`, [hour]);
    }
  }
}
