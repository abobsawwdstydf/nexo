import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedOtpInput, ANIMATED_OTP_DEFAULT_THEME } from './AnimatedOtpInput';
import AdminPanel from './AdminPanel';
import {
  adminApi,
  adminRequestCode,
  adminVerifyCode,
  adminComplete2FA,
  adminLogout,
  adminEnsureCsrf,
  ADMIN_TOKEN_KEY,
  ADMIN_REFRESH_KEY,
} from '../lib/api/admin';

type Screen = 'email' | 'code' | '2fa' | 'panel';

const ADMIN_EMAIL_HINT = 'nexo.su.support@gmail.com';

/**
 * Отдельная страница входа в админ-панель (/admin или #admin).
 * Email → код из письма → (2FA, если включена) → админ-панель.
 * Токены хранятся отдельно от сессии мессенджера (nexo_admin_*).
 */
export default function AdminLoginPage() {
  const [screen, setScreen] = useState<Screen>(() =>
    adminApi.getStoredAccessToken() ? 'panel' : 'email'
  );
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [codeSuccess, setCodeSuccess] = useState(false);
  const [error, setError] = useState('');
  const [tentativeToken, setTentativeToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // CSRF-токен для мутаций, когда уже есть сессия админа
  useEffect(() => {
    if (screen === 'panel') {
      adminEnsureCsrf();
    }
  }, [screen]);

  const handleRequestCode = useCallback(async (emailToUse: string) => {
    const normalized = emailToUse.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setEmailError('Введите корректный email');
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setEmailError('');
    setError('');
    setEmail(normalized);
    try {
      const res = await adminRequestCode(normalized);
      setExpiresAt(res.expiresAt ?? null);
      setNowMs(Date.now());
      setScreen('code');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      setEmailError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, []);

  const handleVerifyCode = useCallback(async (code: string) => {
    if (code.length < 6 || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setCodeError(false);
    setError('');
    try {
      const res = await adminVerifyCode(email, code);
      if (res.requiresTwoFactor && res.tentativeToken) {
        setTentativeToken(res.tentativeToken);
        setScreen('2fa');
        return;
      }
      if (res.accessToken) {
        try {
          localStorage.setItem(ADMIN_TOKEN_KEY, res.accessToken);
          if (res.refreshToken) localStorage.setItem(ADMIN_REFRESH_KEY, res.refreshToken);
        } catch { /* noop */ }
        setCodeSuccess(true);
        setTimeout(() => setScreen('panel'), 600);
      }
    } catch (err: unknown) {
      setCodeError(true);
      setError(err instanceof Error ? err.message : 'Неверный код');
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [email]);

  const handle2FA = useCallback(async (code: string) => {
    if (code.length < 6 || !tentativeToken || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setCodeError(false);
    setError('');
    try {
      const res = await adminComplete2FA(tentativeToken, code);
      if (res.accessToken) {
        try {
          localStorage.setItem(ADMIN_TOKEN_KEY, res.accessToken);
          if (res.refreshToken) localStorage.setItem(ADMIN_REFRESH_KEY, res.refreshToken);
        } catch { /* noop */ }
        setCodeSuccess(true);
        setTimeout(() => setScreen('panel'), 600);
      }
    } catch (err: unknown) {
      setCodeError(true);
      setError(err instanceof Error ? err.message : 'Неверный код');
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [tentativeToken]);

  const handleLogout = useCallback(() => {
    adminLogout();
    setScreen('email');
    setEmail('');
    setCodeError(false);
    setCodeSuccess(false);
  }, []);

  const minutesLeft = expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - nowMs) / 60000)) : 10;

  // Полноэкранный режим: сама админ-панель + плавающий выход.
  if (screen === 'panel') {
    return (
      <div className="h-full w-full">
        <button
          onClick={handleLogout}
          className="fixed top-4 right-4 z-[97] px-3.5 py-2 rounded-xl text-xs font-semibold text-white/80 bg-black/50 backdrop-blur-md border border-white/15 hover:bg-black/70 hover:text-white transition-colors shadow-lg"
          title="Выйти из админ-панели"
        >
          Выйти из панели
        </button>
        <AdminPanel onClose={() => setScreen('email')} client={adminApi} />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="liquid-glass-strong rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/10">
          {/* Logo header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-300/90 to-orange-500/90 flex items-center justify-center text-xl font-black text-black shadow-lg shadow-orange-500/25">
              N
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Админ-панель Нексо</h1>
              <p className="text-xs text-white/40">Отдельный вход · только для администрации</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-sm text-red-300">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {screen === 'code' || screen === '2fa' ? (
              <motion.div
                key="code"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">
                    {screen === '2fa' ? 'Код из аутентификатора' : 'Код из письма'}
                  </h2>
                  <p className="text-xs text-white/45 leading-relaxed">
                    {screen === '2fa'
                      ? 'На аккаунте включена двухфакторная аутентификация. Введите код из приложения-аутентификатора.'
                      : `Мы отправили 6-значный код на ${email}. Введите его ниже.`}
                    {minutesLeft < 10 && screen === 'code' && (
                      <span className="text-amber-300/80"> Код действителен ещё {minutesLeft} мин.</span>
                    )}
                  </p>
                </div>

                <AnimatedOtpInput
                  length={6}
                  autoFocus
                  error={codeError}
                  success={codeSuccess}
                  disabled={submitting}
                  onChange={() => { if (codeError) setCodeError(false); }}
                  onComplete={screen === '2fa' ? handle2FA : handleVerifyCode}
                  theme={ANIMATED_OTP_DEFAULT_THEME}
                  ariaLabel="Код подтверждения"
                />

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => setScreen('email')}
                    className="text-xs text-white/45 hover:text-white/80 transition-colors"
                  >
                    ← Сменить email
                  </button>
                  <button
                    onClick={() => { setResending(true); handleRequestCode(email).finally(() => setResending(false)); }}
                    disabled={resending || submitting}
                    className="text-xs font-medium text-amber-300/90 hover:text-amber-200 disabled:opacity-50 transition-colors"
                  >
                    {resending ? 'Отправляем…' : 'Отправить снова'}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <label className="block">
                  <span className="text-sm font-medium text-white/80 mb-1.5 block">Почта администратора</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRequestCode(email);
                    }}
                    placeholder={ADMIN_EMAIL_HINT}
                    autoComplete="email"
                    spellCheck={false}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/10 text-white placeholder-white/25 outline-none focus:border-amber-300/50 focus:bg-white/[0.08] transition-colors"
                  />
                  {emailError && <span className="mt-1.5 block text-xs text-red-300">{emailError}</span>}
                </label>

                <button
                  onClick={() => handleRequestCode(email)}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl font-semibold text-black bg-gradient-to-r from-amber-300 to-orange-400 hover:from-amber-200 hover:to-orange-300 active:scale-[0.99] disabled:opacity-60 transition-all shadow-lg shadow-orange-500/20"
                >
                  {submitting ? 'Отправляем код…' : 'Получить код'}
                </button>

                <p className="text-[11px] leading-relaxed text-white/30 text-center pt-1">
                  Код придёт на почту администратора и действует 10 минут.
                  Вход выполняется отдельно от аккаунта мессенджера.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="text-center mt-4">
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); window.location.hash = ''; }}
            className="text-xs text-white/35 hover:text-white/70 transition-colors"
          >
            ← Вернуться в мессенджер
          </a>
        </div>
      </motion.div>
    </div>
  );
}