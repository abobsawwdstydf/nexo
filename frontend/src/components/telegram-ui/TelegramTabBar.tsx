import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { NotificationBadge } from '../transitions/NotificationBadge';

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
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, top: 0, height: 0 });

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    const selectedItem = itemRefs.current.get(selectedId);
    if (!container || !selectedItem) return;

    const containerRect = container.getBoundingClientRect();
    const itemRect = selectedItem.getBoundingClientRect();

    setIndicatorStyle({
      left: itemRect.left - containerRect.left,
      top: itemRect.top - containerRect.top,
      width: itemRect.width,
      height: itemRect.height,
    });
  }, [selectedId]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[60] sm:hidden pb-[env(safe-area-inset-bottom)]`}>
      <div className="px-4 pb-2">
        {/* Outer glow */}
        <div className="absolute inset-x-4 -bottom-4 h-12 bg-nexo-500/10 rounded-[99rem] blur-2xl pointer-events-none" />

        {/* Glass menu container */}
        <div
          ref={containerRef}
          className={`relative rounded-full border border-white/[0.12] shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden select-none touch-none ${className}`}
          style={{
            backdropFilter: 'blur(16px) saturate(180%) contrast(200%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%) contrast(200%)',
            background: 'linear-gradient(135deg, rgba(18, 18, 24, 0.85) 0%, rgba(123, 97, 255, 0.15) 50%, rgba(18, 18, 24, 0.88) 100%)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Inner glass highlight */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{
              boxShadow: 'inset 2px 2px 8px -2px rgba(255, 255, 255, 0.15), inset -2px -2px 8px 2px rgba(255, 255, 255, 0.05)',
            }}
          />

          {/* Sliding indicator */}
          <motion.div
            className="absolute rounded-full z-0"
            animate={{
              left: indicatorStyle.left,
              top: indicatorStyle.top,
              width: indicatorStyle.width,
              height: indicatorStyle.height,
            }}
            transition={{
              type: 'spring',
              stiffness: 350,
              damping: 30,
              mass: 0.8,
            }}
            style={{
              background: 'rgba(123, 97, 255, 0.3)',
              boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.3), 0 8px 24px rgba(0, 0, 0, 0.18)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(123, 97, 255, 0.4)',
            }}
          >
            {/* Top accent glow */}
            <div
              className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full"
              style={{
                background: '#7B61FF',
                boxShadow: '0 0 20px rgba(123, 97, 255, 0.6)',
              }}
            />
          </motion.div>

          {/* Items */}
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
                  className="relative flex flex-col items-center justify-center gap-[2px] w-[52px] h-[46px] rounded-full z-10 transition-all duration-300"
                  style={{
                    color: item.accent
                      ? '#9b7dff'
                      : isActive
                        ? '#ffffff'
                        : 'rgba(255, 255, 255, 0.5)',
                  }}
                >
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
                      className="transition-colors duration-300"
                    />
                  </motion.div>

                  {/* Badge */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <NotificationBadge
                      count={item.badge}
                      className="-top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] flex items-center justify-center shadow-[0_0_0_2px_#0e1621] text-[10px] font-bold text-white leading-none"
                    />
                  )}

                  <span
                    className="relative text-[10px] font-semibold transition-colors duration-300 leading-none"
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
