import React, { useState, useRef, useEffect } from 'react';

// ==================== ANIMATED FADE IN ====================
export const FadeIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}> = ({ children, delay = 0, duration = 500, className = '' }) => {
  return (
    <div
      className={className}
      style={{
        opacity: 0,
        transform: 'translateY(20px)',
        animation: `fadeInUp ${duration}ms ease ${delay}ms forwards`,
      }}
    >
      {children}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

// ==================== ANIMATED SCALE IN ====================
export const ScaleIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className = '' }) => {
  return (
    <div
      className={className}
      style={{
        opacity: 0,
        transform: 'scale(0.8)',
        animation: `scaleIn 300ms ease ${delay}ms forwards`,
      }}
    >
      {children}
      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

// ==================== ANIMATED SLIDE IN ====================
export const SlideIn: React.FC<{
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  delay?: number;
  distance?: number;
  className?: string;
}> = ({ children, direction = 'right', delay = 0, distance = 100, className = '' }) => {
  const directionStyles = {
    left: { from: { opacity: 0, x: -distance }, to: { opacity: 1, x: 0 } },
    right: { opacity: 0, x: distance, to: { opacity: 1, x: 0 } },
    up: { opacity: 0, y: -distance, to: { opacity: 1, y: 0 } },
    down: { opacity: 0, y: distance, to: { opacity: 1, y: 0 } },
  };

  const keyframes = {
    left: `from { opacity: 0; transform: translateX(-${distance}px); } to { opacity: 1; transform: translateX(0); }`,
    right: `from { opacity: 0; transform: translateX(${distance}px); } to { opacity: 1; transform: translateX(0); }`,
    up: `from { opacity: 0; transform: translateY(-${distance}px); } to { opacity: 1; transform: translateY(0); }`,
    down: `from { opacity: 0; transform: translateY(${distance}px); } to { opacity: 1; transform: translateY(0); }`,
  };

  return (
    <div
      className={className}
      style={{
        animation: `slideIn 300ms ease ${delay}ms forwards`,
      }}
    >
      {children}
      <style>{`
        @keyframes slideIn {
          ${keyframes[direction]}
        }
      `}</style>
    </div>
  );
};

// ==================== ANIMATED STAGGER LIST ====================
export const StaggerList: React.FC<{
  children: React.ReactNode[];
  staggerDelay?: number;
  className?: string;
}> = ({ children, staggerDelay = 50, className = '' }) => {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <FadeIn key={index} delay={index * staggerDelay}>
          {child}
        </FadeIn>
      ))}
    </div>
  );
};

// ==================== ANIMATED HOVER SCALE ====================
export const HoverScale: React.FC<{
  children: React.ReactNode;
  scale?: number;
  className?: string;
  onClick?: () => void;
}> = ({ children, scale = 1.05, className = '', onClick }) => {
  return (
    <div
      className={className}
      style={{ transition: 'transform 0.2s ease' }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = `scale(${scale})`)}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

// ==================== ANIMATED PULSE ====================
export const Pulse: React.FC<{
  children: React.ReactNode;
  scale?: number;
  className?: string;
}> = ({ children, scale = 1.05, className = '' }) => {
  return (
    <div className={className}>
      {children}
      <style>{`
        @keyframes pulseScale {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(${scale}); }
        }
      `}</style>
    </div>
  );
};

// ==================== ANIMATED BOUNCE ====================
export const Bounce: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={className}>
      {children}
      <style>{`
        @keyframes bounceY {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

// ==================== ANIMATED ROTATE ====================
export const Rotate: React.FC<{
  children: React.ReactNode;
  degrees?: number;
  className?: string;
}> = ({ children, degrees = 360, className = '' }) => {
  return (
    <div className={className}>
      {children}
      <style>{`
        @keyframes rotateAnim {
          from { transform: rotate(0deg); }
          to { transform: rotate(${degrees}deg); }
        }
      `}</style>
    </div>
  );
};

// ==================== ANIMATED MORPH (ICON) ====================
export const MorphIcon: React.FC<{
  from: React.ReactNode;
  to: React.ReactNode;
  active: boolean;
  className?: string;
}> = ({ from, to, active, className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: active ? 0 : 1,
          transform: active ? 'scale(0.5) rotate(-180deg)' : 'scale(1) rotate(0deg)',
          transition: 'all 300ms ease',
        }}
      >
        {from}
      </div>
      <div
        style={{
          opacity: active ? 1 : 0,
          transform: active ? 'scale(1) rotate(0deg)' : 'scale(0.5) rotate(-180deg)',
          transition: 'all 300ms ease',
        }}
      >
        {to}
      </div>
    </div>
  );
};

// ==================== ANIMATED PROGRESS ====================
export const AnimatedProgress: React.FC<{
  value: number;
  className?: string;
  barClassName?: string;
}> = ({ value, className = '', barClassName = '' }) => {
  return (
    <div className={`h-2 bg-white/10 rounded-full overflow-hidden ${className}`}>
      <div
        className={`h-full bg-gradient-to-r from-nexo-500 to-nexo-400 rounded-full transition-all duration-500 ease-out ${barClassName}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
};

// ==================== ANIMATED NUMBER ====================
export const AnimatedNumber: React.FC<{
  value: number;
  className?: string;
}> = ({ value, className = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const start = displayValue;
    const diff = value - start;
    const duration = 300;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value]);

  return (
    <span className={className}>
      {displayValue}
    </span>
  );
};

// ==================== ANIMATED TOOLTIP ====================
export const AnimatedTooltip: React.FC<{
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}> = ({ children, content, position = 'top', className = '' }) => {
  const [show, setShow] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <div
        className={`absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded-lg whitespace-nowrap pointer-events-none transition-all duration-200 ${
          show ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        } ${positionClasses[position]}`}
      >
        {content}
      </div>
    </div>
  );
};

// ==================== ANIMATED ACCORDION ====================
export const AnimatedAccordion: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}> = ({ title, children, defaultOpen = false, className = '' }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border border-white/10 rounded-xl overflow-hidden ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className="font-medium">{title}</span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="transition-transform duration-300"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: isOpen ? '500px' : '0px', opacity: isOpen ? 1 : 0 }}
      >
        <div className="p-4 pt-0">
          {children}
        </div>
      </div>
    </div>
  );
};

// ==================== ANIMATED TABS ====================
export const AnimatedTabs: React.FC<{
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
}> = ({ tabs, activeTab, onTabChange, className = '' }) => {
  const tabRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(
    () => tabs.indexOf(activeTab)
  );

  useEffect(() => {
    setActiveIndex(tabs.indexOf(activeTab));
  }, [activeTab, tabs]);

  const getTabWidth = () => {
    if (!tabRef.current) return { left: 0, width: 0 };
    const tabWidth = tabRef.current.offsetWidth / tabs.length;
    return { left: activeIndex * tabWidth, width: tabWidth };
  };

  const underline = getTabWidth();

  return (
    <div className={`relative ${className}`} ref={tabRef}>
      <div className="flex border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === tab ? 'text-white' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-nexo-500 transition-all duration-300"
        style={{ left: underline.left, width: underline.width }}
      />
    </div>
  );
};
