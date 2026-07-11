import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode, useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Check, AlertCircle, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: string;
  hint?: string;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  showPasswordToggle?: boolean;
  variant?: 'default' | 'glass' | 'outlined';
  containerClassName?: string;
}

const variantClasses = {
  default: 'bg-white/[0.04] border border-white/[0.08] focus:border-nexo-500/50 focus:bg-white/[0.06]',
  glass: 'glass-input',
  outlined: 'bg-transparent border-2 border-white/[0.15] focus:border-nexo-500/60',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      success,
      hint,
      icon,
      iconPosition = 'left',
      showPasswordToggle = false,
      variant = 'default',
      type = 'text',
      className,
      containerClassName,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputType = showPasswordToggle && showPassword ? 'text' : type;

    return (
      <div className={cn('w-full', containerClassName)}>
        {label && (
          <label className="block mb-1.5 text-xs font-medium text-zinc-300">
            {label}
          </label>
        )}

      <div className="relative">
        {icon && (
          <div className={cn(
            'absolute top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none',
            iconPosition === 'left' ? 'left-3' : 'right-3'
          )}>
            {icon}
          </div>
        )}

          <input
            ref={ref}
            type={inputType}
            className={cn(
              'w-full rounded-xl text-sm text-white placeholder-zinc-500',
              'px-3.5 py-2.5',
              'transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-nexo-500/20',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              variantClasses[variant],
              icon && iconPosition === 'left' && 'pl-10',
              ((icon && iconPosition === 'right') || showPasswordToggle || success || error) ? 'pr-10' : false,
              error && 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/20',
              success && 'border-green-500/50 focus:border-green-500/70 focus:ring-green-500/20',
              className
            )}
            {...props}
          />

          {icon && iconPosition === 'right' && !showPasswordToggle && !success && !error && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none [&_svg]:w-4 [&_svg]:h-4">
              {icon}
            </div>
          )}

          {showPasswordToggle && type === 'password' && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 transition-colors [&_svg]:w-4 [&_svg]:h-4"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          )}

          {success && !error && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" />
          )}

          {error && (
            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400 pointer-events-none" />
          )}
        </div>

        {(hint || error || success) && (
          <p
            className={cn(
              'mt-1.5 text-xs',
              error ? 'text-red-400' : success ? 'text-green-400' : 'text-zinc-500'
            )}
          >
            {error || success || hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  autoResize?: boolean;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, autoResize = false, className, containerClassName, onChange, ...props }, ref) => {
    const taRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
      if (autoResize && taRef.current) {
        taRef.current.style.height = 'auto';
        taRef.current.style.height = `${taRef.current.scrollHeight}px`;
      }
    }, [props.value, autoResize]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoResize) {
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
      }
      onChange?.(e);
    };

    return (
      <div className={cn('w-full', containerClassName)}>
        {label && (
          <label className="block mb-1.5 text-xs font-medium text-zinc-300">{label}</label>
        )}
        <textarea
          ref={(node) => {
            taRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          onChange={handleChange}
          className={cn(
            'w-full rounded-xl text-sm text-white placeholder-zinc-500 px-3.5 py-2.5',
            'bg-white/[0.04] border border-white/[0.08] focus:border-nexo-500/50 focus:bg-white/[0.06]',
            'transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-nexo-500/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            autoResize ? 'resize-none overflow-hidden' : 'resize-y',
            error && 'border-red-500/50 focus:border-red-500/70',
            className
          )}
          {...props}
        />
        {(error || hint) && (
          <p className={cn('mt-1.5 text-xs', error ? 'text-red-400' : 'text-zinc-500')}>
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export const SearchInput = forwardRef<HTMLInputElement, Omit<InputProps, 'icon'>>(
  (props, ref) => <Input ref={ref} icon={<Search />} {...props} />
);
SearchInput.displayName = 'SearchInput';
