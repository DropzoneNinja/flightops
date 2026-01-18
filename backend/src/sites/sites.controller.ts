import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto, UpdateSiteDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';

@Controller('sites')
@UseGuards(JwtAuthGuard) // All routes require authentication
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  /**
   * POST /sites
   * Create a new flight site
   */
  @Post()
  create(@CurrentUser() user: User, @Body() createSiteDto: CreateSiteDto) {
    return this.sitesService.create(user.id, createSiteDto);
  }

  /**
   * GET /sites
   * Get all flight sites for the current user
   */
  @Get()
  findAll(@CurrentUser() user: User) {
    return this.sitesService.findAllByUser(user.id);
  }

  /**
   * GET /sites/geocode/reverse
   * Reverse geocode coordinates to get nearest address
   */
  @Get('geocode/reverse')
  async reverseGeocode(
    @CurrentUser() user: User,
    @Query('lat') lat: string,
    @Query('lon') lon: string,
  ) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      throw new BadRequestException('Invalid latitude or longitude');
    }

    if (latitude < -90 || latitude > 90) {
      throw new BadRequestException('Latitude must be between -90 and 90');
    }

    if (longitude < -180 || longitude > 180) {
      throw new BadRequestException('Longitude must be between -180 and 180');
    }

    return this.sitesService.reverseGeocode(user.id, latitude, longitude);
  }

  /**
   * GET /sites/:id
   * Get a specific flight site
   */
  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.sitesService.findOne(id, user.id);
  }

  /**
   * PUT /sites/:id
   * Update a flight site (admin only)
   */
  @Put(':id')
  @UseGuards(AdminGuard)
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateSiteDto: UpdateSiteDto,
  ) {
    return this.sitesService.update(id, user.id, updateSiteDto, user.is_admin);
  }

  /**
   * DELETE /sites/:id
   * Delete a flight site (admin only)
   */
  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.sitesService.remove(id, user.id, user.is_admin);
    return { message: 'Site deleted successfully' };
  }

  /**
   * PATCH /sites/:id/toggle
   * Toggle site enabled status (admin only)
   */
  @Patch(':id/toggle')
  @UseGuards(AdminGuard)
  toggleEnabled(@CurrentUser() user: User, @Param('id') id: string) {
    return this.sitesService.toggleEnabled(id, user.id, user.is_admin);
  }
}
