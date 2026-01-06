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
   * Get all settings for a user
   * If user has no settings, initialize with defaults
   */
  async findAllByUser(userId: string): Promise<Setting[]> {
    const settings = await this.settingRepository.find({
      where: { user_id: userId },
    });

    // If user has no settings, initialize with defaults
    if (settings.length === 0) {
      return this.initializeDefaultSettings(userId);
    }

    return settings;
  }

  /**
   * Get all settings as a key-value map
   * Merges user settings with defaults to ensure all settings have values
   */
  async getSettingsMap(userId: string): Promise<Record<string, any>> {
    // Start with default settings
    const defaultsMap = getDefaultSettingsMap();

    // Get user settings
    const settings = await this.findAllByUser(userId);

    // Merge user settings over defaults
    const userSettingsMap = settings.reduce(
      (acc, setting) => {
        acc[setting.setting_key] = this.parseSettingValue(
          setting.setting_value,
          setting.setting_type as SettingType,
        );
        return acc;
      },
      {} as Record<string, any>,
    );

    // Return merged map (user settings override defaults)
    return { ...defaultsMap, ...userSettingsMap };
  }

  /**
   * Get a single setting by key
   */
  async findOne(userId: string, settingKey: string): Promise<Setting> {
    const setting = await this.settingRepository.findOne({
      where: { user_id: userId, setting_key: settingKey },
    });

    if (!setting) {
      throw new NotFoundException(
        `Setting with key '${settingKey}' not found for user`,
      );
    }

    return setting;
  }

  /**
   * Get a setting value by key (with type parsing)
   */
  async getValue(userId: string, settingKey: SettingKey): Promise<any> {
    try {
      const setting = await this.findOne(userId, settingKey);
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
   * Update a single setting
   */
  async update(
    userId: string,
    settingKey: string,
    updateSettingDto: UpdateSettingDto,
  ): Promise<Setting> {
    const setting = await this.settingRepository.findOne({
      where: { user_id: userId, setting_key: settingKey },
    });

    if (!setting) {
      throw new NotFoundException(
        `Setting with key '${settingKey}' not found for user`,
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
   * Update multiple settings at once
   */
  async updateMany(
    userId: string,
    updateDtos: UpdateSettingDto[],
  ): Promise<Setting[]> {
    const updatedSettings: Setting[] = [];

    for (const dto of updateDtos) {
      const updated = await this.update(userId, dto.setting_key, dto);
      updatedSettings.push(updated);
    }

    return updatedSettings;
  }

  /**
   * Reset all settings to defaults for a user
   */
  async resetToDefaults(userId: string): Promise<Setting[]> {
    // Delete all existing settings for user
    await this.settingRepository.delete({ user_id: userId });

    // Reinitialize with defaults
    return this.initializeDefaultSettings(userId);
  }

  /**
   * Initialize default settings for a new user
   */
  private async initializeDefaultSettings(userId: string): Promise<Setting[]> {
    const defaultSettings = DEFAULT_SETTINGS.map((defaultSetting) => {
      return this.settingRepository.create({
        user_id: userId,
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
