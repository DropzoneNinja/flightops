import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingDto, UpdateSettingsDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DEFAULT_SETTINGS } from './constants/default-settings';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

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
  update(
    @Param('key') key: string,
    @Body() updateSettingDto: UpdateSettingDto,
  ) {
    return this.settingsService.update(key, updateSettingDto);
  }

  /**
   * PUT /settings
   * Update multiple settings at once (admin only)
   */
  @Put()
  @UseGuards(AdminGuard)
  updateMany(
    @Body() updateSettingsDto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateMany(updateSettingsDto.settings);
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
