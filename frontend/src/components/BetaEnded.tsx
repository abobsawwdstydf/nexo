import { motion } from 'framer-motion';
import { ShieldX } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export function BetaEnded() {
  const logout = useAuthStore((s) => s.logout);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full flex flex-col items-center justify-center gap-6 p-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        <ShieldX size={80} className="text-amber-500/60" />
      </motion.div>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center space-y-3"
      >
        <h1 className="text-2xl font-bold text-amber-400">Бета закончена</h1>
        <p className="text-gray-400 max-w-md">
          Ждите официального релиза
        </p>
      </motion.div>
      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        onClick={logout}
        className="px-6 py-2 rounded-lg bg-glass border border-glass-border text-gray-300 hover:text-white transition-colors"
      >
        Выйти
      </motion.button>
    </motion.div>
  );
}
