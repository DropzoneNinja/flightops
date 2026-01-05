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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { DEFAULT_SETTINGS } from './constants/default-settings';

@Controller('settings')
@UseGuards(JwtAuthGuard, AdminGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * GET /settings
   * Get all settings for the current user
   */
  @Get()
  findAll(@CurrentUser() user: User) {
    return this.settingsService.findAllByUser(user.id);
  }

  /**
   * GET /settings/map
   * Get all settings as a key-value map
   */
  @Get('map')
  getSettingsMap(@CurrentUser() user: User) {
    return this.settingsService.getSettingsMap(user.id);
  }

  /**
   * GET /settings/defaults
   * Get default settings (not user-specific)
   */
  @Get('defaults')
  getDefaults() {
    return DEFAULT_SETTINGS;
  }

  /**
   * GET /settings/:key
   * Get a specific setting by key
   */
  @Get(':key')
  findOne(@CurrentUser() user: User, @Param('key') key: string) {
    return this.settingsService.findOne(user.id, key);
  }

  /**
   * PUT /settings/:key
   * Update a specific setting
   */
  @Put(':key')
  update(
    @CurrentUser() user: User,
    @Param('key') key: string,
    @Body() updateSettingDto: UpdateSettingDto,
  ) {
    return this.settingsService.update(user.id, key, updateSettingDto);
  }

  /**
   * PUT /settings
   * Update multiple settings at once
   */
  @Put()
  updateMany(
    @CurrentUser() user: User,
    @Body() updateSettingsDto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateMany(user.id, updateSettingsDto.settings);
  }

  /**
   * POST /settings/reset
   * Reset all settings to defaults
   */
  @Post('reset')
  resetToDefaults(@CurrentUser() user: User) {
    return this.settingsService.resetToDefaults(user.id);
  }
}
