/**
 * Централизованная система анимаций для всего приложения
 * Обеспечивает плавные переходы и стабильную работу
 */

// Базовые timing functions
export const easings = {
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// Длительности анимаций
export const durations = {
  fastest: 100,
  fast: 200,
  normal: 300,
  slow: 400,
  slowest: 500,
};

// CSS классы для анимаций
export const animations = {
  // Fade анимации
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
  fadeOut: `
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `,
  
  // Slide анимации
  slideInUp: `
    @keyframes slideInUp {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `,
  slideInDown: `
    @keyframes slideInDown {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `,
  slideInLeft: `
    @keyframes slideInLeft {
      from {
        transform: translateX(-100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `,
  slideInRight: `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `,
  
  // Scale анимации
  scaleIn: `
    @keyframes scaleIn {
      from {
        transform: scale(0.9);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
  `,
  scaleOut: `
    @keyframes scaleOut {
      from {
        transform: scale(1);
        opacity: 1;
      }
      to {
        transform: scale(0.9);
        opacity: 0;
      }
    }
  `,
  
  // Bounce анимация
  bounce: `
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
  `,
  
  // Pulse анимация
  pulse: `
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
  `,
  
  // Shake анимация (для ошибок)
  shake: `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
      20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
  `,
  
  // Rotate анимация
  rotate: `
    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,
  
  // Shimmer эффект (для загрузки)
  shimmer: `
    @keyframes shimmer {
      0% { background-position: -1000px 0; }
      100% { background-position: 1000px 0; }
    }
  `,
};

// Utility классы для Tailwind
export const animationClasses = {
  fadeIn: 'animate-[fadeIn_0.3s_ease-out]',
  fadeOut: 'animate-[fadeOut_0.3s_ease-out]',
  slideInUp: 'animate-[slideInUp_0.3s_ease-out]',
  slideInDown: 'animate-[slideInDown_0.3s_ease-out]',
  slideInLeft: 'animate-[slideInLeft_0.3s_ease-out]',
  slideInRight: 'animate-[slideInRight_0.3s_ease-out]',
  scaleIn: 'animate-[scaleIn_0.3s_ease-out]',
  scaleOut: 'animate-[scaleOut_0.3s_ease-out]',
  bounce: 'animate-[bounce_0.5s_ease-in-out]',
  pulse: 'animate-[pulse_1s_ease-in-out_infinite]',
  shake: 'animate-[shake_0.5s_ease-in-out]',
  rotate: 'animate-[rotate_1s_linear_infinite]',
  shimmer: 'animate-[shimmer_2s_linear_infinite]',
};

// Transition классы
export const transitions = {
  all: 'transition-all duration-300 ease-in-out',
  colors: 'transition-colors duration-200 ease-in-out',
  transform: 'transition-transform duration-300 ease-in-out',
  opacity: 'transition-opacity duration-200 ease-in-out',
  fast: 'transition-all duration-150 ease-in-out',
  slow: 'transition-all duration-500 ease-in-out',
};

// Hook для управления анимациями
export const useAnimation = (isVisible: boolean, delay = 0) => {
  const [shouldRender, setShouldRender] = React.useState(isVisible);
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setTimeout(() => setIsAnimating(true), delay);
    } else {
      setIsAnimating(false);
      setTimeout(() => setShouldRender(false), durations.normal);
    }
  }, [isVisible, delay]);

  return { shouldRender, isAnimating };
};

// Добавляем React import для hook
import React from 'react';

// Framer Motion варианты для компонентов
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3 }
};

export const scaleInBounce = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
  transition: { type: 'spring', stiffness: 300, damping: 25 }
};

export const slideInFromRight = {
  initial: { opacity: 0, x: 100 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 100 },
  transition: { duration: 0.3 }
};

export const slideInFromLeft = {
  initial: { opacity: 0, x: -100 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -100 },
  transition: { duration: 0.3 }
};

export const pageTransitionFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 }
};
