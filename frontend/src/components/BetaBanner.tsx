import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface BetaBannerProps {
  daysLeft: number;
  contactTg: string;
  contactTt: string;
  message: string;
}

export function BetaBanner({ daysLeft, contactTg, contactTt, message }: BetaBannerProps) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border-b border-amber-500/20 px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-amber-400 flex-wrap">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{message}</span>
          <span className="text-amber-500/60">|</span>
          <span className="text-amber-500/80">
            Бета: {daysLeft} {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
