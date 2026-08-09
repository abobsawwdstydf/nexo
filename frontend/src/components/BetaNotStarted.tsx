import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { DevLoginButton } from './DevLoginButton';
import { isDevLocal } from '../lib/devMode';

interface BetaNotStartedProps {
  startTime: string;
  message?: string;
  onTeamLogin?: () => void;
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function BetaNotStarted({ startTime, message, onTeamLogin }: BetaNotStartedProps) {
  const target = useMemo(() => {
    const t = new Date(startTime);
    return isNaN(t.getTime()) ? new Date('2026-08-06T06:00:00+03:00') : t;
  }, [startTime]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, target.getTime() - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.05, 0.09, 0.05] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[15%] -left-[10%] w-[500px] h-[500px] rounded-full bg-white blur-[140px]"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.04, 0.07, 0.04] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          className="absolute bottom-[20%] -right-[5%] w-[400px] h-[400px] rounded-full bg-zinc-400 blur-[120px]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="relative flex flex-col items-center text-center max-w-sm"
      >
        <img
          src="/logo.png"
          alt="Нексо"
          className="w-20 h-20 rounded-3xl object-cover shadow-2xl mb-6"
          draggable={false}
        />
        <h1 className="text-2xl font-bold text-white/95 tracking-wide mb-2">Нексо</h1>
        <p className="text-sm text-white/50 leading-relaxed mb-8">
          {message || 'Нексо откроется 6 августа в 6:00 (МСК)'}
        </p>

        <div className="flex items-center gap-2 font-mono">
          {[
            { v: days, label: 'дней' },
            { v: hours, label: 'часов' },
            { v: minutes, label: 'минут' },
            { v: seconds, label: 'секунд' },
          ].map(({ v, label }, i) => (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <span className="text-white/30 text-xl pb-5">:</span>}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.06] border border-white/[0.08] backdrop-blur-xl flex items-center justify-center">
                  <span className="text-2xl font-bold text-white/90 tabular-nums">{pad(v)}</span>
                </div>
                <span className="text-[11px] text-white/35 mt-1.5">{label}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[12px] text-white/30 mt-8">
          {plural(days, 'день', 'дня', 'дней')} до открытия
        </p>

        {onTeamLogin && (
          <button
            onClick={onTeamLogin}
            className="mt-6 text-[12px] text-white/25 hover:text-white/60 transition-colors underline underline-offset-4"
          >
            Вход для команды
          </button>
        )}

        {isDevLocal() && <DevLoginButton />}
      </motion.div>
    </div>
  );
}
