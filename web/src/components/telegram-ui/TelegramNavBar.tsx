import { useState, useRef, useCallback, useEffect, memo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, MoreVertical, Search, X } from 'lucide-react';

interface NavButton {
  icon?: ReactNode;
  label?: string;
  onClick?: () => void;
  show?: boolean;
}

interface TelegramNavBarProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  leftButton?: NavButton;
  rightButtons?: NavButton[];
  children?: ReactNode;
  className?: string;
  transparent?: boolean;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
}

function TelegramNavBar({
  title,
  subtitle,
  showBack = false,
  onBack,
  leftButton,
  rightButtons = [],
  children,
  className = '',
  transparent = false,
  onSearch,
  searchPlaceholder = 'Поиск',
}: TelegramNavBarProps) {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchActive && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchActive]);

  const handleSearchToggle = useCallback(() => {
    setIsSearchActive((prev) => {
      if (prev) {
        setSearchQuery('');
        onSearch?.('');
      }
      return !prev;
    });
  }, [onSearch]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      onSearch?.(value);
    },
    [onSearch]
  );

  const handleSearchClose = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery('');
    onSearch?.('');
  }, [onSearch]);

  return (
    <div
      className={`relative flex-shrink-0 ${
        transparent ? '' : 'glass-strong'
      } ${className}`}
    >
      {/* Edge effect - top highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <AnimatePresence mode="wait">
        {isSearchActive ? (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 px-3 py-2.5"
          >
            <button
              onClick={handleSearchClose}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors"
            >
              <ChevronLeft size={20} className="text-white/70" />
            </button>
            <div className="flex-1 relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={searchPlaceholder}
                className="w-full h-9 px-3 pr-8 rounded-full bg-white/[0.08] border border-white/[0.06] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[var(--color-accent)]/50 focus:bg-white/[0.12] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    onSearch?.('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center"
                >
                  <X size={12} className="text-white/70" />
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1 px-2 py-2.5"
          >
            {/* Left button area */}
            <div className="flex items-center gap-0.5">
              {showBack && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onBack}
                  className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft size={22} className="text-white/80" />
                </motion.button>
              )}
              {leftButton?.show !== false && leftButton && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={leftButton.onClick}
                  className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/10 transition-colors"
                >
                  {leftButton.icon || (
                    <span className="text-[var(--color-accent)] text-[15px] font-semibold">
                      {leftButton.label}
                    </span>
                  )}
                </motion.button>
              )}
            </div>

            {/* Title */}
            <div className="flex-1 min-w-0 px-1">
              <motion.h1
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[17px] font-semibold text-white truncate leading-tight"
              >
                {title}
              </motion.h1>
              {subtitle && (
                <p className="text-[12px] text-white/40 truncate leading-tight mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Right buttons */}
            <div className="flex items-center gap-0.5">
              {onSearch && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleSearchToggle}
                  className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/10 transition-colors"
                >
                  <Search size={19} className="text-white/70" />
                </motion.button>
              )}
              {rightButtons
                .filter((btn) => btn.show !== false)
                .map((btn, i) => (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.9 }}
                    onClick={btn.onClick}
                    className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/10 transition-colors"
                  >
                    {btn.icon || (
                      <span className="text-[var(--color-accent)] text-[15px] font-semibold">
                        {btn.label}
                      </span>
                    )}
                  </motion.button>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {children}
    </div>
  );
}

export default memo(TelegramNavBar);
