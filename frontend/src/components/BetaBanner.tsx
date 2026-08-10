import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface BetaBannerProps {
  daysLeft: number;
  message: string;
}

export function BetaBanner({ daysLeft, message }: BetaBannerProps) {
  return (
    <motion.div
      initial={{ y: -28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -28, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed top-0 inset-x-0 z-[100] pointer-events-none"
    >
      <div className="bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border-b border-amber-500/20 px-3 py-1 backdrop-blur-xl">
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-amber-300/90 flex-wrap">
          <AlertTriangle size={9} className="shrink-0" />
          <span>{message}</span>
          <span className="text-amber-500/50">•</span>
          <span className="text-amber-200/90 font-medium">
            Бета: осталось {daysLeft} {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}