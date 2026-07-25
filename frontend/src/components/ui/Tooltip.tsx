import { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'center' | 'start' | 'end';
  delay?: number;
  className?: string;
}

const sideClasses = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delay = 300,
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={cn(
            'absolute z-[70] pointer-events-none',
            'px-2.5 py-1 rounded-md text-xs font-medium text-white whitespace-nowrap',
            'bg-zinc-800 border border-white/[0.1] shadow-xl',
            'animate-fade-in',
            sideClasses[side],
            className
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
