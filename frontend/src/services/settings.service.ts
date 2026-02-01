import { api } from './api';

export enum SettingKey {
  // Wind Speed Thresholds
  WIND_TOO_CALM = 'thresholds.wind.too_calm',
  WIND_OPTIMAL_MIN = 'thresholds.wind.optimal_min',
  WIND_OPTIMAL_MAX = 'thresholds.wind.optimal_max',
  WIND_MARGINAL_MAX = 'thresholds.wind.marginal_max',
  WIND_HIGH_RISK_MAX = 'thresholds.wind.high_risk_max',

  // Gust Speed Thresholds
  GUST_SMOOTH_MAX = 'thresholds.gust.smooth_max',
  GUST_MODERATE_MAX = 'thresholds.gust.moderate_max',
  GUST_STRONG_MAX = 'thresholds.gust.strong_max',

  // Rain Thresholds
  RAIN_DRY = 'thresholds.rain.dry',
  RAIN_DRIZZLE_MAX = 'thresholds.rain.drizzle_max',

  // Weather Update Settings
  WEATHER_REFRESH_FREQUENCY = 'weather.refresh_frequency',
  WEATHER_FORECAST_DAYS = 'weather.forecast_days',

  // Unit Preferences
  UNITS_TEMPERATURE = 'units.temperature',
  UNITS_WIND_SPEED = 'units.wind_speed',
  UNITS_DISTANCE = 'units.distance',

  // Map Display Settings
  SHOW_ZOOM_INDICATOR = 'map.show_zoom_indicator',
  PARKING_ICON_ZOOM_LEVEL = 'map.parking_icon_zoom_level',

  // Debug Settings
  HEATBAR_DEBUG_MODE = 'debug.heatbar_debug_mode',

  // Backup Settings
  BACKUP_ENABLED = 'backup.enabled',
  BACKUP_FREQUENCY = 'backup.frequency',
  BACKUP_TIME = 'backup.time',
  BACKUP_DAY_OF_WEEK = 'backup.day_of_week',
  BACKUP_DAY_OF_MONTH = 'backup.day_of_month',
}

export enum SettingType {
  NUMBER = 'number',
  STRING = 'string',
  BOOLEAN = 'boolean',
}

export interface Setting {
  id: string;
  user_id: string;
  setting_key: string;
  setting_value: string;
  setting_type: SettingType;
  created_at: string;
  updated_at: string;
}

export interface DefaultSetting {
  key: SettingKey;
  value: string | number | boolean;
  type: SettingType;
  description: string;
  category: string;
}

export interface UpdateSettingData {
  setting_key: string;
  setting_value: string | number | boolean;
  setting_type: SettingType;
}

export interface SettingsMap {
  [key: string]: any;
}

export const settingsService = {
  /**
   * Get all settings for the current user
   */
  async getAll(): Promise<Setting[]> {
    const response = await api.get<Setting[]>('/settings');
    return response.data;
  },

  /**
   * Get all settings as a key-value map
   */
  async getMap(): Promise<SettingsMap> {
    const response = await api.get<SettingsMap>('/settings/map');
    return response.data;
  },

  /**
   * Get default settings
   */
  async getDefaults(): Promise<DefaultSetting[]> {
    const response = await api.get<DefaultSetting[]>('/settings/defaults');
    return response.data;
  },

  /**
   * Get a single setting by key
   */
  async getByKey(key: string): Promise<Setting> {
    const response = await api.get<Setting>(`/settings/${key}`);
    return response.data;
  },

  /**
   * Update a single setting
   */
  async update(key: string, data: UpdateSettingData): Promise<Setting> {
    const response = await api.put<Setting>(`/settings/${key}`, data);
    return response.data;
  },

  /**
   * Update multiple settings at once
   */
  async updateMany(settings: UpdateSettingData[]): Promise<Setting[]> {
    const response = await api.put<Setting[]>('/settings', { settings });
    return response.data;
  },

  /**
   * Reset all settings to defaults
   */
  async resetToDefaults(): Promise<Setting[]> {
    const response = await api.post<Setting[]>('/settings/reset');
    return response.data;
  },
};
