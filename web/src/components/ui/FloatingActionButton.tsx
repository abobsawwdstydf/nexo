import { useState, useRef, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface FabAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  color?: string;
}

interface FloatingActionButtonProps {
  icon?: ReactNode;
  actions?: FabAction[];
  onClick?: () => void;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function FloatingActionButton({
  icon,
  actions,
  onClick,
  position = 'bottom-right',
  color = '#6366f1',
  size = 'md',
  className = '',
}: FloatingActionButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const fabRef = useRef<HTMLDivElement>(null);
  const hasMenu = actions && actions.length > 0;

  // Close menu on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  const handleClick = (e: React.MouseEvent) => {
    // Ripple
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples((prev) => [...prev, { x, y, id }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);

    if (hasMenu) {
      setExpanded((prev) => !prev);
    } else {
      onClick?.();
    }
  };

  const handleActionClick = (action: FabAction) => {
    action.onClick();
    setExpanded(false);
  };

  const sizeMap = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
  };

  const iconSizeMap = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
  };

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
  };

  const actionSizeMap = {
    sm: 'w-10 h-10',
    md: 'w-11 h-11',
    lg: 'w-12 h-12',
  };

  return (
    <div ref={fabRef} className={`fixed z-50 ${positionClasses[position]} ${className}`}>
      {/* Action buttons */}
      <AnimatePresence>
        {expanded && hasMenu && (
          <div className="absolute bottom-full mb-3 flex flex-col-reverse items-center gap-3">
            {actions!.map((action, i) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, scale: 0.3, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.3, y: 20 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 500, damping: 25 }}
                className="flex items-center gap-2"
              >
                {/* Label */}
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: i * 0.05 + 0.1 }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
                    bg-[#1a1a2e]/90 backdrop-blur-xl text-white border border-white/10 shadow-xl"
                >
                  {action.label}
                </motion.span>

                {/* Action button */}
                <button
                  onClick={() => handleActionClick(action)}
                  className={`
                    ${actionSizeMap[size]} rounded-full
                    flex items-center justify-center
                    bg-[#1a1a2e]/90 backdrop-blur-xl
                    border border-white/10 shadow-xl
                    hover:scale-110 active:scale-95
                    transition-transform duration-200
                    text-white/80 hover:text-white
                  `}
                  style={{
                    boxShadow: `0 4px 20px ${action.color || color}30`,
                  }}
                >
                  {action.icon}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        onClick={handleClick}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={expanded ? { rotate: 45 } : { rotate: 0 }}
        className={`
          ${sizeMap[size]} rounded-full
          flex items-center justify-center
          relative overflow-hidden
          border border-white/20
          transition-shadow duration-300
          hover:shadow-2xl
        `}
        style={{
          background: `linear-gradient(135deg, ${color}, ${color}cc)`,
          boxShadow: `0 8px 32px ${color}50, 0 2px 8px ${color}30`,
        }}
      >
        {/* Ripple effects */}
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

        {/* Icon */}
        <span className={`relative z-10 ${iconSizeMap[size]} text-white`}>
          {icon || (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </span>

        {/* Shine effect */}
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-700" />

        {/* Pulse ring when expanded */}
        {expanded && (
          <motion.div
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 1, repeat: Infinity }}
            className="absolute inset-0 rounded-full border-2 border-white/30"
          />
        )}
      </motion.button>
    </div>
  );
}
