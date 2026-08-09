import { useEffect } from 'react';

const PERF_MODE_CLASS = 'perf-mode';

export function usePerformanceMode() {
  useEffect(() => {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as any).deviceMemory || 4;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile && (cores <= 4 || memory <= 4)) {
      document.body.classList.add(PERF_MODE_CLASS);
    }
    return () => {
      document.body.classList.remove(PERF_MODE_CLASS);
    };
  }, []);
}
