import { useState, useEffect } from 'react';

/**
 * Hook to determine how many calendar months should be visible based on viewport width
 * @returns Number of months to display (1 or 2)
 */
export function useVisibleMonthCount(): number {
  const [count, setCount] = useState(() => {
    const width = window.innerWidth;
    if (width >= 768) return 2; // md breakpoint
    return 1;
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 768) {
        setCount(2);
      } else {
        setCount(1);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return count;
}
