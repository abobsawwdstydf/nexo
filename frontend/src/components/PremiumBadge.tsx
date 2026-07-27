import { motion } from 'framer-motion';
import { Crown, Sparkles, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useNavigationStore } from '../stores/navigationStore';

interface PremiumBadgeProps {
  variant?: 'sidebar' | 'inline';
  className?: string;
}

export default function PremiumBadge({ variant = 'sidebar', className = '' }: PremiumBadgeProps) {
  const { user } = useAuthStore();
  const { navigateTo } = useNavigationStore();

  const isPremium = user?.premiumUntil && new Date(user.premiumUntil) > new Date();

  if (isPremium) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-orange-500/5 to-yellow-600/10 p-3 ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-yellow-500/20">
            <Crown size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-yellow-400">Нексо НУче</p>
            <p className="text-[10px] text-yellow-500/60">Активна</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigateTo('settings')}
      className={`w-full relative overflow-hidden rounded-2xl border border-[var(--color-accent)]/20 bg-gradient-to-br from-[var(--color-accent)]/10 via-[var(--color-accent-secondary)]/5 to-[var(--color-accent)]/10 p-3 text-left transition-all hover:border-[var(--color-accent)]/40 hover:shadow-lg hover:shadow-[var(--color-accent)]/10 ${className}`}
    >
      {/* Glow effect */}
      <div className="absolute -top-8 -right-8 w-24 h-24 bg-[var(--color-accent)]/10 rounded-full blur-2xl" />

      <div className="relative flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-secondary)] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[var(--color-accent)]/20">
          <Sparkles size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-[var(--color-text-primary)]">НуЧе</p>
          <p className="text-[10px] text-[var(--color-text-secondary)]">Разблокируй все</p>
        </div>
        <ArrowRight size={14} className="text-[var(--color-accent)] flex-shrink-0" />
      </div>
    </motion.button>
  );
}
