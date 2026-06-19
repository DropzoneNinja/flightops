import { Controller, Get, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { OpenSkyStatsService } from './opensky-stats.service';

@Controller('opensky')
export class OpenSkyController {
  constructor(private readonly openSkyStatsService: OpenSkyStatsService) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  getStats() {
    return this.openSkyStatsService.getStats();
  }

  @Delete('stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async resetStats() {
    await this.openSkyStatsService.resetStats();
    return { message: 'OpenSky API statistics reset' };
  }
}
