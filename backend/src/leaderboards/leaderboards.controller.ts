import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LeaderboardsService, LeaderboardCategory, LeaderboardPeriod } from './leaderboards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('leaderboards')
@UseGuards(JwtAuthGuard)
export class LeaderboardsController {
  constructor(private readonly leaderboardsService: LeaderboardsService) {}

  /**
   * GET /leaderboards
   * Query params:
   *   category — overall|takeoff|climb|level|turn|descent|landing|smoothness|safety|most_improved
   *   period   — alltime|30d|season
   *   site_id  — (optional) filter to a specific flight site
   */
  @Get()
  getLeaderboard(
    @Query('category') category: LeaderboardCategory = 'overall',
    @Query('period') period: LeaderboardPeriod = 'alltime',
    @Query('site_id') siteId?: string,
  ) {
    return this.leaderboardsService.getLeaderboard(category, period, siteId);
  }
}
