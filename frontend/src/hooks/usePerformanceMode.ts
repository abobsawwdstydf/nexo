import { useState, useEffect } from 'react';

export function usePerformanceMode() {
  const [isLowPerf, setIsLowPerf] = useState(false);

  useEffect(() => {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as any).deviceMemory || 4;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile && (cores <= 4 || memory <= 4)) {
      setIsLowPerf(true);
      document.body.classList.add('perf-mode');
    }
  }, []);

  return isLowPerf;
}
