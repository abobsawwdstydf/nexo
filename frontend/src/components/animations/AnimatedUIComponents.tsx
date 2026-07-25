import React, { useState, useCallback } from 'react';
import { cn } from '../../lib/utils';

// ==================== ANIMATED ICON BUTTON ====================
export const AnimatedIconButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  tooltip?: string;
}> = ({
  children,
  onClick,
  variant = 'ghost',
  size = 'md',
  className = '',
  disabled = false,
  tooltip,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const variantClasses = {
    primary: 'bg-nexo-500 text-white hover:bg-nexo-400',
    secondary: 'bg-white/10 text-white hover:bg-white/20',
    ghost: 'bg-transparent text-gray-300 hover:bg-white/10 hover:text-white',
    danger: 'bg-red-500/10 text-red-400 hover:bg-red-500/20',
  };

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return (
    <button
      className={cn(
        'relative overflow-hidden rounded-xl flex items-center justify-center transition-all duration-200',
        variantClasses[variant],
        sizeClasses[size],
        disabled && 'opacity-50 cursor-not-allowed',
        isPressed ? 'scale-90 rotate-2' : isHovered ? 'scale-110 rotate-1' : 'scale-100 rotate-0',
        className
      )}
      onClick={(e) => {
        if (!disabled) {
          onClick?.();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      disabled={disabled}
      title={tooltip}
    >
      {children}
    </button>
  );
};

// ==================== ANIMATED CARD ====================
export const AnimatedCard: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  hoverEffect?: 'scale' | 'tilt' | 'glow' | 'none';
}> = ({
  children,
  onClick,
  className = '',
  hoverEffect = 'scale',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (hoverEffect !== 'tilt') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    setMousePosition({
      x: ((x - centerX) / centerX) * 10,
      y: ((y - centerY) / centerY) * -10,
    });
  }, [hoverEffect]);

  const style: React.CSSProperties = {
    transform: isHovered
      ? hoverEffect === 'scale'
        ? 'scale(1.02)'
        : hoverEffect === 'tilt'
          ? `perspective(600px) rotateX(${mousePosition.y}deg) rotateY(${mousePosition.x}deg)`
          : undefined
      : undefined,
    boxShadow: isHovered && hoverEffect === 'glow'
      ? '0 0 30px rgba(123, 97, 255, 0.3)'
      : '0 4px 6px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.3s ease',
  };

  return (
    <div
      style={style}
      className={cn(
        'rounded-2xl bg-surface-secondary border border-white/[0.08] overflow-hidden',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setMousePosition({ x: 0, y: 0 });
      }}
      onMouseMove={handleMouseMove}
    >
      {children}
    </div>
  );
};

// ==================== ANIMATED BADGE ====================
export const AnimatedBadge: React.FC<{
  count?: number;
  dot?: boolean;
  className?: string;
  pulse?: boolean;
}> = ({ count, dot = false, className = '', pulse = true }) => {
  const [displayCount, setDisplayCount] = useState(count ?? 0);

  React.useEffect(() => {
    if (count && count > 0) {
      setDisplayCount(count);
    }
  }, [count]);

  if (dot) {
    return (
      <div
        className={cn(
          'w-2.5 h-2.5 rounded-full bg-nexo-500',
          pulse && 'animate-pulse',
          className
        )}
      />
    );
  }

  if (displayCount === 0) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5',
        'text-xs font-medium rounded-full bg-nexo-500 text-white',
        className
      )}
    >
      {displayCount > 99 ? '99+' : displayCount}
    </span>
  );
};

// ==================== ANIMATED TOGGLE ====================
export const AnimatedToggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ checked, onChange, disabled = false, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-4',
    md: 'w-10 h-5',
    lg: 'w-12 h-6',
  };

  const thumbSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const thumbTranslate = {
    sm: checked ? '16px' : '2px',
    md: checked ? '20px' : '2px',
    lg: checked ? '24px' : '2px',
  };

  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex items-center rounded-full transition-colors duration-300',
        sizeClasses[size],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      style={{ backgroundColor: checked ? '#7B61FF' : '#374151' }}
    >
      <div
        className={cn(
          'absolute left-0.5 rounded-full bg-white shadow-sm transition-all duration-300',
          thumbSizeClasses[size],
          checked ? 'scale-100' : 'scale-80'
        )}
        style={{ transform: `translateX(${thumbTranslate[size]})` }}
      />
    </button>
  );
};

// ==================== ANIMATED INPUT ====================
export const AnimatedInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}> = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  icon,
  className = '',
  disabled = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      className={cn(
        'relative flex items-center rounded-xl border bg-white/5 px-4 py-2 transition-all duration-300',
        disabled && 'opacity-50 cursor-not-allowed',
        isFocused ? 'border-nexo-500 shadow-[0_0_0_3px_rgba(123,97,255,0.1)]' : 'border-white/10',
        className
      )}
    >
      {icon && <span className="mr-2 text-gray-400">{icon}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 bg-transparent outline-none text-white placeholder-gray-400"
      />
    </div>
  );
};

// ==================== ANIMATED SKELETON ====================
export const AnimatedSkeleton: React.FC<{
  width?: string | number;
  height?: string | number;
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}> = ({ width, height, className = '', variant = 'text' }) => {
  const variantClasses = {
    text: 'rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      className={cn(
        'bg-white/10 animate-pulse',
        variantClasses[variant],
        className
      )}
      style={{ width, height }}
    />
  );
};

// ==================== ANIMATED LOADING DOTS ====================
export const AnimatedLoadingDots: React.FC<{
  size?: number;
  color?: string;
  className?: string;
}> = ({ size = 8, color = '#7B61FF', className = '' }) => {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-full animate-bounce"
          style={{
            width: size,
            height: size,
            backgroundColor: color,
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
};
