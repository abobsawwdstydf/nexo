import { useEffect, useState, useRef, useCallback } from 'react';
import { prefersReducedMotion, getAnimationDuration } from '../lib/animationUtils';

// Hook для управления видимостью с анимацией
export const useAnimatedVisibility = (
  isVisible: boolean,
  duration: number = 300
) => {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsAnimating(false);
      setTimeout(() => setShouldRender(false), duration);
    }
  }, [isVisible, duration]);

  return { shouldRender, isAnimating };
};

// Hook для Intersection Observer анимаций
export const useScrollAnimation = (
  threshold: number = 0.1,
  rootMargin: string = '0px'
) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold, rootMargin }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold, rootMargin]);

  return { ref, isVisible };
};

// Hook для анимации чисел
export const useCountAnimation = (
  end: number,
  duration: number = 2000,
  start: number = 0
) => {
  const [count, setCount] = useState(start);
  const [isAnimating, setIsAnimating] = useState(false);

  const animate = useCallback(() => {
    setIsAnimating(true);
    const startTime = performance.now();
    const difference = end - start;

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuad = progress * (2 - progress);
      const currentValue = start + difference * easeOutQuad;

      setCount(Math.round(currentValue));

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setCount(end);
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(step);
  }, [start, end, duration]);

  useEffect(() => {
    animate();
  }, [animate]);

  return { count, isAnimating, restart: animate };
};

// Hook для управления hover состоянием
export const useHover = () => {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    node.addEventListener('mouseenter', handleMouseEnter);
    node.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      node.removeEventListener('mouseenter', handleMouseEnter);
      node.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return { ref, isHovered };
};

// Hook для управления focus состоянием
export const useFocus = () => {
  const [isFocused, setIsFocused] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    node.addEventListener('focus', handleFocus);
    node.addEventListener('blur', handleBlur);

    return () => {
      node.removeEventListener('focus', handleFocus);
      node.removeEventListener('blur', handleBlur);
    };
  }, []);

  return { ref, isFocused };
};

// Hook для отслеживания позиции мыши
export const useMousePosition = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return position;
};

// Hook для parallax эффекта
export const useParallax = (speed: number = 0.5) => {
  const [offset, setOffset] = useState(0);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const scrolled = window.pageYOffset;
      const rate = scrolled * speed;
      setOffset(rate);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);

  return { ref, offset };
};

// Hook для управления prefers-reduced-motion
export const useReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion());

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setReducedMotion(mediaQuery.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return reducedMotion;
};

// Hook для staggered анимаций
export const useStaggeredAnimation = (
  itemCount: number,
  baseDelay: number = 50
) => {
  const [visibleItems, setVisibleItems] = useState<number[]>([]);

  useEffect(() => {
    const delays = Array.from({ length: itemCount }, (_, i) => i * baseDelay);

    delays.forEach((delay, index) => {
      setTimeout(() => {
        setVisibleItems((prev) => [...prev, index]);
      }, delay);
    });

    return () => setVisibleItems([]);
  }, [itemCount, baseDelay]);

  return visibleItems;
};

// Hook для управления анимацией при монтировании
export const useMountAnimation = (duration: number = 300) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

  return isMounted;
};

// Hook для управления transition состояниями
export const useTransition = (
  isVisible: boolean,
  duration: number = 300
) => {
  const [state, setState] = useState<'entering' | 'entered' | 'exiting' | 'exited'>(
    isVisible ? 'entered' : 'exited'
  );

  useEffect(() => {
    if (isVisible) {
      setState('entering');
      const timer = setTimeout(() => setState('entered'), duration);
      return () => clearTimeout(timer);
    } else {
      setState('exiting');
      const timer = setTimeout(() => setState('exited'), duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration]);

  return state;
};

// Hook для управления ripple эффектом
export const useRipple = () => {
  const [ripples, setRipples] = useState<
    Array<{ x: number; y: number; id: number }>
  >([]);

  const addRipple = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();

    setRipples((prev) => [...prev, { x, y, id }]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);
  }, []);

  return { ripples, addRipple };
};

// Hook для управления tilt эффектом
export const useTilt = (maxTilt: number = 10) => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const tiltX = ((y - centerY) / centerY) * -maxTilt;
      const tiltY = ((x - centerX) / centerX) * maxTilt;

      setTilt({ x: tiltX, y: tiltY });
    };

    const handleMouseLeave = () => {
      setTilt({ x: 0, y: 0 });
    };

    node.addEventListener('mousemove', handleMouseMove);
    node.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      node.removeEventListener('mousemove', handleMouseMove);
      node.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [maxTilt]);

  return { ref, tilt };
};

// Hook для управления progress анимацией
export const useProgress = (
  targetProgress: number,
  duration: number = 1000
) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = performance.now();
    const startProgress = progress;
    const difference = targetProgress - startProgress;

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progressValue = Math.min(elapsed / duration, 1);
      const easeOutQuad = progressValue * (2 - progressValue);
      const currentProgress = startProgress + difference * easeOutQuad;

      setProgress(currentProgress);

      if (progressValue < 1) {
        requestAnimationFrame(step);
      } else {
        setProgress(targetProgress);
      }
    };

    requestAnimationFrame(step);
  }, [targetProgress, duration]);

  return progress;
};

// Hook для управления typewriter эффектом
export const useTypewriter = (
  text: string,
  speed: number = 50,
  startDelay: number = 0
) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayedText('');
    setIsComplete(false);

    const startTimer = setTimeout(() => {
      let currentIndex = 0;

      const interval = setInterval(() => {
        if (currentIndex <= text.length) {
          setDisplayedText(text.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(interval);
          setIsComplete(true);
        }
      }, speed);

      return () => clearInterval(interval);
    }, startDelay);

    return () => clearTimeout(startTimer);
  }, [text, speed, startDelay]);

  return { displayedText, isComplete };
};
