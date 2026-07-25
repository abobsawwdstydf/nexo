import { useState, useEffect } from 'react';

/**
 * Responsive Hooks
 * Detect device types and screen sizes
 */

export interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  isFoldable: boolean;
  width: number;
  height: number;
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isLandscape: false,
        isFoldable: false,
        width: 1920,
        height: 1080,
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    return {
      isMobile: width < 640,
      isTablet: width >= 640 && width < 1024,
      isDesktop: width >= 1024,
      isLandscape: width > height && width < 896,
      isFoldable: width < 280,
      width,
      height,
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setState({
        isMobile: width < 640,
        isTablet: width >= 640 && width < 1024,
        isDesktop: width >= 1024,
        isLandscape: width > height && width < 896,
        isFoldable: width < 280,
        width,
        height,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return state;
}

// Hook for media queries
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// Specific breakpoint hooks
export function useIsMobile() {
  return useMediaQuery('(max-width: 639px)');
}

export function useIsTablet() {
  return useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
}

export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)');
}

export function useIsLandscape() {
  return useMediaQuery('(max-width: 896px) and (orientation: landscape)');
}

export function useIsFoldable() {
  return useMediaQuery('(max-width: 280px)');
}

// Prefers reduced motion
export function usePrefersReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

// Prefers color scheme
export function usePrefersColorScheme(): 'light' | 'dark' | null {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const prefersLight = useMediaQuery('(prefers-color-scheme: light)');

  if (prefersDark) return 'dark';
  if (prefersLight) return 'light';
  return null;
}

// Touch device detection
export function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0
    );
  }, []);

  return isTouch;
}

// Safe area insets (for devices with notches)
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const getInset = (variable: string) => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(variable)
        .trim();
      return parseInt(value) || 0;
    };

    const updateInsets = () => {
      setInsets({
        top: getInset('env(safe-area-inset-top)'),
        right: getInset('env(safe-area-inset-right)'),
        bottom: getInset('env(safe-area-inset-bottom)'),
        left: getInset('env(safe-area-inset-left)'),
      });
    };

    updateInsets();
    window.addEventListener('resize', updateInsets);
    return () => window.removeEventListener('resize', updateInsets);
  }, []);

  return insets;
}

// Viewport height (accounting for mobile browser chrome)
export function useViewportHeight() {
  const [height, setHeight] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return window.innerHeight;
  });

  useEffect(() => {
    const updateHeight = () => {
      setHeight(window.innerHeight);
      // Update CSS custom property
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  return height;
}
