import { useQuery } from '@tanstack/react-query';
import {
  leaderboardsService,
  LeaderboardCategory,
  LeaderboardPeriod,
} from '../services/leaderboards.service';

export type { LeaderboardCategory, LeaderboardPeriod, LeaderboardEntry } from '../services/leaderboards.service';

const LEADERBOARDS_KEY = ['leaderboards'];

/** Get leaderboard entries for a category + period */
export function useLeaderboard(
  category: LeaderboardCategory = 'overall',
  period: LeaderboardPeriod = 'alltime',
  siteId?: string,
) {
  return useQuery({
    queryKey: [...LEADERBOARDS_KEY, category, period, siteId ?? 'all'],
    queryFn: () => leaderboardsService.getLeaderboard(category, period, siteId),
    staleTime: 2 * 60 * 1000,
    retry: 2,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),
  });
}
