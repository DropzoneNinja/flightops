import { useQuery } from '@tanstack/react-query';
import { weatherService } from '../services/weather.service';

/**
 * Custom hook for fetching multi-height wind data for debug visualization
 * @param siteId The site ID
 * @param date The date in YYYY-MM-DD format (null to disable query)
 * @returns Query result with multi-height forecast data
 */
export function useMultiHeightWeather(siteId: string, date: string | null) {
  return useQuery({
    queryKey: ['multi-height-weather', siteId, date],
    queryFn: () => weatherService.getMultiHeightData(siteId, date!),
    enabled: !!date, // Only fetch when date is provided
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 2, // Retry twice on failure
  });
}
