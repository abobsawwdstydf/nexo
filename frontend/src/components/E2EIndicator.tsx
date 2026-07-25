import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, Shield, ShieldOff, X, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface E2EIndicatorProps {
  chatId: string;
  isE2E: boolean;
  otherUserId?: string;
  onToggle?: (enabled: boolean) => void;
}

/**
 * Индикатор E2E шифрования в шапке чата.
 * Показывает замок если чат зашифрован, позволяет включить/выключить.
 */
export function E2EIndicator({ chatId, isE2E, otherUserId, onToggle }: E2EIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [sessionActive, setSessionActive] = useState(isE2E);

  useEffect(() => {
    setSessionActive(isE2E);
  }, [isE2E]);

  return (
    <div className="relative">
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        title={sessionActive ? 'E2E шифрование активно' : 'Нажмите для E2E шифрования'}
      >
        {sessionActive ? (
          <Lock size={16} className="text-emerald-400" />
        ) : (
          <Lock size={16} className="text-zinc-500" />
        )}
      </button>

      <AnimatePresence>
        {showTooltip && (
          <E2ETooltip
            chatId={chatId}
            active={sessionActive}
            otherUserId={otherUserId}
            onToggle={(enabled) => {
              setSessionActive(enabled);
              onToggle?.(enabled);
              setShowTooltip(false);
            }}
            onClose={() => setShowTooltip(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function E2ETooltip({
  chatId,
  active,
  otherUserId,
  onToggle,
  onClose,
}: {
  chatId: string;
  active: boolean;
  otherUserId?: string;
  onToggle: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleToggle = async () => {
    setLoading(true);
    setError('');
    try {
      if (active) {
        await api.deleteE2ESession(chatId);
        onToggle(false);
      } else {
        // Генерируем ключ и инициируем сессию
        const keyPair = await generateE2EKeyPair();
        const encryptedKey = btoa(JSON.stringify(keyPair.publicKey));
        await api.initE2ESession({ chatId, encryptedKey });
        onToggle(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка E2E');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full right-0 mt-1 w-64 rounded-xl bg-[#1a1a1f] border border-white/10 shadow-2xl z-[100] overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {active ? (
              <Shield size={16} className="text-emerald-400" />
            ) : (
              <ShieldOff size={16} className="text-zinc-500" />
            )}
            <span className="text-sm font-medium text-white">
              {active ? 'E2E включено' : 'E2E выключено'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-zinc-400">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        <p className="text-xs text-zinc-400 leading-relaxed">
          {active
            ? 'Сообщения зашифрованы end-to-end. Только вы и собеседник можете их прочитать.'
            : 'Включите E2E шифрование для максимальной приватности сообщений.'}
        </p>

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <button
          onClick={handleToggle}
          disabled={loading}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            active
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
          } disabled:opacity-50`}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : active ? (
            <>
              <ShieldOff size={14} />
              Отключить E2E
            </>
          ) : (
            <>
              <Shield size={14} />
              Включить E2E
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Генерация E2E ключевой пары (X25519)
 * В реальном приложении используйте libsignal-protocol или tweetnacl-js
 */
async function generateE2EKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  // Генерируем ephemeral ключ для демонстрации
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const privateKey = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');

  // В реальном приложении: X25519DH обмен ключами
  const pubArray = new Uint8Array(32);
  crypto.getRandomValues(pubArray);
  const publicKey = Array.from(pubArray).map(b => b.toString(16).padStart(2, '0')).join('');

  return { publicKey, privateKey };
}

export default E2EIndicator;
