/**
 * Default Settings Seed Data
 *
 * This file contains the authoritative PPG (Paramotor) flight thresholds
 * and default configuration values. These are the single source of truth
 * for what constitutes safe flying conditions.
 *
 * DO NOT modify these values without proper understanding of PPG safety requirements.
 */

export interface ThresholdRange {
  min: number;
  max: number;
}

export interface WindSpeedThresholds {
  tooCalm: ThresholdRange;
  optimal: ThresholdRange;
  marginal: ThresholdRange;
  highRisk: ThresholdRange;
  unsafe: number; // threshold where it becomes unsafe
}

export interface GustSpeedThresholds {
  smooth: number;
  moderate: ThresholdRange;
  strong: ThresholdRange;
  dangerous: number;
}

export interface GustSpreadThresholds {
  stable: number;
  unstable: ThresholdRange;
  turbulent: number;
}

export interface RainThresholds {
  dry: number;
  drizzle: ThresholdRange;
  unsafe: number;
}

export interface DefaultSettings {
  key: string;
  value: string;
  type: 'string' | 'number' | 'json' | 'boolean';
  description: string;
}

// PPG Weather Thresholds
export const WIND_SPEED_THRESHOLDS: WindSpeedThresholds = {
  tooCalm: { min: 0, max: 3 },      // 0-3 km/h: Too calm (Amber)
  optimal: { min: 4, max: 12 },     // 4-12 km/h: Optimal (Green)
  marginal: { min: 13, max: 18 },   // 13-18 km/h: Marginal (Yellow)
  highRisk: { min: 19, max: 24 },   // 19-24 km/h: High risk (Orange)
  unsafe: 25,                        // ≥25 km/h: Unsafe (Red)
};

export const GUST_SPEED_THRESHOLDS: GustSpeedThresholds = {
  smooth: 15,                        // ≤15 km/h: Smooth (Green)
  moderate: { min: 16, max: 22 },   // 16-22 km/h: Moderate turbulence (Yellow)
  strong: { min: 23, max: 28 },     // 23-28 km/h: Strong turbulence (Orange)
  dangerous: 29,                     // ≥29 km/h: Dangerous (Red)
};

export const GUST_SPREAD_THRESHOLDS: GustSpreadThresholds = {
  stable: 5,                         // ≤5 km/h: Stable (Green)
  unstable: { min: 6, max: 10 },    // 6-10 km/h: Unstable (Yellow)
  turbulent: 11,                     // ≥11 km/h: Turbulent (Red)
};

export const RAIN_THRESHOLDS: RainThresholds = {
  dry: 0,                            // 0 mm/hr: Dry (Green)
  drizzle: { min: 0.1, max: 0.5 },  // 0.1-0.5 mm/hr: Light drizzle (Yellow)
  unsafe: 0.5,                       // >0.5 mm/hr: Rain - unsafe (Red)
};

// Default application settings
export const DEFAULT_SETTINGS: DefaultSettings[] = [
  // Weather refresh frequency
  {
    key: 'weather.refresh_frequency',
    value: '6',
    type: 'number',
    description: 'Weather data refresh interval in hours',
  },

  // Unit preferences
  {
    key: 'units.speed',
    value: 'kmh',
    type: 'string',
    description: 'Speed unit: kmh, ms (m/s), or mph',
  },
  {
    key: 'units.temperature',
    value: 'celsius',
    type: 'string',
    description: 'Temperature unit: celsius or fahrenheit',
  },
  {
    key: 'units.distance',
    value: 'km',
    type: 'string',
    description: 'Distance unit: km or miles',
  },

  // PPG Thresholds (stored as JSON)
  {
    key: 'thresholds.wind_speed',
    value: JSON.stringify(WIND_SPEED_THRESHOLDS),
    type: 'json',
    description: 'Wind speed thresholds for PPG flight safety',
  },
  {
    key: 'thresholds.gust_speed',
    value: JSON.stringify(GUST_SPEED_THRESHOLDS),
    type: 'json',
    description: 'Gust speed thresholds for PPG flight safety',
  },
  {
    key: 'thresholds.gust_spread',
    value: JSON.stringify(GUST_SPREAD_THRESHOLDS),
    type: 'json',
    description: 'Gust spread thresholds for turbulence assessment',
  },
  {
    key: 'thresholds.rain',
    value: JSON.stringify(RAIN_THRESHOLDS),
    type: 'json',
    description: 'Rain thresholds for flight safety',
  },
];

/**
 * Get default settings for seeding the database
 * These will be inserted as global settings (user_id = null)
 */
export function getDefaultSettings() {
  return DEFAULT_SETTINGS.map((setting) => ({
    user_id: null,
    setting_key: setting.key,
    setting_value: setting.value,
    setting_type: setting.type,
  }));
}
