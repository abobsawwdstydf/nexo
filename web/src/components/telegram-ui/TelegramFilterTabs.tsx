import { useState, useRef, useCallback, useEffect, memo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Filter } from 'lucide-react';

interface FilterTab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number;
}

interface TelegramFilterTabsProps {
  tabs: FilterTab[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}

function TelegramFilterTabs({ tabs, selectedId, onSelect, className = '' }: TelegramFilterTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const updateIndicator = useCallback(() => {
    const container = scrollRef.current;
    const selectedTab = tabRefs.current.get(selectedId);
    if (!container || !selectedTab) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = selectedTab.getBoundingClientRect();

    setIndicatorStyle({
      left: tabRect.left - containerRect.left + container.scrollLeft,
      width: tabRect.width,
    });
  }, [selectedId]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    const selectedTab = tabRefs.current.get(selectedId);
    if (selectedTab && scrollRef.current) {
      const container = scrollRef.current;
      const tabRect = selectedTab.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const scrollLeft =
        tabRect.left - containerRect.left + container.scrollLeft - containerRect.width / 2 + tabRect.width / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [selectedId]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollRef}
        className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-4 py-1.5"
      >
        {/* Selection indicator */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 h-[32px] rounded-full bg-white/[0.1] border border-white/[0.06]"
          animate={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 28,
          }}
        />

        {tabs.map((tab) => {
          const isActive = selectedId === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              onClick={() => onSelect(tab.id)}
              className="relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full whitespace-nowrap z-10 transition-colors"
            >
              {tab.icon && (
                <span className={`text-[13px] ${isActive ? 'text-white' : 'text-white/40'}`}>
                  {tab.icon}
                </span>
              )}
              <span
                className={`text-[13px] font-medium transition-colors ${
                  isActive ? 'text-white' : 'text-white/50'
                }`}
              >
                {tab.label}
              </span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-accent)] flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white leading-none">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(TelegramFilterTabs);
