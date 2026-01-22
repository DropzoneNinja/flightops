import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeatherApiLog } from '../../database/entities/weather-api-log.entity';

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
    @InjectRepository(WeatherApiLog)
    private readonly apiLogRepository: Repository<WeatherApiLog>,
  ) {}

  /**
   * Log an API call
   */
  async logApiCall(endpoint: string, userId?: string): Promise<void> {
    try {
      const log = this.apiLogRepository.create({
        endpoint,
        user_id: userId || null,
      });
      await this.apiLogRepository.save(log);
    } catch (error) {
      this.logger.error(`Failed to log API call: ${error.message}`);
    }
  }

  /**
   * Get API call statistics
   */
  async getStats(): Promise<WeatherApiStats> {
    // Get all logs
    const logs = await this.apiLogRepository.find({
      order: { created_at: 'DESC' },
    });

    // Calculate endpoint counts
    const endpointMap = new Map<string, number>();
    logs.forEach((log) => {
      const count = endpointMap.get(log.endpoint) || 0;
      endpointMap.set(log.endpoint, count + 1);
    });

    const endpointCounts: EndpointStats[] = Array.from(endpointMap.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate max per day
    const callsByDay = new Map<string, number>();
    logs.forEach((log) => {
      const day = log.created_at.toISOString().split('T')[0];
      const count = callsByDay.get(day) || 0;
      callsByDay.set(day, count + 1);
    });

    // Find the day with maximum calls
    let maxDayEntry: [string, number] = ['', 0];
    if (callsByDay.size > 0) {
      maxDayEntry = Array.from(callsByDay.entries()).reduce((max, entry) =>
        entry[1] > max[1] ? entry : max
      );
    }

    // Calculate max per hour
    const callsByHour = new Map<string, number>();
    logs.forEach((log) => {
      const hour = log.created_at.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      const count = callsByHour.get(hour) || 0;
      callsByHour.set(hour, count + 1);
    });

    // Find the hour with maximum calls
    let maxHourEntry: [string, number] = ['', 0];
    if (callsByHour.size > 0) {
      maxHourEntry = Array.from(callsByHour.entries()).reduce((max, entry) =>
        entry[1] > max[1] ? entry : max
      );
    }

    return {
      endpointCounts,
      maxPerDay: {
        date: maxDayEntry[0],
        count: maxDayEntry[1],
      },
      maxPerHour: {
        hour: maxHourEntry[0],
        count: maxHourEntry[1],
      },
      totalCalls: logs.length,
    };
  }

  /**
   * Reset all statistics
   */
  async resetStats(): Promise<void> {
    await this.apiLogRepository.clear();
    this.logger.log('Weather API statistics reset');
  }
}
