import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'nexo_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) {
      // small delay so it doesn't pop immediately on mount
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'declined');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-[380px] z-[9999]"
        >
          <div className="relative rounded-2xl liquid-glass-strong border border-white/[0.06] p-5 shadow-2xl">
            <button
              onClick={decline}
              className="absolute top-3 right-3 text-white/20 hover:text-white/50 transition-colors"
            >
              <X size={16} />
            </button>

            <Cookie size={22} className="text-white/40 mb-3" />

            <p className="text-xs text-white/70 leading-relaxed mb-4" style={{ fontFamily: "'Onest', system-ui, -apple-system, sans-serif" }}>
              Мы используем cookie и аналогичные технологии для обеспечения работы сервиса.
              Продолжая использовать «Нексо», вы соглашаетесь с обработкой данных.
            </p>

            <div className="flex items-center gap-2.5">
              <motion.button
                onClick={accept}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/14 border border-white/[0.08] text-white/80 text-xs font-medium transition-colors"
                style={{ fontFamily: "'Onest', system-ui, -apple-system, sans-serif" }}
              >
                Принять
              </motion.button>
              <motion.button
                onClick={decline}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2.5 rounded-xl text-white/30 hover:text-white/50 text-xs transition-colors"
                style={{ fontFamily: "'Onest', system-ui, -apple-system, sans-serif" }}
              >
                Отклонить
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
