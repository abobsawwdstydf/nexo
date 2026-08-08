import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PerformanceState {
  lowPowerMode: boolean;
  reducedAnimations: boolean;
  virtualizationEnabled: boolean;
  toggleLowPowerMode: () => void;
  toggleReducedAnimations: () => void;
  setLowPowerMode: (val: boolean) => void;
}

// Auto-detect weak device based on CPU cores, RAM, hardware concurrency, or screen size
const isWeakDevice = () => {
  if (typeof window === 'undefined') return false;
  const concurrency = navigator.hardwareConcurrency || 4;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
  const isMobile = window.innerWidth <= 768;
  return concurrency <= 2 || memory <= 2 || (isMobile && concurrency <= 4);
};

export const usePerformanceStore = create<PerformanceState>()(
  persist(
    (set) => ({
      lowPowerMode: isWeakDevice(),
      reducedAnimations: isWeakDevice(),
      virtualizationEnabled: true,
      toggleLowPowerMode: () => set((state) => ({ lowPowerMode: !state.lowPowerMode })),
      toggleReducedAnimations: () => set((state) => ({ reducedAnimations: !state.reducedAnimations })),
      setLowPowerMode: (val) => set({ lowPowerMode: val }),
    }),
    {
      name: 'nexo_performance_settings',
    }
  )
);
