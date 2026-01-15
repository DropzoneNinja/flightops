import { useQuery } from '@tanstack/react-query';
import { airspaceService, AirspaceGeoJSON, AirspaceClass } from '../services/airspace.service';

/**
 * Hook to fetch airspace GeoJSON data
 * Caches indefinitely since airspace data is static
 */
export function useAirspace() {
  const { data, isLoading, error } = useQuery<AirspaceGeoJSON>({
    queryKey: ['airspace'],
    queryFn: () => airspaceService.getAirspace(),
    staleTime: Infinity, // Data never becomes stale (static airspace)
    gcTime: Infinity, // Keep in cache forever (formerly cacheTime)
    retry: 2,
  });

  return {
    airspace: data,
    isLoading,
    error: error ? String(error) : null,
  };
}

/**
 * Hook to fetch available airspace classes
 */
export function useAirspaceClasses() {
  const { data, isLoading, error } = useQuery<AirspaceClass[]>({
    queryKey: ['airspace', 'classes'],
    queryFn: () => airspaceService.getClasses(),
    staleTime: Infinity,
    gcTime: Infinity, // Keep in cache forever (formerly cacheTime)
  });

  return {
    classes: data || [],
    isLoading,
    error: error ? String(error) : null,
  };
}
