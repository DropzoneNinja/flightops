import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { SettingKey } from '../../settings/constants/default-settings';

export interface WeatherScores {
  wind_score: number;
  gust_score: number;
  gust_spread_score: number;
  rain_score: number;
  cloud_score: number;
  overall_score: number;
}

@Injectable()
export class WeatherScoringService {
  private readonly logger = new Logger(WeatherScoringService.name);

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Helper function for linear interpolation between two points
   * @param x Current value
   * @param x1 Lower bound x value
   * @param x2 Upper bound x value
   * @param y1 Lower bound y value
   * @param y2 Upper bound y value
   * @returns Interpolated y value
   */
  private linearInterpolate(
    x: number,
    x1: number,
    x2: number,
    y1: number,
    y2: number,
  ): number {
    if (x2 === x1) return y1;
    return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
  }

  /**
   * Calculate PPG safety scores for weather conditions
   * @param windSpeed Wind speed in km/h
   * @param gustSpeed Gust speed in km/h
   * @param rain Precipitation in mm/hr
   * @param cloudBase Cloud base in feet (optional)
   * @param cloudCover Cloud cover percentage (optional)
   * @returns Weather safety scores (0-100)
   */
  async calculateScores(
    windSpeed: number,
    gustSpeed: number,
    rain: number,
    cloudBase: number | null = null,
    cloudCover: number | null = null,
  ): Promise<WeatherScores> {
    // Get global thresholds (or defaults)
    const thresholds = await this.settingsService.getSettingsMap();

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

    // Calculate gust spread score
    const gustSpread = gustSpeed - windSpeed;
    const gust_spread_score = this.calculateGustSpreadScore(
      gustSpread,
      Number(thresholds[SettingKey.GUST_SPREAD_EXCELLENT_MAX]),
      Number(thresholds[SettingKey.GUST_SPREAD_GOOD_MAX]),
      Number(thresholds[SettingKey.GUST_SPREAD_MARGINAL_MAX]),
    );

    // Calculate cloud score
    const cloud_score = this.calculateCloudScore(
      cloudBase,
      cloudCover,
      Number(thresholds[SettingKey.CLOUD_BASE_MIN_SAFE]),
      Number(thresholds[SettingKey.CLOUD_COVER_MAX_SAFE]),
    );

    // Hard safety check: If cloud ceiling is too low with high cloud cover, overall score must be 0
    const minSafeCloudBase = Number(thresholds[SettingKey.CLOUD_BASE_MIN_SAFE]);
    const maxSafeCloudCover = Number(thresholds[SettingKey.CLOUD_COVER_MAX_SAFE]);
    const hasUnsafeCloudConditions =
      cloudBase !== null &&
      cloudCover !== null &&
      cloudBase < minSafeCloudBase &&
      cloudCover > maxSafeCloudCover;

    // If unsafe cloud conditions detected, return 0 overall score
    if (hasUnsafeCloudConditions) {
      return {
        wind_score: Math.round(wind_score),
        gust_score: Math.round(gust_score),
        gust_spread_score: Math.round(gust_spread_score),
        rain_score: Math.round(rain_score),
        cloud_score: 0,
        overall_score: 0,
      };
    }

    // Weighted sum formula: wind (35%) + gust (25%) + spread (20%) + rain (10%) + cloud (10%)
    const overall_score = Math.round(
      Math.max(
        0,
        Math.min(
          100,
          wind_score * 0.35 +
            gust_score * 0.25 +
            gust_spread_score * 0.2 +
            rain_score * 0.1 +
            cloud_score * 0.1,
        ),
      ),
    );

    return {
      wind_score: Math.round(wind_score),
      gust_score: Math.round(gust_score),
      gust_spread_score: Math.round(gust_spread_score),
      rain_score: Math.round(rain_score),
      cloud_score: Math.round(cloud_score),
      overall_score,
    };
  }

  /**
   * Calculate wind speed score using piecewise linear interpolation
   *
   * Wind Speed Scoring (Piecewise Linear):
   * - 0-3 km/h: Too calm (20-50) - linear interpolation
   * - 3-4 km/h: Transition (50-100) - linear interpolation
   * - 4-12 km/h: Optimal (100) - ideal flying conditions
   * - 13-18 km/h: Marginal (70-30) - linear interpolation
   * - 19-24 km/h: High risk (30-0) - linear interpolation
   * - 25+ km/h: Unsafe (0) - do not fly
   */
  private calculateWindScore(
    windSpeed: number,
    tooCalmMax: number,
    optimalMin: number,
    optimalMax: number,
    marginalMax: number,
    highRiskMax: number,
  ): number {
    // Hard safety rule: wind >= 25 km/h
    if (windSpeed >= 25) return 0;

    // High risk zone: 19-24 km/h (linear 30 → 0)
    if (windSpeed >= 19) {
      return this.linearInterpolate(windSpeed, 19, 24.99, 30, 0);
    }

    // Marginal zone: 13-18 km/h (linear 70 → 30)
    if (windSpeed >= 13) {
      return this.linearInterpolate(windSpeed, 13, 18.99, 70, 30);
    }

    // Optimal zone: 4-12 km/h
    if (windSpeed >= optimalMin && windSpeed <= optimalMax) {
      return 100;
    }

    // Transition from too calm to optimal: 3-4 km/h (linear 50 → 100)
    if (windSpeed > tooCalmMax) {
      return this.linearInterpolate(windSpeed, 3.01, optimalMin, 50, 100);
    }

    // Too calm zone: 0-3 km/h (linear 20 → 50)
    return this.linearInterpolate(windSpeed, 0, tooCalmMax, 20, 50);
  }

