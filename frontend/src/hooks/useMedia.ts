import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaService, CreateMediaData } from '../services/media.service';

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
 * Hook to get all unique dates with media counts
 */
export function useMediaDatesWithCounts() {
  return useQuery({
    queryKey: [...MEDIA_QUERY_KEY, 'dates', 'counts'],
    queryFn: () => mediaService.getMediaDatesWithCounts(),
    staleTime: 5 * 60 * 1000, // 5 minutes
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
