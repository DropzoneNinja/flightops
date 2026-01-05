import { Injectable, Logger } from '@nestjs/common';
import * as SunCalc from 'suncalc';

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

@Injectable()
export class SunCalculationService {
  private readonly logger = new Logger(SunCalculationService.name);

  /**
   * Calculate sunrise and sunset times for a given date and location
   * @param date The date to calculate sun times for
   * @param latitude Site latitude
   * @param longitude Site longitude
   * @returns Sunrise and sunset times
   */
  getSunTimes(date: Date, latitude: number, longitude: number): SunTimes {
    try {
      const times = SunCalc.getTimes(date, latitude, longitude);

      return {
        sunrise: times.sunrise,
        sunset: times.sunset,
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate sun times for (${latitude}, ${longitude}) on ${date}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Format time as HH:MM string
   * @param date The date to format
   * @returns Time string in HH:MM format
   */
  formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Check if a given timestamp falls within daylight hours
   * @param timestamp The timestamp to check
   * @param sunrise Sunrise time
   * @param sunset Sunset time
   * @returns True if timestamp is during daylight hours
   */
  isDaylight(timestamp: Date, sunrise: Date, sunset: Date): boolean {
    return timestamp >= sunrise && timestamp <= sunset;
  }

  /**
   * Filter hourly data to only include daylight hours
   * @param timestamps Array of hourly timestamps
   * @param sunrise Sunrise time
   * @param sunset Sunset time
   * @returns Array of indices for daylight hours
   */
  getDaylightHourIndices(
    timestamps: string[],
    sunrise: Date,
    sunset: Date,
  ): number[] {
    return timestamps
      .map((timestamp, index) => ({
        index,
        date: new Date(timestamp),
      }))
      .filter(({ date }) => this.isDaylight(date, sunrise, sunset))
      .map(({ index }) => index);
  }
}
