import React from 'react';

// ==================== PAGE TRANSITION ====================
export const PageTransition: React.FC<{
  children: React.ReactNode;
  isVisible: boolean;
  direction?: 'left' | 'right' | 'up' | 'down' | 'fade';
  className?: string;
}> = ({ children, isVisible, direction = 'fade', className = '' }) => {
  const keyframes = {
    left: 'from { opacity: 0; transform: translateX(-100px); } to { opacity: 1; transform: translateX(0); }',
    right: 'from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); }',
    up: 'from { opacity: 0; transform: translateY(-100px); } to { opacity: 1; transform: translateY(0); }',
    down: 'from { opacity: 0; transform: translateY(100px); } to { opacity: 1; transform: translateY(0); }',
    fade: 'from { opacity: 0; } to { opacity: 1; }',
  };

  if (!isVisible) return null;

  return (
    <div
      className={className}
      style={{ animation: `pageTransition 300ms ease forwards` }}
    >
      {children}
      <style>{`
        @keyframes pageTransition {
          ${keyframes[direction]}
        }
      `}</style>
    </div>
  );
};

// ==================== SCROLL REVEAL ====================
export const ScrollReveal: React.FC<{
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  delay?: number;
  className?: string;
}> = ({ children, direction = 'up', delay = 0, className = '' }) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  const keyframes = {
    left: 'from { opacity: 0; transform: translateX(-50px); } to { opacity: 1; transform: translateX(0); }',
    right: 'from { opacity: 0; transform: translateX(50px); } to { opacity: 1; transform: translateX(0); }',
    up: 'from { opacity: 0; transform: translateY(50px); } to { opacity: 1; transform: translateY(0); }',
    down: 'from { opacity: 0; transform: translateY(-50px); } to { opacity: 1; transform: translateY(0); }',
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        animation: isVisible ? `scrollReveal 300ms ease ${delay}ms forwards` : undefined,
      }}
    >
      {children}
      <style>{`
        @keyframes scrollReveal {
          ${keyframes[direction]}
        }
      `}</style>
    </div>
  );
};

// ==================== STAGGER CHILDREN ====================
export const StaggerChildren: React.FC<{
  children: React.ReactNode;
  staggerDelay?: number;
  isVisible?: boolean;
  className?: string;
}> = ({ children, staggerDelay = 50, isVisible = true, className = '' }) => {
  const childArray = React.Children.toArray(children);

  return (
    <div className={className}>
      {childArray.map((child, index) => (
        <StaggerItem
          key={index}
          delay={index * staggerDelay}
          isVisible={isVisible}
        >
          {child}
        </StaggerItem>
      ))}
    </div>
  );
};

const StaggerItem: React.FC<{
  children: React.ReactNode;
  delay: number;
  isVisible: boolean;
}> = ({ children, delay, isVisible }) => {
  return (
    <div
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: `all 300ms ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

// ==================== ANIMATED LIST ====================
export const AnimatedList: React.FC<{
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  keyExtractor: (item: any) => string;
  staggerDelay?: number;
  className?: string;
}> = ({ items, renderItem, keyExtractor, staggerDelay = 50, className = '' }) => {
  return (
    <div className={className}>
      {items.map((item, index) => (
        <ScrollReveal key={keyExtractor(item)} delay={index * staggerDelay}>
          {renderItem(item, index)}
        </ScrollReveal>
      ))}
    </div>
  );
};

// ==================== ANIMATED MODAL ====================
export const AnimatedModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ isOpen, onClose, children, className = '' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />
      <div
        className={`relative z-10 max-w-lg w-full mx-4 animate-scaleIn ${className}`}
      >
        {children}
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

// ==================== ANIMATED TOAST ====================
export const AnimatedToast: React.FC<{
  isVisible: boolean;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
  className?: string;
}> = ({ isVisible, message, type = 'info', onClose, className = '' }) => {
  const typeClasses = {
    success: 'bg-green-500/10 border-green-500/30 text-green-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    info: 'bg-nexo-500/10 border-nexo-500/30 text-nexo-400',
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm w-full p-4 rounded-xl border backdrop-blur-lg transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-5 scale-95'
      } ${typeClasses[type]} ${className}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{message}</p>
        <button
          onClick={onClose}
          className="ml-4 text-current opacity-60 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
};
