import { useMemo } from 'react';

type Platform = 'ios' | 'android' | 'desktop';

export interface PlatformInfo {
  platform: Platform;
  isIOS: boolean;
  isAndroid: boolean;
  isMobileOS: boolean;
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;

  // Catches iPhone/iPod/iPad + modern iPadOS 13+ which reports as MacIntel but has touch
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isIOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Detects the current device OS platform.
 * Memoized — platform doesn't change during a session.
 */
export function usePlatform(): PlatformInfo {
  const platform = useMemo(() => detectPlatform(), []);
  return useMemo(
    () => ({
      platform,
      isIOS: platform === 'ios',
      isAndroid: platform === 'android',
      isMobileOS: platform === 'ios' || platform === 'android',
    }),
    [platform]
  );
}
