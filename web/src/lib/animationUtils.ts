/**
 * Утилиты для работы с анимациями
 */

// Генерация случайного delay для staggered анимаций
export const getStaggerDelay = (index: number, baseDelay: number = 50): number => {
  return index * baseDelay;
};

// Easing функции
export const easings = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => --t * t * t + 1,
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - --t * t * t * t,
  easeInOutQuart: (t: number) =>
    t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,
  easeInQuint: (t: number) => t * t * t * t * t,
  easeOutQuint: (t: number) => 1 + --t * t * t * t * t,
  easeInOutQuint: (t: number) =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t,
};

// Анимация числа (counter animation)
export const animateNumber = (
  start: number,
  end: number,
  duration: number,
  callback: (value: number) => void,
  easing: (t: number) => number = easings.easeOutQuad
): void => {
  const startTime = performance.now();
  const difference = end - start;

  const step = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easing(progress);
    const currentValue = start + difference * easedProgress;

    callback(currentValue);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      callback(end);
    }
  };

  requestAnimationFrame(step);
};

// Плавная прокрутка к элементу
export const smoothScrollTo = (
  element: HTMLElement | null,
  offset: number = 0,
  duration: number = 500
): void => {
  if (!element) return;

  const targetPosition = element.getBoundingClientRect().top + window.pageYOffset - offset;
  const startPosition = window.pageYOffset;
  const distance = targetPosition - startPosition;
  const startTime = performance.now();

  const step = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easings.easeInOutQuad(progress);

    window.scrollTo(0, startPosition + distance * easedProgress);

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };

  requestAnimationFrame(step);
};

// Intersection Observer для анимаций при скролле
export const createScrollAnimationObserver = (
  callback: (entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit
): IntersectionObserver => {
  const defaultOptions: IntersectionObserverInit = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
    ...options,
  };

  return new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback(entry);
      }
    });
  }, defaultOptions);
};

// Генерация confetti частиц
export const createConfetti = (
  container: HTMLElement,
  count: number = 50,
  colors: string[] = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899']
): void => {
  for (let i = 0; i < count; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.cssText = `
      position: fixed;
      width: 10px;
      height: 10px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${Math.random() * 100}vw;
      top: -10px;
      opacity: ${Math.random() * 0.5 + 0.5};
      transform: rotate(${Math.random() * 360}deg);
      animation: confetti-fall ${Math.random() * 2 + 2}s linear forwards;
      animation-delay: ${Math.random() * 0.5}s;
      pointer-events: none;
      z-index: 9999;
    `;

    container.appendChild(confetti);

    setTimeout(() => {
      confetti.remove();
    }, 4000);
  }
};

// Ripple эффект
export const createRipple = (
  event: React.MouseEvent<HTMLElement>,
  color: string = 'rgba(255, 255, 255, 0.3)'
): void => {
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const ripple = document.createElement('span');
  ripple.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: ${color};
    transform: translate(-50%, -50%);
    animation: ripple-animation 0.6s ease-out;
    pointer-events: none;
  `;

  button.appendChild(ripple);

  setTimeout(() => {
    ripple.remove();
  }, 600);
};

// Shake анимация для элемента
export const shakeElement = (element: HTMLElement | null): void => {
  if (!element) return;

  element.classList.add('animate-shake');
  setTimeout(() => {
    element.classList.remove('animate-shake');
  }, 500);
};

// Pulse анимация для элемента
export const pulseElement = (element: HTMLElement | null, duration: number = 1000): void => {
  if (!element) return;

  element.classList.add('animate-pulse');
  setTimeout(() => {
    element.classList.remove('animate-pulse');
  }, duration);
};

// Проверка поддержки анимаций
export const supportsAnimations = (): boolean => {
  const prefixes = ['animation', 'webkitAnimation', 'mozAnimation', 'oAnimation', 'msAnimation'];
  const element = document.createElement('div');

  return prefixes.some((prefix) => prefix in element.style);
};

// Проверка prefers-reduced-motion
export const prefersReducedMotion = (): boolean => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Получение оптимальной длительности анимации
export const getAnimationDuration = (baseDuration: number): number => {
  return prefersReducedMotion() ? 1 : baseDuration;
};

// Throttle функция для оптимизации
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Debounce функция для оптимизации
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

// RAF throttle для scroll событий
export const rafThrottle = <T extends (...args: any[]) => any>(
  func: T
): ((...args: Parameters<T>) => void) => {
  let rafId: number | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      func.apply(this, args);
      rafId = null;
    });
  };
};

// Генерация случайного цвета
export const randomColor = (): string => {
  const colors = [
    '#6366f1',
    '#8b5cf6',
    '#a855f7',
    '#ec4899',
    '#f43f5e',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#10b981',
    '#14b8a6',
    '#06b6d4',
    '#3b82f6',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Интерполяция цветов
export const interpolateColor = (
  color1: string,
  color2: string,
  factor: number
): string => {
  const c1 = parseInt(color1.slice(1), 16);
  const c2 = parseInt(color2.slice(1), 16);

  const r1 = (c1 >> 16) & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = c1 & 0xff;

  const r2 = (c2 >> 16) & 0xff;
  const g2 = (c2 >> 8) & 0xff;
  const b2 = c2 & 0xff;

  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

// Получение случайного элемента из массива
export const randomElement = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

// Случайное число в диапазоне
export const randomRange = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

// Clamp значения
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

// Lerp (linear interpolation)
export const lerp = (start: number, end: number, factor: number): number => {
  return start + (end - start) * factor;
};

// Map значения из одного диапазона в другой
export const mapRange = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number => {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
};
