import { useEffect } from 'react';

const PERF_MODE_CLASS = 'perf-mode';

export function usePerformanceMode() {
  useEffect(() => {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as any).deviceMemory || 4;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Perf-mode для слабых устройств: мало ядер/памяти, мобильные с малыми
    // ресурсами, либо пользователь просит меньше анимаций (reduced motion).
    const weak =
      cores <= 2 ||
      memory <= 2 ||
      (isMobile && (cores <= 4 || memory <= 4)) ||
      reducedMotion;

    if (weak) {
      document.body.classList.add(PERF_MODE_CLASS);
    }
    return () => {
      document.body.classList.remove(PERF_MODE_CLASS);
    };
  }, []);
}
