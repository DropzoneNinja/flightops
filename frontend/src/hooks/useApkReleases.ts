import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apkReleaseService } from '../services/apkRelease.service';

const APK_RELEASES_QUERY_KEY = ['apk-releases'];
const APK_ACCESS_QUERY_KEY = ['apk-releases', 'access'];

/**
 * Hook to list all APK releases (admin or explicitly-authorized users)
 */
export function useApkReleases() {
  return useQuery({
    queryKey: APK_RELEASES_QUERY_KEY,
    queryFn: () => apkReleaseService.listReleases(),
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to upload a new APK release with progress tracking (admin only)
 */
export function useApkReleaseUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      versionLabel,
      releaseNotes,
      onProgress,
    }: {
      file: File;
      versionLabel: string;
      releaseNotes?: string;
      onProgress?: (progress: number) => void;
    }) => {
      return apkReleaseService.uploadRelease(file, versionLabel, releaseNotes, (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APK_RELEASES_QUERY_KEY });
    },
  });
}

/**
 * Hook to delete an APK release (admin only)
 */
export function useApkReleaseDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apkReleaseService.deleteRelease(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APK_RELEASES_QUERY_KEY });
    },
  });
}

/**
 * Hook to list every user with their current Flightoid access flag (admin only)
 */
export function useApkAccessList() {
  return useQuery({
    queryKey: APK_ACCESS_QUERY_KEY,
    queryFn: () => apkReleaseService.listAccess(),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to grant/revoke a user's Flightoid access (admin only)
 */
export function useApkAccessMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: APK_ACCESS_QUERY_KEY });

  const grant = useMutation({
    mutationFn: (userId: string) => apkReleaseService.grantAccess(userId),
    onSuccess: invalidate,
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => apkReleaseService.revokeAccess(userId),
    onSuccess: invalidate,
  });

  return { grant, revoke };
}
