import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingDto, UpdateSettingsDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DEFAULT_SETTINGS } from './constants/default-settings';
import { BackupJob } from '../backup/jobs/backup.job';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    @Inject(forwardRef(() => BackupJob))
    private readonly backupJob: BackupJob,
  ) {}

  /**
   * GET /settings
   * Get all global settings (all authenticated users can read)
   */
  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  /**
   * GET /settings/map
   * Get all settings as a key-value map (all authenticated users can read)
   */
  @Get('map')
  getSettingsMap() {
    return this.settingsService.getSettingsMap();
  }

  /**
   * GET /settings/defaults
   * Get default settings (all authenticated users)
   */
  @Get('defaults')
  getDefaults() {
    return DEFAULT_SETTINGS;
  }

  /**
   * GET /settings/:key
   * Get a specific setting by key (all authenticated users can read)
   */
  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  /**
   * PUT /settings/:key
   * Update a specific setting (admin only)
   */
  @Put(':key')
  @UseGuards(AdminGuard)
  async update(
    @Param('key') key: string,
    @Body() updateSettingDto: UpdateSettingDto,
  ) {
    const result = await this.settingsService.update(key, updateSettingDto);

    // If backup setting was updated, refresh backup schedule
    if (key.startsWith('backup.')) {
      await this.backupJob.updateSchedule();
    }

    return result;
  }

  /**
   * PUT /settings
   * Update multiple settings at once (admin only)
   */
  @Put()
  @UseGuards(AdminGuard)
  async updateMany(
    @Body() updateSettingsDto: UpdateSettingsDto,
  ) {
    const result = await this.settingsService.updateMany(updateSettingsDto.settings);

    // If any backup setting was updated, refresh backup schedule
    const hasBackupSettings = updateSettingsDto.settings.some(s =>
      s.setting_key.startsWith('backup.')
    );
    if (hasBackupSettings) {
      await this.backupJob.updateSchedule();
    }

    return result;
  }

  /**
   * POST /settings/reset
   * Reset all settings to defaults (admin only)
   */
  @Post('reset')
  @UseGuards(AdminGuard)
  resetToDefaults() {
    return this.settingsService.resetToDefaults();
  }
}
