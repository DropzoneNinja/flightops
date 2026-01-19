/**
 * Default Settings - Single Source of Truth for PPG Thresholds
 *
 * This file defines the authoritative PPG (Paramotor) safety thresholds
 * used throughout the application for weather scoring.
 *
 * IMPORTANT: These values represent safe flying conditions for paramotors.
 * Any changes to these thresholds should be reviewed by experienced pilots.
 */

export enum SettingKey {
  // Wind Speed Thresholds (km/h)
  WIND_TOO_CALM = 'thresholds.wind.too_calm',
  WIND_OPTIMAL_MIN = 'thresholds.wind.optimal_min',
  WIND_OPTIMAL_MAX = 'thresholds.wind.optimal_max',
  WIND_MARGINAL_MAX = 'thresholds.wind.marginal_max',
  WIND_HIGH_RISK_MAX = 'thresholds.wind.high_risk_max',

  // Gust Speed Thresholds (km/h)
  GUST_SMOOTH_MAX = 'thresholds.gust.smooth_max',
  GUST_MODERATE_MAX = 'thresholds.gust.moderate_max',
  GUST_STRONG_MAX = 'thresholds.gust.strong_max',

  // Gust Spread Thresholds (km/h)
  GUST_SPREAD_EXCELLENT_MAX = 'thresholds.gust_spread.excellent_max',
  GUST_SPREAD_GOOD_MAX = 'thresholds.gust_spread.good_max',
  GUST_SPREAD_MARGINAL_MAX = 'thresholds.gust_spread.marginal_max',

  // Rain Thresholds (mm/hr)
  RAIN_DRY = 'thresholds.rain.dry',
  RAIN_DRIZZLE_MAX = 'thresholds.rain.drizzle_max',

  // Weather Update Settings
  WEATHER_REFRESH_FREQUENCY = 'weather.refresh_frequency',
  WEATHER_FORECAST_DAYS = 'weather.forecast_days',

  // Unit Preferences
  UNITS_TEMPERATURE = 'units.temperature',
  UNITS_WIND_SPEED = 'units.wind_speed',
  UNITS_DISTANCE = 'units.distance',

  // Plot Settings
  PLOT_AVERAGE_SPEED = 'plot.average_speed',

  // Map Display Settings
  SHOW_ZOOM_INDICATOR = 'map.show_zoom_indicator',
  PARKING_ICON_ZOOM_LEVEL = 'map.parking_icon_zoom_level',

  // Debug Settings
  HEATBAR_DEBUG_MODE = 'debug.heatbar_debug_mode',
}

export enum SettingType {
  NUMBER = 'number',
  STRING = 'string',
  BOOLEAN = 'boolean',
}

export interface DefaultSetting {
  key: SettingKey;
  value: string | number | boolean;
  type: SettingType;
  description: string;
  category: string;
}

/**
 * PPG Wind Speed Thresholds (km/h)
 * - 0-3: Too calm (amber) - thermal activity concern
 * - 4-12: Optimal (green) - ideal flying conditions
 * - 13-18: Marginal (yellow) - experienced pilots only
 * - 19-24: High risk (orange) - dangerous conditions
 * - 25+: Unsafe (red) - do not fly
 */
