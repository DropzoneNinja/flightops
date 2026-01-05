import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { WeatherService } from './weather.service';
import { WeatherFetchJob } from './jobs/weather-fetch.job';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';

@Controller()
export class WeatherController {
  constructor(
    private readonly weatherService: WeatherService,
    private readonly weatherFetchJob: WeatherFetchJob,
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
}