  /**
   * Calculate gust speed score using piecewise linear interpolation
   *
   * Gust Speed Scoring (Piecewise Linear):
   * - 0-15 km/h: Smooth (100) - ideal conditions
   * - 15-16 km/h: Smooth to moderate (100-70) - linear interpolation
   * - 16-22 km/h: Moderate (70-40) - linear interpolation
   * - 23-28 km/h: Strong (40-0) - linear interpolation
   * - 29+ km/h: Dangerous (0) - do not fly
   */
  private calculateGustScore(
    gustSpeed: number,
    smoothMax: number,
    moderateMax: number,
    strongMax: number,
  ): number {
    // Hard safety rule: gust >= 29 km/h
    if (gustSpeed >= 29) return 0;

    // Strong zone: 23-28 km/h (linear 40 → 0)
    if (gustSpeed >= 23) {
      return this.linearInterpolate(gustSpeed, 23, 28.99, 40, 0);
    }

    // Moderate zone: 16-22 km/h (linear 70 → 40)
    if (gustSpeed >= 16) {
      return this.linearInterpolate(gustSpeed, 16, 22.99, 70, 40);
    }

    // Smooth to moderate transition: 15-16 km/h (linear 100 → 70)
    if (gustSpeed > smoothMax) {
      return this.linearInterpolate(gustSpeed, 15.01, 16, 100, 70);
    }

    // Smooth zone: 0-15 km/h
    return 100;
  }

  /**
   * Calculate gust spread score using piecewise linear interpolation
   *
   * Gust Spread Scoring (Piecewise Linear - Conservative):
   * - 0-3 km/h: Excellent (100-60) - minimal turbulence
   * - 3-7 km/h: Good (60-20) - moderate turbulence
   * - 7-11 km/h: Marginal (20-0) - significant turbulence
   * - 11+ km/h: Unsafe (0) - dangerous turbulence
   */
  private calculateGustSpreadScore(
    gustSpread: number,
    excellentMax: number,
    goodMax: number,
    marginalMax: number,
  ): number {
    // Hard safety rule: gust spread >= 11 km/h
    if (gustSpread >= marginalMax) return 0;

    // Marginal zone: 7-11 km/h (linear 20 → 0)
    if (gustSpread > goodMax) {
      return this.linearInterpolate(gustSpread, 7.01, marginalMax - 0.01, 20, 0);
    }

    // Good zone: 3-7 km/h (linear 60 → 20)
    if (gustSpread > excellentMax) {
      return this.linearInterpolate(gustSpread, 3.01, goodMax, 60, 20);
    }

    // Excellent zone: 0-3 km/h (linear 100 → 60)
    return this.linearInterpolate(gustSpread, 0, excellentMax, 100, 60);
  }

  /**
   * Calculate rain score using piecewise linear interpolation
   *
   * Rain Scoring (Piecewise Linear):
   * - 0 mm/hr: Dry (100) - perfect conditions
   * - 0-0.5 mm/hr: Light rain (100-0) - linear interpolation
   * - >0.5 mm/hr: Unsafe (0) - do not fly
   */
  private calculateRainScore(
    rain: number,
    dryThreshold: number,
    drizzleMax: number,
  ): number {
    // Hard safety rule: rain > 0.5 mm/hr
    if (rain > drizzleMax) return 0;

    // Drizzle zone: 0-0.5 mm/hr (linear 100 → 0)
    if (rain > dryThreshold) {
      return this.linearInterpolate(rain, 0.01, drizzleMax, 100, 0);
    }

    // Dry: 0 mm/hr
    return 100;
  }

  /**
   * Calculate cloud score based on cloud base and cloud cover
   *
   * Cloud Scoring:
   * - Hard safety rule: cloud_base < 1000ft AND cloud_cover > 80% → No flying (0)
   * - cloud_base < 1000ft → Low ceiling warning (20-50)
   * - cloud_base 1000-2000ft → Marginal ceiling (50-80)
   * - cloud_base > 2000ft → Good ceiling (80-100)
   * - If no cloud data available → Neutral score (100)
   */
  private calculateCloudScore(
    cloudBase: number | null,
    cloudCover: number | null,
    minSafeCloudBase: number,
    maxSafeCloudCover: number,
  ): number {
    // If no cloud data available, return neutral score
    if (cloudBase === null && cloudCover === null) {
      return 100;
    }

    // Hard safety rule: cloud base < 1000ft AND cloud cover > 80%
    if (cloudBase !== null && cloudCover !== null) {
      if (cloudBase < minSafeCloudBase && cloudCover > maxSafeCloudCover) {
        return 0; // No flying - low ceiling with high cloud cover
      }
    }

    // If only cloud cover is available
    if (cloudBase === null && cloudCover !== null) {
      // High cloud cover can reduce visibility and create flat light
      if (cloudCover > 90) return 50;
      if (cloudCover > 70) return 70;
      return 100;
    }

    // If only cloud base is available or both are available
    if (cloudBase !== null) {
      // Very low ceiling (< 500ft) - likely fog
      if (cloudBase < 500) {
        return 10; // Dangerous - likely fog
      }

      // Low ceiling (500-1000ft)
      if (cloudBase < minSafeCloudBase) {
        return this.linearInterpolate(cloudBase, 500, minSafeCloudBase, 10, 50);
      }

      // Marginal ceiling (1000-2000ft)
      if (cloudBase < 2000) {
        return this.linearInterpolate(cloudBase, minSafeCloudBase, 2000, 50, 80);
      }

      // Good ceiling (> 2000ft)
      return 100;
    }

    return 100;
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
