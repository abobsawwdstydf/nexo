import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { devLogin, getDevLoginKey } from '../lib/devMode';
import { toast } from '../lib/toast';

/** Кнопка локального dev-входа. Рендерится только на localhost (см. вызывающий код). */
export function DevLoginButton() {
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [key, setKey] = useState('');

  const hasKey = !!getDevLoginKey();

  const handleLogin = async (targetKey?: string) => {
    setBusy(true);
    try {
      await devLogin(targetKey);
      toast.success('Dev-вход выполнен');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      {!showKey && (
        <button
          onClick={() => (hasKey ? handleLogin() : setShowKey(true))}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-[12px] text-emerald-300/70 hover:text-emerald-300 transition-colors underline underline-offset-4 disabled:opacity-50"
        >
          <FlaskConical size={12} />
          {busy ? 'Вход…' : 'Вход для разработчика'}
        </button>
      )}

      {showKey && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) handleLogin(key.trim());
          }}
        >
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Dev-ключ"
            autoFocus
            className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/[0.1] text-xs text-white/80 placeholder:text-white/30 outline-none focus:border-emerald-400/40 w-36"
          />
          <button
            type="submit"
            disabled={busy || !key.trim()}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-xs font-medium text-emerald-300 transition-all disabled:opacity-50"
          >
            ОК
          </button>
        </form>
      )}
    </div>
  );
}