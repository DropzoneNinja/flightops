import { useState, useEffect } from 'react';

/**
 * Custom hook to detect if the current viewport is mobile-sized.
 *
 * @param breakpoint - Width in pixels below which the device is considered mobile (default: 900)
 * @returns boolean indicating whether the viewport width is below the breakpoint
 */
export function useIsMobile(breakpoint: number = 900): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}
