import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from '../database/entities/setting.entity';
import { UpdateSettingDto } from './dto';
import {
  DEFAULT_SETTINGS,
  SettingKey,
  SettingType,
  getDefaultValue,
  getDefaultSettingsMap,
} from './constants/default-settings';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  /**
   * Get all global settings
   * If no settings exist, initialize with defaults
   */
  async findAll(): Promise<Setting[]> {
    const settings = await this.settingRepository.find();

    // If no settings exist, initialize with defaults
    if (settings.length === 0) {
      return this.initializeDefaultSettings();
    }

    return settings;
  }

  /**
   * Get all settings as a key-value map
   * Merges global settings with defaults to ensure all settings have values
   */
  async getSettingsMap(): Promise<Record<string, any>> {
    console.log('🔍 [Settings] getSettingsMap called');

    // Start with default settings
    const defaultsMap = getDefaultSettingsMap();

    // Get global settings
    const settings = await this.findAll();
    console.log('📊 [Settings] Found', settings.length, 'global settings');

    // Merge global settings over defaults
    const settingsMap = settings.reduce(
      (acc, setting) => {
        const parsedValue = this.parseSettingValue(
          setting.setting_value,
          setting.setting_type as SettingType,
        );
        acc[setting.setting_key] = parsedValue;

        // Log critical settings
        if (setting.setting_key === 'map.show_zoom_indicator' ||
            setting.setting_key === 'debug.heatbar_debug_mode' ||
            setting.setting_key === 'map.parking_icon_zoom_level') {
          console.log(`  ⚙️  [Settings] ${setting.setting_key}:`,
            `"${setting.setting_value}" (${setting.setting_type}) ->`, parsedValue,
            `(${typeof parsedValue})`);
        }

        return acc;
      },
      {} as Record<string, any>,
    );

    // Return merged map (global settings override defaults)
    const finalMap = { ...defaultsMap, ...settingsMap };
    console.log('✅ [Settings] Returning map with', Object.keys(finalMap).length, 'settings');
    console.log('  - map.show_zoom_indicator:', finalMap['map.show_zoom_indicator'], typeof finalMap['map.show_zoom_indicator']);
    console.log('  - debug.heatbar_debug_mode:', finalMap['debug.heatbar_debug_mode'], typeof finalMap['debug.heatbar_debug_mode']);

    return finalMap;
  }

  /**
   * Get a single setting by key
   */
  async findOne(settingKey: string): Promise<Setting> {
    const setting = await this.settingRepository.findOne({
      where: { setting_key: settingKey },
    });

    if (!setting) {
      throw new NotFoundException(
        `Setting with key '${settingKey}' not found`,
      );
    }

    return setting;
  }

  /**
   * Get a setting value by key (with type parsing)
   */
  async getValue(settingKey: SettingKey): Promise<any> {
    try {
      const setting = await this.findOne(settingKey);
      return this.parseSettingValue(
        setting.setting_value,
        setting.setting_type as SettingType,
      );
    } catch (error) {
      // If setting doesn't exist, return default value
      return getDefaultValue(settingKey);
    }
  }

  /**
   * Update a single setting (admin only)
   */
  async update(
    settingKey: string,
    updateSettingDto: UpdateSettingDto,
  ): Promise<Setting> {
    const setting = await this.settingRepository.findOne({
      where: { setting_key: settingKey },
    });

    if (!setting) {
      throw new NotFoundException(
        `Setting with key '${settingKey}' not found`,
      );
    }

    // Validate and convert value to string for storage
    const stringValue = this.convertToString(
      updateSettingDto.setting_value,
      updateSettingDto.setting_type,
    );

    setting.setting_value = stringValue;
    setting.setting_type = updateSettingDto.setting_type;

    return this.settingRepository.save(setting);
  }

  /**
   * Update multiple settings at once (admin only)
   */
  async updateMany(
    updateDtos: UpdateSettingDto[],
  ): Promise<Setting[]> {
    const updatedSettings: Setting[] = [];

    for (const dto of updateDtos) {
      const updated = await this.update(dto.setting_key, dto);
      updatedSettings.push(updated);
    }

    return updatedSettings;
  }

  /**
   * Reset all settings to defaults (admin only)
   */
  async resetToDefaults(): Promise<Setting[]> {
    // Delete all existing settings
    await this.settingRepository.clear();

    // Reinitialize with defaults
    return this.initializeDefaultSettings();
  }

  /**
   * Initialize default global settings
   */
  private async initializeDefaultSettings(): Promise<Setting[]> {
    const defaultSettings = DEFAULT_SETTINGS.map((defaultSetting) => {
      return this.settingRepository.create({
        setting_key: defaultSetting.key,
        setting_value: String(defaultSetting.value),
        setting_type: defaultSetting.type,
      });
    });

    return this.settingRepository.save(defaultSettings);
  }

  /**
   * Parse setting value from string to appropriate type
   */
  private parseSettingValue(value: string, type: SettingType): any {
    switch (type) {
      case SettingType.NUMBER:
        return parseFloat(value);
      case SettingType.BOOLEAN:
        return value === 'true';
      case SettingType.STRING:
      default:
        return value;
    }
  }

  /**
   * Convert value to string for storage
   */
  private convertToString(value: any, type: SettingType): string {
    switch (type) {
      case SettingType.NUMBER:
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Invalid number value: ${value}`);
        }
        return String(num);
      case SettingType.BOOLEAN:
        return String(Boolean(value));
      case SettingType.STRING:
      default:
        return String(value);
    }
  }
}
