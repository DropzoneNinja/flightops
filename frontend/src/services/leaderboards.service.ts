import { api } from './api';
import type { Pilot } from './flights.service';

export type LeaderboardCategory =
  | 'overall'
  | 'takeoff'
  | 'climb'
  | 'level'
  | 'turn'
  | 'descent'
  | 'landing'
  | 'smoothness'
  | 'safety'
  | 'most_improved';

export type LeaderboardPeriod = 'alltime' | '30d' | 'season';

export interface LeaderboardEntry {
  rank: number;
  pilot: Pilot;
  score: number;
  flight_id: string;
  flight_date: string;
  site_id: string | null;
  glider: string | null;
  improvement?: number;
}

export const leaderboardsService = {
  async getLeaderboard(
    category: LeaderboardCategory = 'overall',
    period: LeaderboardPeriod = 'alltime',
    siteId?: string,
  ): Promise<LeaderboardEntry[]> {
    const params: Record<string, string> = { category, period };
    if (siteId) params.site_id = siteId;
    const response = await api.get<LeaderboardEntry[]>('/leaderboards', { params });
    return response.data;
  },
};
