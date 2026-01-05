import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { SettingKey } from '../../settings/constants/default-settings';

export interface WeatherScores {
  wind_score: number;
  gust_score: number;
  rain_score: number;
  overall_score: number;
}

@Injectable()
export class WeatherScoringService {
  private readonly logger = new Logger(WeatherScoringService.name);

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Calculate PPG safety scores for weather conditions
   * @param windSpeed Wind speed in km/h
   * @param gustSpeed Gust speed in km/h
   * @param rain Precipitation in mm/hr
   * @param userId User ID for personalized thresholds
   * @returns Weather safety scores (0-100)
   */
  async calculateScores(
    windSpeed: number,
    gustSpeed: number,
    rain: number,
    userId: string,
  ): Promise<WeatherScores> {
    // Get user's thresholds (or defaults)
    const thresholds = await this.settingsService.getSettingsMap(userId);

    const wind_score = this.calculateWindScore(
      windSpeed,
      Number(thresholds[SettingKey.WIND_TOO_CALM]),
      Number(thresholds[SettingKey.WIND_OPTIMAL_MIN]),
      Number(thresholds[SettingKey.WIND_OPTIMAL_MAX]),
      Number(thresholds[SettingKey.WIND_MARGINAL_MAX]),
      Number(thresholds[SettingKey.WIND_HIGH_RISK_MAX]),
    );

    const gust_score = this.calculateGustScore(
      gustSpeed,
      Number(thresholds[SettingKey.GUST_SMOOTH_MAX]),
      Number(thresholds[SettingKey.GUST_MODERATE_MAX]),
      Number(thresholds[SettingKey.GUST_STRONG_MAX]),
    );

    const rain_score = this.calculateRainScore(
      rain,
      Number(thresholds[SettingKey.RAIN_DRY]),
      Number(thresholds[SettingKey.RAIN_DRIZZLE_MAX]),
    );

    // Overall score is the minimum (most conservative)
    const overall_score = Math.min(wind_score, gust_score, rain_score);

    return {
      wind_score,
      gust_score,
      rain_score,
      overall_score,
    };
  }

  /**
   * Calculate wind speed score based on PPG thresholds
   *
   * Wind Speed Scoring:
   * - 0-3 km/h: Too calm (50) - amber (thermal activity concern)
   * - 4-12 km/h: Optimal (100) - green (ideal flying conditions)
   * - 13-18 km/h: Marginal (70) - yellow (experienced pilots only)
   * - 19-24 km/h: High risk (40) - orange (dangerous conditions)
   * - 25+ km/h: Unsafe (0) - red (do not fly)
   */
  private calculateWindScore(
    windSpeed: number,
    tooCalmMax: number,
    optimalMin: number,
    optimalMax: number,
    marginalMax: number,
    highRiskMax: number,
  ): number {
    if (windSpeed <= tooCalmMax) {
      return 50; // Too calm (amber)
    }
    if (windSpeed >= optimalMin && windSpeed <= optimalMax) {
      return 100; // Optimal (green)
    }
    if (windSpeed <= marginalMax) {
      return 70; // Marginal (yellow)
    }
    if (windSpeed <= highRiskMax) {
      return 40; // High risk (orange)
    }
    return 0; // Unsafe (red)
  }

  /**
   * Calculate gust speed score based on PPG thresholds
   *
   * Gust Speed Scoring:
   * - ≤15 km/h: Smooth (100) - green
   * - 16-22 km/h: Moderate (70) - yellow
   * - 23-28 km/h: Strong (40) - orange
   * - 29+ km/h: Dangerous (0) - red
   */
  private calculateGustScore(
    gustSpeed: number,
    smoothMax: number,
    moderateMax: number,
    strongMax: number,
  ): number {
    if (gustSpeed <= smoothMax) {
      return 100; // Smooth (green)
    }
    if (gustSpeed <= moderateMax) {
      return 70; // Moderate (yellow)
    }
    if (gustSpeed <= strongMax) {
      return 40; // Strong (orange)
    }
    return 0; // Dangerous (red)
  }

  /**
   * Calculate rain score based on PPG thresholds
   *
   * Rain Scoring:
   * - 0 mm/hr: Dry (100) - green
   * - 0.1-0.5 mm/hr: Drizzle (70) - yellow
   * - >0.5 mm/hr: Unsafe (0) - red
   */
  private calculateRainScore(
    rain: number,
    dryThreshold: number,
    drizzleMax: number,
  ): number {
    if (rain <= dryThreshold) {
      return 100; // Dry (green)
    }
    if (rain <= drizzleMax) {
      return 70; // Drizzle (yellow)
    }
    return 0; // Unsafe (red)
  }

  /**
   * Map score to color category
   * @param score Score value (0-100)
   * @returns Color category
   */
  scoreToColor(score: number): string {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    if (score >= 30) return 'orange';
    return 'red';
  }
}
