import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  ripple?: boolean;
  glow?: boolean;
  children: React.ReactNode;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  ripple = true,
  glow = false,
  children,
  className = '',
  disabled,
  onClick,
  ...props
}) => {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (ripple && !disabled && !loading) {
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();

      setRipples((prev) => [...prev, { x, y, id }]);

      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 600);
    }

    if (onClick && !disabled && !loading) {
      onClick(e);
    }
  };

  const variantClasses = {
    primary: `
      bg-gradient-to-r from-nexo-500 to-nexo-600
      hover:from-nexo-400 hover:to-nexo-500
      text-white shadow-lg shadow-nexo-500/30
      hover:shadow-xl hover:shadow-nexo-500/40
    `,
    secondary: `
      glass-btn text-white
      hover:bg-white/10
    `,
    ghost: `
      bg-transparent text-gray-300
      hover:bg-white/5 hover:text-white
    `,
    danger: `
      bg-gradient-to-r from-red-500 to-red-600
      hover:from-red-400 hover:to-red-500
      text-white shadow-lg shadow-red-500/30
      hover:shadow-xl hover:shadow-red-500/40
    `,
    success: `
      bg-gradient-to-r from-green-500 to-green-600
      hover:from-green-400 hover:to-green-500
      text-white shadow-lg shadow-green-500/30
      hover:shadow-xl hover:shadow-green-500/40
    `,
    glass: `
      glass-strong text-white
      hover:bg-white/10
    `,
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`
        relative overflow-hidden
        inline-flex items-center justify-center gap-2
        rounded-xl font-medium
        transition-all duration-300 ease-out
        transform hover:-translate-y-0.5 active:translate-y-0
        disabled:opacity-50 disabled:cursor-not-allowed
        disabled:hover:translate-y-0
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${glow ? 'hover-glow' : ''}
        ${className}
      `}
      {...props}
    >
      {/* Ripple effect */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-white/30 pointer-events-none animate-ping"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 10,
            height: 10,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}

      {/* Loading spinner */}
      {loading && (
        <Loader2 className={`${iconSizeClasses[size]} animate-spin`} />
      )}

      {/* Icon left */}
      {!loading && icon && iconPosition === 'left' && (
        <span className={`${iconSizeClasses[size]} transition-transform group-hover:scale-110`}>
          {icon}
        </span>
      )}

      {/* Text */}
      <span className="relative z-10">{children}</span>

      {/* Icon right */}
      {!loading && icon && iconPosition === 'right' && (
        <span className={`${iconSizeClasses[size]} transition-transform group-hover:scale-110`}>
          {icon}
        </span>
      )}

      {/* Shine effect */}
      <span
        className="
          absolute inset-0 -translate-x-full
          bg-gradient-to-r from-transparent via-white/20 to-transparent
          group-hover:translate-x-full
          transition-transform duration-700 ease-out
        "
      />
    </button>
  );
};
