import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { WeatherService } from './weather.service';
import { WeatherFetchJob } from './jobs/weather-fetch.job';
import { WeatherStatsService } from './services/weather-stats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';

@Controller()
export class WeatherController {
  constructor(
    private readonly weatherService: WeatherService,
    private readonly weatherFetchJob: WeatherFetchJob,
    private readonly weatherStatsService: WeatherStatsService,
  ) {}

  /**
   * POST /weather/fetch
   * Manually trigger weather fetch for all enabled sites (admin only)
   */
  @Post('weather/fetch')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async triggerWeatherFetch() {
    await this.weatherFetchJob.triggerManualFetch(3);
    return { message: 'Weather fetch initiated successfully' };
  }

  /**
   * GET /sites/:siteId/forecast
   * Get all forecasts for a specific site (next 3 days)
   */
  @Get('sites/:siteId/forecast')
  @UseGuards(JwtAuthGuard)
  async getForecast(
    @CurrentUser() user: User,
    @Param('siteId') siteId: string,
  ) {
    const forecast = await this.weatherService.getForecastBySite(
      siteId,
      user.id,
    );

    if (!forecast || forecast.length === 0) {
      throw new NotFoundException(
        'No forecast data available for this site. Weather data may not have been fetched yet.',
      );
    }

    return forecast;
  }

  /**
   * GET /sites/:siteId/forecast/:date/multi-height
   * Get multi-height wind data for a specific date (debug mode)
   * IMPORTANT: This route must come BEFORE the generic /:date route
   */
  @Get('sites/:siteId/forecast/:date/multi-height')
  @UseGuards(JwtAuthGuard)
  async getMultiHeightData(
    @CurrentUser() user: User,
    @Param('siteId') siteId: string,
    @Param('date') date: string,
  ) {
    const data = await this.weatherService.getMultiHeightData(
      siteId,
      user.id,
      date,
    );

    if (!data) {
      throw new NotFoundException(
        `No multi-height data available for ${date}.`,
      );
    }

    return data;
  }

  /**
   * GET /sites/:siteId/forecast/:date
   * Get forecast for a specific date (YYYY-MM-DD format)
   */
  @Get('sites/:siteId/forecast/:date')
  @UseGuards(JwtAuthGuard)
  async getForecastByDate(
    @CurrentUser() user: User,
    @Param('siteId') siteId: string,
    @Param('date') date: string,
  ) {
    const forecast = await this.weatherService.getForecastByDate(
      siteId,
      user.id,
      date,
    );

    if (!forecast) {
      throw new NotFoundException(
        `No forecast data available for ${date}. Weather data may not have been fetched yet.`,
      );
    }

    return forecast;
  }

  /**
   * GET /weather/stats
   * Get API call statistics (admin only)
   */
  @Get('weather/stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getStats() {
    return await this.weatherStatsService.getStats();
  }

  /**
   * DELETE /weather/stats
   * Reset API call statistics (admin only)
   */
  @Delete('weather/stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async resetStats() {
    await this.weatherStatsService.resetStats();
    return { message: 'Statistics reset successfully' };
  }
}
