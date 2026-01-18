import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDefaultSettings1767783646822 implements MigrationInterface {
  name = 'SeedDefaultSettings1767783646822';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Default settings to seed
    const defaultSettings = [
      // Wind Speed Thresholds
      {
        key: 'thresholds.wind.too_calm',
        value: '3',
        type: 'number',
      },
      {
        key: 'thresholds.wind.optimal_min',
        value: '4',
        type: 'number',
      },
      {
        key: 'thresholds.wind.optimal_max',
        value: '12',
        type: 'number',
      },
      {
        key: 'thresholds.wind.marginal_max',
        value: '18',
        type: 'number',
      },
      {
        key: 'thresholds.wind.high_risk_max',
        value: '24',
        type: 'number',
      },

      // Gust Speed Thresholds
      {
        key: 'thresholds.gust.smooth_max',
        value: '15',
        type: 'number',
      },
      {
        key: 'thresholds.gust.moderate_max',
        value: '22',
        type: 'number',
      },
      {
        key: 'thresholds.gust.strong_max',
        value: '28',
        type: 'number',
      },

      // Gust Spread Thresholds
      {
        key: 'thresholds.gust_spread.excellent_max',
        value: '3',
        type: 'number',
      },
      {
        key: 'thresholds.gust_spread.good_max',
        value: '7',
        type: 'number',
      },
      {
        key: 'thresholds.gust_spread.marginal_max',
        value: '11',
        type: 'number',
      },

      // Rain Thresholds
      {
        key: 'thresholds.rain.dry',
        value: '0',
        type: 'number',
      },
      {
        key: 'thresholds.rain.drizzle_max',
        value: '0.5',
        type: 'number',
      },

      // Weather Update Settings
      {
        key: 'weather.refresh_frequency',
        value: '1',
        type: 'number',
      },
      {
        key: 'weather.forecast_days',
        value: '3',
        type: 'number',
      },

      // Unit Preferences
      {
        key: 'units.temperature',
        value: 'celsius',
        type: 'string',
      },
      {
        key: 'units.wind_speed',
        value: 'kmh',
        type: 'string',
      },
      {
        key: 'units.distance',
        value: 'km',
        type: 'string',
      },

      // Map Display Settings
      {
        key: 'map.show_zoom_indicator',
        value: 'true',
        type: 'boolean',
      },
      {
        key: 'map.parking_icon_zoom_level',
        value: '10',
        type: 'number',
      },

      // Debug Settings
      {
        key: 'debug.heatbar_debug_mode',
        value: 'false',
        type: 'boolean',
      },
    ];

    // Insert default settings only if they don't exist
    for (const setting of defaultSettings) {
      await queryRunner.query(
        `
        INSERT INTO settings (setting_key, setting_value, setting_type)
        VALUES ($1, $2, $3)
        ON CONFLICT (setting_key) DO NOTHING
      `,
        [setting.key, setting.value, setting.type],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete all default settings
    const settingKeys = [
      'thresholds.wind.too_calm',
      'thresholds.wind.optimal_min',
      'thresholds.wind.optimal_max',
      'thresholds.wind.marginal_max',
      'thresholds.wind.high_risk_max',
      'thresholds.gust.smooth_max',
      'thresholds.gust.moderate_max',
      'thresholds.gust.strong_max',
      'thresholds.gust_spread.excellent_max',
      'thresholds.gust_spread.good_max',
      'thresholds.gust_spread.marginal_max',
      'thresholds.rain.dry',
      'thresholds.rain.drizzle_max',
      'weather.refresh_frequency',
      'weather.forecast_days',
      'units.temperature',
      'units.wind_speed',
      'units.distance',
      'map.show_zoom_indicator',
      'map.parking_icon_zoom_level',
      'debug.heatbar_debug_mode',
    ];

    await queryRunner.query(
      `DELETE FROM settings WHERE setting_key = ANY($1)`,
      [settingKeys],
    );
  }
}
