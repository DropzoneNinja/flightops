import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaService, CreateMediaData, MediaFilters, UpdateMediaData } from '../services/media.service';

const MEDIA_QUERY_KEY = ['media'];

/**
 * Hook to get all unique dates that have media
 */
export function useMediaDates() {
  return useQuery({
    queryKey: [...MEDIA_QUERY_KEY, 'dates'],
    queryFn: () => mediaService.getMediaDates(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to get all unique dates with media counts (supports optional filters)
 */
export function useMediaDatesWithCounts(filters?: MediaFilters) {
  return useQuery({
    queryKey: [...MEDIA_QUERY_KEY, 'dates', 'counts', filters ?? {}],
    queryFn: () => mediaService.getMediaDatesWithCounts(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to get all sites with their media counts (supports optional filters)
 */
export function useSitesWithMediaCounts(filters?: MediaFilters) {
  return useQuery({
    queryKey: [...MEDIA_QUERY_KEY, 'sites', 'counts', filters ?? {}],
    queryFn: () => mediaService.getSitesWithMediaCounts(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to get all distinct pilot names from media entries
 */
export function useMediaPilots() {
  return useQuery({
    queryKey: [...MEDIA_QUERY_KEY, 'pilots'],
    queryFn: () => mediaService.getUniquePilots(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to search media by filters (uploaded_by, pilots, year, month)
 */
export function useMediaSearch(filters: MediaFilters | null) {
  return useQuery({
    queryKey: [...MEDIA_QUERY_KEY, 'search', filters ?? {}],
    queryFn: () => mediaService.searchMedia(filters!),
    enabled: !!filters,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to get all media for a specific date
 */
export function useMediaByDate(date: string | undefined) {
  return useQuery({
    queryKey: [...MEDIA_QUERY_KEY, 'date', date],
    queryFn: () => mediaService.getMediaByDate(date!),
    enabled: !!date,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to get all media for a specific site
 */
export function useMediaBySite(siteId: string | undefined) {
  return useQuery({
    queryKey: [...MEDIA_QUERY_KEY, 'site', siteId],
    queryFn: () => mediaService.getMediaBySite(siteId!),
    enabled: !!siteId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to get all media for a specific mission
 */
export function useMediaByMission(missionId: string | undefined) {
  return useQuery({
    queryKey: [...MEDIA_QUERY_KEY, 'mission', missionId],
    queryFn: () => mediaService.getMediaByMission(missionId!),
    enabled: !!missionId,
    staleTime: 2 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to get a single media item by ID
 */
export function useMediaById(id: string | undefined) {
  return useQuery({
    queryKey: [...MEDIA_QUERY_KEY, 'item', id],
    queryFn: () => mediaService.getMediaById(id!),
    enabled: !!id,
  });
}

/**
 * Hook to upload media with progress tracking
 */
export function useMediaUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      data,
      onProgress,
    }: {
      file: File;
      data: CreateMediaData;
      onProgress?: (progress: number) => void;
    }) => {
      return mediaService.uploadMedia(file, data, (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      });
    },
    onSuccess: () => {
      // Invalidate all media queries to refresh the data
      queryClient.invalidateQueries({ queryKey: MEDIA_QUERY_KEY });
    },
  });
}

/**
 * Hook to update media metadata (uploader or admin only)
 */
export function useMediaUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMediaData }) =>
      mediaService.updateMedia(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEDIA_QUERY_KEY });
    },
  });
}

/**
 * Hook to delete media (admin only)
 */
export function useMediaDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => mediaService.deleteMedia(id),
    onSuccess: () => {
      // Invalidate all media queries to refresh the data
      queryClient.invalidateQueries({ queryKey: MEDIA_QUERY_KEY });
    },
  });
}
