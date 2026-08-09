import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical } from 'lucide-react';
import { DevLoginButton } from './DevLoginButton';
import { useAuthStore } from '../stores/authStore';
import { isDevLocal } from '../lib/devMode';

/** Плавающая dev-кнопка: видна только на localhost, на любом экране (Auth, Messenger). */
export function DevFab() {
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  if (!isDevLocal()) return null;

  return (
    <>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        title={open ? 'Закрыть dev-панель' : 'Dev-панель'}
        className="fixed bottom-4 right-4 z-[70] w-11 h-11 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/25 flex items-center justify-center text-emerald-300 shadow-xl backdrop-blur-md transition-all"
      >
        <FlaskConical size={18} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-16 right-4 z-[70] w-56 p-4 rounded-2xl liquid-glass-strong border border-white/[0.08] shadow-2xl"
          >
            <div className="text-xs font-semibold text-white/70 mb-2">Dev-режим</div>
            {user ? (
              <div className="text-xs text-white/50 mb-2">
                Вошёл как <span className="text-emerald-300">@{user.username}</span>
              </div>
            ) : null}
            {!user && <DevLoginButton />}
            {user && (
              <button
                onClick={() => setOpen(false)}
                className="w-full text-[11px] text-white/40 hover:text-white/70 transition-colors"
              >
                — скрыть панель
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}