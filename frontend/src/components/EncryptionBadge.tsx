import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldCheck, ShieldAlert, Fingerprint, Lock, Copy, Check, Info } from 'lucide-react';

interface EncryptionBadgeProps {
  isE2E?: boolean;
  isSecret?: boolean;
  isChannel?: boolean;
  e2eReady?: boolean;
  e2eFingerprint?: string | null;
}

export function EncryptionBadge({ isE2E, isSecret, isChannel, e2eReady, e2eFingerprint }: EncryptionBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const hasE2E = (isE2E || isSecret) && e2eReady;
  const hasE2EPending = (isE2E || isSecret) && !e2eReady;

  const fingerprintPairs = (e2eFingerprint || '').match(/.{1,8}/g) || [];

  const handleCopy = useCallback(() => {
    if (!e2eFingerprint) return;
    navigator.clipboard.writeText(e2eFingerprint).then(() => {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [e2eFingerprint]);

  return (
    <div className="relative">
      <motion.button
        onClick={() => setExpanded(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
          hasE2E ? 'bg-green-500/15 text-green-400 border border-green-500/20' :
          hasE2EPending ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20' :
          'bg-white/[0.04] text-white/40 hover:text-white/60 hover:bg-white/[0.08] border border-white/[0.06]'
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {hasE2E ? (
          <ShieldCheck size={11} className="text-green-400" />
        ) : hasE2EPending ? (
          <ShieldAlert size={11} className="text-yellow-400" />
        ) : isChannel ? (
          <Shield size={11} className="text-yellow-400" />
        ) : (
          <Lock size={11} />
        )}
        <span>
          {hasE2E ? 'E2E' : hasE2EPending ? 'Установка...' : isChannel ? 'Канал' : 'Защищён'}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full ${hasE2E ? 'bg-green-400 animate-pulse' : hasE2EPending ? 'bg-yellow-400 animate-pulse' : 'bg-white/20'}`} />
      </motion.button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            className="absolute top-full left-0 mt-2 w-80 z-50"
          >
            <div className="rounded-2xl liquid-glass-strong overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                    {hasE2E ? <ShieldCheck size={14} className="text-green-400" /> : <Shield size={14} className="text-white/40" />}
                    {hasE2E ? 'E2E шифрование' : hasE2EPending ? 'Установка E2E...' : 'Безопасность чата'}
                  </h3>
                </div>
                <p className="text-[10px] text-white/40">
                  {hasE2E ? 'Сообщения защищены сквозным шифрованием' : hasE2EPending ? 'Устанавливается E2E соединение...' : 'Стандартная защита'}
                </p>
              </div>

              {hasE2E && e2eFingerprint && (
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Fingerprint size={11} className="text-white/40" />
                    <span className="text-[10px] text-white/50">Отпечаток ключа</span>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-3">
                    <div className="grid grid-cols-4 gap-1 mb-2">
                      {fingerprintPairs.slice(0, 16).map((pair, i) => (
                        <span key={i} className={`text-[9px] font-mono ${i % 2 === 0 ? 'text-white/60' : 'text-white/40'}`}>
                          {pair}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-[10px] text-accent/60 hover:text-accent transition-colors"
                    >
                      {copied ? <><Check size={10} /> Скопировано</> : <><Copy size={10} /> Копировать отпечаток</>}
                    </button>
                  </div>
                  <p className="text-[8px] text-white/30 mt-1.5">
                    Сравните этот отпечаток с собеседником для проверки подлинности E2E шифрования.
                  </p>
                </div>
              )}

              <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-2">
                <Info size={10} className="text-white/30" />
                <p className="text-[9px] text-white/30">
                  {hasE2E ? 'ECDH P-256 + AES-256-GCM · Perfect Forward Secrecy' : 'TLS 1.3 · Защита канала'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
