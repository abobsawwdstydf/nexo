import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Check, X, AlertCircle } from 'lucide-react';

interface AnimatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: string;
  hint?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  showPasswordToggle?: boolean;
  variant?: 'default' | 'glass' | 'outlined' | 'filled';
  animate?: boolean;
}

export const AnimatedInput: React.FC<AnimatedInputProps> = ({
  label,
  error,
  success,
  hint,
  icon,
  iconPosition = 'left',
  showPasswordToggle = false,
  variant = 'glass',
  animate = true,
  type = 'text',
  className = '',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasValue, setHasValue] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      setHasValue(!!inputRef.current.value);
    }
  }, [props.value, props.defaultValue]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    props.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    props.onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasValue(!!e.target.value);
    props.onChange?.(e);
  };

  const variantClasses = {
    default: 'bg-surface-secondary border border-white/10',
    glass: 'glass-input',
    outlined: 'bg-transparent border-2 border-white/20',
    filled: 'bg-white/5 border-b-2 border-white/20 rounded-t-lg rounded-b-none',
  };

  const inputType = showPasswordToggle && showPassword ? 'text' : type;

  return (
    <div className={`relative ${className}`}>
      {/* Label */}
      {label && (
        <label
          className={`
            block mb-2 text-sm font-medium
            transition-all duration-200
            ${isFocused ? 'text-nexo-400' : 'text-gray-300'}
            ${animate ? 'animate-slide-in' : ''}
          `}
        >
          {label}
        </label>
      )}

      {/* Input container */}
      <div className="relative">
        {/* Icon left */}
        {icon && iconPosition === 'left' && (
          <div
            className={`
              absolute left-3 top-1/2 -translate-y-1/2
              text-gray-400 transition-colors duration-200
              ${isFocused ? 'text-nexo-400' : ''}
            `}
          >
            {icon}
          </div>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          type={inputType}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          className={`
            w-full px-4 py-3 rounded-xl
            text-white placeholder-gray-500
            transition-all duration-300
            focus:outline-none focus:ring-2 focus:ring-nexo-500/50
            disabled:opacity-50 disabled:cursor-not-allowed
            ${variantClasses[variant]}
            ${icon && iconPosition === 'left' ? 'pl-10' : ''}
            ${icon && iconPosition === 'right' ? 'pr-10' : ''}
            ${showPasswordToggle ? 'pr-10' : ''}
            ${error ? 'border-red-500/50 focus:ring-red-500/50' : ''}
            ${success ? 'border-green-500/50 focus:ring-green-500/50' : ''}
            ${isFocused && animate ? 'scale-[1.02]' : ''}
          `}
          {...props}
        />

        {/* Icon right */}
        {icon && iconPosition === 'right' && !showPasswordToggle && (
          <div
            className={`
              absolute right-3 top-1/2 -translate-y-1/2
              text-gray-400 transition-colors duration-200
              ${isFocused ? 'text-nexo-400' : ''}
            `}
          >
            {icon}
          </div>
        )}

        {/* Password toggle */}
        {showPasswordToggle && type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="
              absolute right-3 top-1/2 -translate-y-1/2
              p-1 rounded-lg text-gray-400
              hover:text-white hover:bg-white/10
              transition-all duration-200
              active:scale-95
            "
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        )}

        {/* Success icon */}
        {success && !error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 animate-scale-in">
            <Check className="w-5 h-5" />
          </div>
        )}

        {/* Error icon */}
        {error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 animate-shake">
            <AlertCircle className="w-5 h-5" />
          </div>
        )}

        {/* Focus ring animation */}
        {isFocused && animate && (
          <div
            className="
              absolute inset-0 rounded-xl
              border-2 border-nexo-500/50
              pointer-events-none
              animate-pulse-ring
            "
          />
        )}
      </div>

      {/* Hint/Error/Success message */}
      {(hint || error || success) && (
        <div
          className={`
            mt-2 text-xs
            transition-all duration-200
            ${animate ? 'animate-slide-in' : ''}
            ${error ? 'text-red-400' : success ? 'text-green-400' : 'text-gray-400'}
          `}
        >
          {error || success || hint}
        </div>
      )}

      {/* Character count */}
      {props.maxLength && hasValue && (
        <div className="mt-1 text-xs text-gray-500 text-right">
          {inputRef.current?.value.length || 0} / {props.maxLength}
        </div>
      )}
    </div>
  );
};

// Textarea component
interface AnimatedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  success?: string;
  hint?: string;
  variant?: 'default' | 'glass' | 'outlined' | 'filled';
  animate?: boolean;
  autoResize?: boolean;
}

export const AnimatedTextarea: React.FC<AnimatedTextareaProps> = ({
  label,
  error,
  success,
  hint,
  variant = 'glass',
  animate = true,
  autoResize = false,
  className = '',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoResize && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [props.value, autoResize]);

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(true);
    props.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(false);
    props.onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (autoResize) {
      e.target.style.height = 'auto';
      e.target.style.height = `${e.target.scrollHeight}px`;
    }
    props.onChange?.(e);
  };

  const variantClasses = {
    default: 'bg-surface-secondary border border-white/10',
    glass: 'glass-input',
    outlined: 'bg-transparent border-2 border-white/20',
    filled: 'bg-white/5 border-b-2 border-white/20 rounded-t-lg rounded-b-none',
  };

  return (
    <div className={`relative ${className}`}>
      {/* Label */}
      {label && (
        <label
          className={`
            block mb-2 text-sm font-medium
            transition-all duration-200
            ${isFocused ? 'text-nexo-400' : 'text-gray-300'}
            ${animate ? 'animate-slide-in' : ''}
          `}
        >
          {label}
        </label>
      )}

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          className={`
            w-full px-4 py-3 rounded-xl
            text-white placeholder-gray-500
            transition-all duration-300
            focus:outline-none focus:ring-2 focus:ring-nexo-500/50
            disabled:opacity-50 disabled:cursor-not-allowed
            resize-none
            ${variantClasses[variant]}
            ${error ? 'border-red-500/50 focus:ring-red-500/50' : ''}
            ${success ? 'border-green-500/50 focus:ring-green-500/50' : ''}
            ${isFocused && animate ? 'scale-[1.02]' : ''}
          `}
          {...props}
        />

        {/* Focus ring animation */}
        {isFocused && animate && (
          <div
            className="
              absolute inset-0 rounded-xl
              border-2 border-nexo-500/50
              pointer-events-none
              animate-pulse-ring
            "
          />
        )}
      </div>

      {/* Hint/Error/Success message */}
      {(hint || error || success) && (
        <div
          className={`
            mt-2 text-xs
            transition-all duration-200
            ${animate ? 'animate-slide-in' : ''}
            ${error ? 'text-red-400' : success ? 'text-green-400' : 'text-gray-400'}
          `}
        >
          {error || success || hint}
        </div>
      )}

      {/* Character count */}
      {props.maxLength && (
        <div className="mt-1 text-xs text-gray-500 text-right">
          {textareaRef.current?.value.length || 0} / {props.maxLength}
        </div>
      )}
    </div>
  );
};
