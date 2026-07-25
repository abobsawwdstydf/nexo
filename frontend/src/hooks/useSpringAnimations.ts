import { useState, useCallback, useRef, useEffect } from 'react';

// ==================== HOOK: useSpringAnimation ====================
export const useSpringAnimation = ({
  from = { opacity: 0 },
  to = { opacity: 1 },
  config,
}: {
  from?: Record<string, any>;
  to?: Record<string, any>;
  config?: any;
} = {}) => {
  const [isActive, setIsActive] = useState(false);

  const styles = isActive ? to : from;

  const activate = useCallback(() => setIsActive(true), []);
  const deactivate = useCallback(() => setIsActive(false), []);
  const toggle = useCallback(() => setIsActive(v => !v), []);

  return { styles, isActive, activate, deactivate, toggle };
};

// ==================== HOOK: useSpringTrail ====================
export const useSpringTrail = (items: any[], staggerDelay = 50) => {
  const [active, setActive] = useState(false);

  const trail = items.map((_, i) => ({
    opacity: active ? 1 : 0,
    transform: active ? 'translateY(0px)' : 'translateY(20px)',
    transition: `all ${staggerDelay}ms ease ${i * staggerDelay}ms`,
  }));

  const start = useCallback(() => setActive(true), []);
  const stop = useCallback(() => setActive(false), []);

  return { trail, active, start, stop };
};

// ==================== HOOK: useSpringSprings ====================
export const useSpringSprings = (
  count: number,
  isActive: boolean
) => {
  const springs = Array.from({ length: count }, (_, i) => ({
    opacity: isActive ? 1 : 0,
    transform: isActive ? 'scale(1) translateY(0px)' : 'scale(0.8) translateY(20px)',
    transition: `all 300ms ease ${i * 50}ms`,
  }));

  return springs;
};

// ==================== HOOK: useLongPress ====================
export const useLongPress = (
  onLongPress: () => void,
  onClick?: () => void,
  delay = 500
) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const start = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsLongPressing(true);
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (!isLongPressing && onClick) {
      onClick();
    }
    setIsLongPressing(false);
  }, [onClick, isLongPressing]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsLongPressing(false);
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: stop,
    isLongPressing,
  };
};

// ==================== HOOK: useDoubleTap ====================
export const useDoubleTap = (
  onDoubleTap: () => void,
  onTap?: () => void,
  delay = 300
) => {
  const lastTap = useRef<number>(0);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < delay) {
      onDoubleTap();
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      if (onTap) {
        setTimeout(() => {
          if (lastTap.current === now) {
            onTap();
          }
        }, delay);
      }
    }
  }, [onDoubleTap, onTap, delay]);

  return { onClick: handleTap };
};

// ==================== HOOK: useSwipe ====================
export const useSwipe = ({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
}: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
}) => {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };

    const diffX = touchEnd.x - touchStart.current.x;
    const diffY = touchEnd.y - touchStart.current.y;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (Math.abs(diffX) > threshold) {
        if (diffX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      }
    } else {
      if (Math.abs(diffY) > threshold) {
        if (diffY > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      }
    }

    touchStart.current = null;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

  return { onTouchStart, onTouchEnd };
};