export const DEFAULT_SETTINGS: DefaultSetting[] = [
  // Wind Speed Thresholds
  {
    key: SettingKey.WIND_TOO_CALM,
    value: 3,
    type: SettingType.NUMBER,
    description: 'Wind speed below this is too calm (km/h)',
    category: 'Wind Thresholds',
  },
  {
    key: SettingKey.WIND_OPTIMAL_MIN,
    value: 4,
    type: SettingType.NUMBER,
    description: 'Minimum wind speed for optimal conditions (km/h)',
    category: 'Wind Thresholds',
  },
  {
    key: SettingKey.WIND_OPTIMAL_MAX,
    value: 12,
    type: SettingType.NUMBER,
    description: 'Maximum wind speed for optimal conditions (km/h)',
    category: 'Wind Thresholds',
  },
  {
    key: SettingKey.WIND_MARGINAL_MAX,
    value: 18,
    type: SettingType.NUMBER,
    description: 'Maximum wind speed for marginal conditions (km/h)',
    category: 'Wind Thresholds',
  },
  {
    key: SettingKey.WIND_HIGH_RISK_MAX,
    value: 24,
    type: SettingType.NUMBER,
    description: 'Maximum wind speed before unsafe conditions (km/h)',
    category: 'Wind Thresholds',
  },

  // Gust Speed Thresholds
  {
    key: SettingKey.GUST_SMOOTH_MAX,
    value: 15,
    type: SettingType.NUMBER,
    description: 'Maximum gust speed for smooth conditions (km/h)',
    category: 'Gust Thresholds',
  },
  {
    key: SettingKey.GUST_MODERATE_MAX,
    value: 22,
    type: SettingType.NUMBER,
    description: 'Maximum gust speed for moderate conditions (km/h)',
    category: 'Gust Thresholds',
  },
  {
    key: SettingKey.GUST_STRONG_MAX,
    value: 28,
    type: SettingType.NUMBER,
    description: 'Maximum gust speed before dangerous conditions (km/h)',
    category: 'Gust Thresholds',
  },

  // Gust Spread Thresholds
  {
    key: SettingKey.GUST_SPREAD_EXCELLENT_MAX,
    value: 3,
    type: SettingType.NUMBER,
    description: 'Maximum gust spread for excellent conditions (km/h)',
    category: 'Gust Spread Thresholds',
  },
  {
    key: SettingKey.GUST_SPREAD_GOOD_MAX,
    value: 7,
    type: SettingType.NUMBER,
    description: 'Maximum gust spread for good conditions (km/h)',
    category: 'Gust Spread Thresholds',
  },
  {
    key: SettingKey.GUST_SPREAD_MARGINAL_MAX,
    value: 11,
    type: SettingType.NUMBER,
    description: 'Maximum gust spread before unsafe conditions (km/h)',
    category: 'Gust Spread Thresholds',
  },

  // Rain Thresholds
  {
    key: SettingKey.RAIN_DRY,
    value: 0,
    type: SettingType.NUMBER,
    description: 'Rain amount considered dry (mm/hr)',
    category: 'Rain Thresholds',
  },
  {
    key: SettingKey.RAIN_DRIZZLE_MAX,
    value: 0.5,
    type: SettingType.NUMBER,
    description: 'Maximum rain for drizzle conditions (mm/hr)',
    category: 'Rain Thresholds',
  },

  // Weather Update Settings
  {
    key: SettingKey.WEATHER_REFRESH_FREQUENCY,
    value: 1,
    type: SettingType.NUMBER,
    description: 'Weather data refresh frequency (hours)',
    category: 'Weather Updates',
  },
  {
    key: SettingKey.WEATHER_FORECAST_DAYS,
    value: 3,
    type: SettingType.NUMBER,
    description: 'Number of forecast days to retrieve',
    category: 'Weather Updates',
  },

  // Unit Preferences
  {
    key: SettingKey.UNITS_TEMPERATURE,
    value: 'celsius',
    type: SettingType.STRING,
    description: 'Temperature unit (celsius or fahrenheit)',
    category: 'Units',
  },
  {
    key: SettingKey.UNITS_WIND_SPEED,
    value: 'kmh',
    type: SettingType.STRING,
    description: 'Wind speed unit (kmh, mph, or ms)',
    category: 'Units',
  },
  {
    key: SettingKey.UNITS_DISTANCE,
    value: 'km',
    type: SettingType.STRING,
    description: 'Distance unit (km or mi)',
    category: 'Units',
  },

  // Plot Settings
  {
    key: SettingKey.PLOT_AVERAGE_SPEED,
    value: 30,
    type: SettingType.NUMBER,
    description: 'Average speed for plot time calculations (km/h)',
    category: 'Plot',
  },

  // Map Display Settings
  {
    key: SettingKey.SHOW_ZOOM_INDICATOR,
    value: true,
    type: SettingType.BOOLEAN,
    description: 'Show zoom level indicator on map',
    category: 'Map Display',
  },
  {
    key: SettingKey.PARKING_ICON_ZOOM_LEVEL,
    value: 10,
    type: SettingType.NUMBER,
    description: 'Zoom level to show parking icons',
    category: 'Map Display',
  },

  // Debug Settings
  {
    key: SettingKey.HEATBAR_DEBUG_MODE,
    value: false,
    type: SettingType.BOOLEAN,
    description: 'Show multi-height wind data grid in detail view',
    category: 'Debug',
  },
];

/**
 * Get default value for a setting key
 */
export function getDefaultValue(key: SettingKey): string | number | boolean {
  const setting = DEFAULT_SETTINGS.find((s) => s.key === key);
  if (!setting) {
    throw new Error(`Default setting not found for key: ${key}`);
  }
  return setting.value;
}

/**
 * Get all default settings as a key-value map
 */
export function getDefaultSettingsMap(): Record<
  string,
  string | number | boolean
> {
  return DEFAULT_SETTINGS.reduce(
    (acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    },
    {} as Record<string, string | number | boolean>,
  );
}
