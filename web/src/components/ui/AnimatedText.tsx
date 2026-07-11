import React, { useEffect, useState, useRef } from 'react';

interface AnimatedTextProps {
  text: string;
  animation?: 'fade' | 'slide' | 'typewriter' | 'wave' | 'gradient' | 'glitch';
  delay?: number;
  duration?: number;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span';
  gradient?: boolean;
  glow?: boolean;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  animation = 'fade',
  delay = 0,
  duration = 1000,
  className = '',
  as: Component = 'p',
  gradient = false,
  glow = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  // Typewriter effect
  useEffect(() => {
    if (animation === 'typewriter' && isVisible) {
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex <= text.length) {
          setDisplayedText(text.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(interval);
        }
      }, duration / text.length);

      return () => clearInterval(interval);
    }
  }, [animation, isVisible, text, duration]);

  // Intersection Observer для анимации при скролле
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  const animationClasses = {
    fade: `transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`,
    slide: `transition-all duration-700 ${
      isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
    }`,
    typewriter: '',
    wave: '',
    gradient: 'gradient-text',
    glitch: isVisible ? 'animate-glitch' : '',
  };

  const baseClasses = `
    ${animationClasses[animation]}
    ${gradient ? 'gradient-text' : ''}
    ${glow ? 'text-shadow-glow' : ''}
    ${className}
  `;

  if (animation === 'typewriter') {
    return (
      <Component ref={ref as any} className={baseClasses}>
        {displayedText}
        <span className="animate-pulse">|</span>
      </Component>
    );
  }

  if (animation === 'wave') {
    return (
      <Component ref={ref as any} className={baseClasses}>
        {text.split('').map((char, index) => (
          <span
            key={index}
            className="inline-block animate-wave"
            style={{
              animationDelay: `${index * 0.05}s`,
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </Component>
    );
  }

  return (
    <Component ref={ref as any} className={baseClasses}>
      {text}
    </Component>
  );
};

// Gradient animated text
export const GradientText: React.FC<{
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}> = ({ children, className = '', animate = false }) => {
  return (
    <span
      className={`
        bg-gradient-to-r from-nexo-400 via-purple-400 to-pink-400
        bg-clip-text text-transparent
        ${animate ? 'animate-gradient' : ''}
        ${className}
      `}
    >
      {children}
    </span>
  );
};

// Glowing text
export const GlowText: React.FC<{
  children: React.ReactNode;
  color?: string;
  className?: string;
}> = ({ children, color = 'nexo-500', className = '' }) => {
  return (
    <span
      className={`
        relative inline-block
        ${className}
      `}
      style={{
        textShadow: `0 0 20px var(--color-${color}), 0 0 40px var(--color-${color})`,
      }}
    >
      {children}
    </span>
  );
};

// Typing indicator
export const TypingIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
      <span className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
      <span className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
    </div>
  );
};

// Shimmer text (loading effect)
export const ShimmerText: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <span
      className={`
        relative inline-block overflow-hidden
        ${className}
      `}
    >
      <span className="relative z-10">{children}</span>
      <span
        className="
          absolute inset-0 -translate-x-full
          bg-gradient-to-r from-transparent via-white/30 to-transparent
          animate-shimmer
        "
      />
    </span>
  );
};

// Glitch text effect
export const GlitchText: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="relative z-10">{children}</span>
      <span
        className="absolute top-0 left-0 text-red-500 opacity-70 animate-glitch-1"
        aria-hidden="true"
      >
        {children}
      </span>
      <span
        className="absolute top-0 left-0 text-blue-500 opacity-70 animate-glitch-2"
        aria-hidden="true"
      >
        {children}
      </span>
    </span>
  );
};
