import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  accent?: boolean;
}

interface TelegramTabBarProps {
  items: TabItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}

function TelegramTabBar({ items, selectedId, onSelect, className = '' }: TelegramTabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    const selectedItem = itemRefs.current.get(selectedId);
    if (!container || !selectedItem) return;

    const containerRect = container.getBoundingClientRect();
    const itemRect = selectedItem.getBoundingClientRect();

    setIndicatorStyle({
      left: itemRect.left - containerRect.left,
      width: itemRect.width,
    });
  }, [selectedId]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    // Create ripple effect
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      setRipple({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        id: Date.now(),
      });
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;

    const container = containerRef.current;
    if (!container) return;

    const x = e.clientX;
    for (const [id, el] of itemRefs.current) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right) {
        onSelect(id);
        break;
      }
    }
  }, [isDragging, onSelect]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Clear ripple after animation
  useEffect(() => {
    if (ripple) {
      const timeout = setTimeout(() => setRipple(null), 600);
      return () => clearTimeout(timeout);
    }
  }, [ripple]);

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[60] sm:hidden pb-[env(safe-area-inset-bottom)]`}>
      <div className="mx-4 mb-2">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative rounded-[20px] liquid-glass border border-white/[0.12] shadow-[0_4px_24px_0_rgba(0,0,0,0.7)] overflow-hidden select-none touch-none ${className}`}
        >
          {/* Top highlight edge — Telegram style */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent z-10" />

          {/* Bottom subtle glow */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent z-10" />

          {/* Liquid lens indicator — Telegram style with glow */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 h-[40px] rounded-[14px] z-0"
            animate={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
            }}
            transition={{
              type: 'spring',
              stiffness: 350,
              damping: 30,
              mass: 0.8,
            }}
          >
            {/* Base indicator */}
            <div className="w-full h-full rounded-[14px] bg-white/[0.1] border border-white/[0.08]" />
            {/* Inner glow */}
            <div className="absolute inset-0 rounded-[14px] bg-gradient-to-b from-white/[0.06] to-transparent" />
            {/* Top highlight */}
            <div className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </motion.div>

          {/* Ripple effect on touch */}
          {ripple && (
            <motion.div
              key={ripple.id}
              className="absolute w-[60px] h-[60px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.06] pointer-events-none z-0"
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ left: ripple.x, top: ripple.y }}
            />
          )}

          <div className="relative flex items-center justify-around px-1.5 py-[6px]">
            {items.map((item) => {
              const isActive = selectedId === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    if (el) itemRefs.current.set(item.id, el);
                    else itemRefs.current.delete(item.id);
                  }}
                  onClick={() => onSelect(item.id)}
                  className="relative flex flex-col items-center justify-center gap-[2px] w-[52px] h-[46px] rounded-[14px] z-10 transition-colors duration-150"
                >
                  <div className="relative">
                    <motion.div
                      animate={{
                        scale: isActive ? 1.1 : 1,
                        y: isActive ? -1 : 0,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 25,
                      }}
                    >
                      <Icon
                        size={22}
                        strokeWidth={isActive ? 2.2 : 1.6}
                        className={`transition-colors duration-200 ${
                          item.accent
                            ? 'text-[#6ab2f2]'
                            : isActive
                              ? 'text-white'
                              : 'text-white/40'
                        }`}
                      />
                    </motion.div>

                    {/* Badge — Telegram style */}
                    {item.badge !== undefined && item.badge > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] flex items-center justify-center shadow-[0_0_0_2px_#0e1621]"
                      >
                        <span className="text-[10px] font-bold text-white leading-none">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      </motion.div>
                    )}
                  </div>

                  <span
                    className={`relative text-[10px] font-semibold transition-colors duration-200 leading-none ${
                      item.accent
                        ? 'text-[#6ab2f2]'
                        : isActive
                          ? 'text-white'
                          : 'text-white/40'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(TelegramTabBar);
