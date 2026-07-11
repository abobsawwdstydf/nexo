import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Smartphone, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import WelcomeAnimation from '../components/WelcomeAnimation';
import { AuthShell, AuthCard, AuthLogo, AuthTitle, authPrimaryButtonStyle } from '../components/AuthShell';
import AuthGifIcon from '../components/AuthGifIcon';

const DEVICE_TOKEN_TTL = 5 * 60 * 1000;
const POLL_INTERVAL = 2000;

const ShimmerButton = motion.button;
const SecondaryButton = motion.button;

export default function DeviceAuthPage() {
  const { user, login, loginWithToken } = useAuthStore();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showWelcomeDone, setShowWelcomeDone] = useState(false);
  const [action, setAction] = useState<'idle' | 'confirming' | 'confirmed' | 'denied' | 'expired' | 'polling'>('idle');
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [createdAt, setCreatedAt] = useState<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dt = params.get('device');
    if (dt) {
      setDeviceToken(dt);
      setCreatedAt(Date.now());

      const stored = localStorage.getItem(`nexo_device_${dt}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.ts < DEVICE_TOKEN_TTL) {
          setAction('confirmed');
          setTimeout(() => setShowWelcome(true), 1000);
        } else {
          setTokenExpired(true);
          setAction('expired');
        }
      } else if (!user) {
        setAction('polling');
        startPolling(dt);
      }

      // Сообщаем бэкенду, что QR-код был отсканирован
      api.post('/auth/device/scan', { device: dt }).catch(() => {});
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = (dt: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const result = await api.get(`/auth/device/check?device=${dt}`);
        if (result && result.confirmed && result.user) {
          if (pollRef.current) clearInterval(pollRef.current);
          localStorage.setItem(`nexo_device_${dt}`, JSON.stringify({ ts: Date.now() }));
          loginWithToken(result.accessToken || '', result.user);
          setAction('confirmed');
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
        } else if (result && result.denied) {
          if (pollRef.current) clearInterval(pollRef.current);
          setAction('denied');
        }
        // else: still pending, continue polling
      } catch {
        // Token not registered yet or network error - continue polling
      }
    }, POLL_INTERVAL);
  };

  useEffect(() => {
    if (createdAt && deviceToken) {
      const check = setInterval(() => {
        if (Date.now() - createdAt > DEVICE_TOKEN_TTL && (action === 'idle' || action === 'polling')) {
          setTokenExpired(true);
          setAction('expired');
          if (pollRef.current) clearInterval(pollRef.current);
          clearInterval(check);
        }
      }, 10000);
      return () => clearInterval(check);
    }
  }, [createdAt, deviceToken, action]);

  const handleConfirm = async () => {
    setAction('confirming');

    if (deviceToken) {
      try {
        await api.post('/auth/device/confirm', { device: deviceToken });
        localStorage.setItem(`nexo_device_${deviceToken}`, JSON.stringify({ ts: Date.now() }));
      } catch (err) {
        console.error('Device confirm error:', err);
        setAction('idle');
        return;
      }
    }

    await new Promise((r) => setTimeout(r, 800));
    setAction('confirmed');
    await new Promise((r) => setTimeout(r, 1200));
    window.location.href = '/';
  };

  const handleDeny = async () => {
    setAction('denied');
    if (deviceToken) {
      localStorage.removeItem(`nexo_device_${deviceToken}`);
      try {
        await api.post('/auth/device/deny', { device: deviceToken });
      } catch {
        // ignore - UI already updated
      }
    }
  };

  const handleWelcomeDone = () => {
    setShowWelcomeDone(true);
    window.location.href = '/';
  };

  if (showWelcomeDone) {
    return (
      <AuthShell>
        <div className="text-center max-w-sm mx-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', bounce: 0.4 }}
            className="relative w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4"
            style={{ boxShadow: '0 0 40px rgba(16,185,129,0.3), 0 10px 30px rgba(0,0,0,0.3)' }}
          >
            <motion.div
              animate={{ scale: [1, 1.5, 1.5], opacity: [0.5, 0, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              className="absolute inset-0 rounded-full bg-emerald-500/30"
            />
            <Check size={40} className="text-emerald-400 relative z-10" />
          </motion.div>
          <h2
            className="text-2xl font-bold mb-2"
            style={{
              background: 'linear-gradient(135deg, #fff, #6ee7b7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Авторизация успешна
          </h2>
          <p className="text-white/40 text-[14px]">Перенаправление...</p>
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              />
            ))}
          </div>
        </div>
      </AuthShell>
    );
  }

  if (showWelcome) {
    return <WelcomeAnimation onComplete={handleWelcomeDone} />;
  }

  if (tokenExpired || action === 'expired') {
    return (
      <AuthShell onBack={() => (window.location.href = '/')}>
        <AuthCard className="max-w-sm w-full mx-4">
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.4 }}
              className="relative w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4"
              style={{ boxShadow: '0 0 40px rgba(239,68,68,0.3), 0 10px 30px rgba(0,0,0,0.3)' }}
            >
              <motion.div
                animate={{ scale: [1, 1.5, 1.5], opacity: [0.5, 0, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full bg-red-500/30"
              />
              <X size={40} className="text-red-400 relative z-10" />
            </motion.div>
            <AuthTitle title="Ссылка истекла" subtitle="Ссылка для авторизации действительна 5 минут" />
            <ShimmerButton
              whileHover={{
                scale: 1.01,
                boxShadow: '0 0 30px rgba(99,102,241,0.4), 0 8px 24px rgba(0,0,0,0.3)',
              }}
              whileTap={{ scale: 0.98 }}
              onClick={() => (window.location.href = '/')}
              className="mt-6 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white font-semibold text-[14px] flex items-center justify-center gap-2 relative overflow-hidden"
              style={authPrimaryButtonStyle}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
              На главную
            </ShimmerButton>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  if (!user) {
    const handleLogin = async () => {
      if (!loginUsername || !loginPassword) return;
      setLoginLoading(true);
      setLoginError('');
      try {
        await login(loginUsername, loginPassword);
        setAction('idle');
        if (deviceToken) {
          startPolling(deviceToken);
        }
        setLoginLoading(false);
      } catch (err: any) {
        setLoginError(err.message || 'Ошибка входа');
        setLoginLoading(false);
      }
    };

    return (
      <AuthShell>
        <AuthCard className="max-w-sm w-full mx-4">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <AuthLogo size="lg" />
            </div>
            <h1
              className="text-3xl font-black mb-2 tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #c7d2fe 50%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 30px rgba(99,102,241,0.2))',
                letterSpacing: '-0.04em',
              }}
            >
              Нексо
            </h1>
            <p className="text-white/40 text-[13px] mt-2 mb-5">
              Войдите, чтобы подтвердить вход на другом устройстве
            </p>

            <div className="space-y-3 text-left">
              <div className="relative">
                <span className="text-[12px] text-white/40 ml-1 mb-1 block">Имя пользователя</span>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
                    <AuthGifIcon src="/auth-gifs/user.gif" size={20} />
                  </div>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Введите имя пользователя"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/25 focus:border-[#6366f1]/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-[#6366f1]/20 transition-all duration-300 outline-none text-sm"
                  />
                </div>
              </div>
              <div className="relative">
                <span className="text-[12px] text-white/40 ml-1 mb-1 block">Пароль</span>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
                    <AuthGifIcon src="/auth-gifs/lock.gif" size={20} />
                  </div>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    placeholder="Введите пароль"
                    className="w-full pl-11 pr-10 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/25 focus:border-[#6366f1]/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-[#6366f1]/20 transition-all duration-300 outline-none text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 bottom-3 text-white/30 hover:text-white/70"
                  >
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <p className="text-red-400 text-xs text-center">{loginError}</p>
              )}

              <ShimmerButton
                whileHover={{
                  scale: 1.01,
                  boxShadow: '0 0 30px rgba(99,102,241,0.4), 0 8px 24px rgba(0,0,0,0.3)',
                }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogin}
                disabled={loginLoading || !loginUsername || !loginPassword}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white font-semibold text-[14px] flex items-center justify-center gap-2 relative overflow-hidden disabled:opacity-50"
                style={authPrimaryButtonStyle}
              >
                {loginLoading ? <Loader2 size={18} className="animate-spin" /> : <><img src="/auth-gifs/lock.gif" alt="" className="w-5 h-5" /> Войти</>}
              </ShimmerButton>
            </div>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard className="max-w-sm w-full mx-4">
        <div className="text-center">
          <div className="flex justify-center mb-5">
            <motion.div
              animate={{ scale: [1, 1.05, 1], opacity: [0.2, 0.3, 0.2] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="relative"
            >
              <div className="absolute inset-0 -m-3 rounded-[1.4rem] bg-[#6366f1]/30 blur-xl" />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.4 }}
                className="relative w-20 h-20 rounded-[1.1rem] bg-gradient-to-br from-[#6366f1]/25 to-[#8b5cf6]/25 border border-[#6366f1]/30 flex items-center justify-center"
                style={{ boxShadow: '0 0 40px rgba(99,102,241,0.3), 0 10px 30px rgba(0,0,0,0.3)' }}
              >
                <Smartphone size={36} className="text-[#a5b4fc]" />
              </motion.div>
            </motion.div>
          </div>

          <AuthTitle title="Подтверждение входа" subtitle="Кто-то пытается войти в ваш аккаунт" />

          <div className="mt-4 mb-2">
            <p className="text-sm text-white/50">
              Аккаунт: <span className="text-white font-medium">{user.displayName}</span> (@{user.username})
            </p>
            <p className="text-[11px] text-white/30 mt-2">
              Ссылка истекает через {Math.max(0, Math.ceil((DEVICE_TOKEN_TTL - (Date.now() - createdAt)) / 60000))} мин
            </p>
          </div>

          <div className="mt-6">
            <AnimatePresence mode="wait">
              {action === 'idle' && (
                <motion.div
                  key="buttons"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-2.5"
                >
                  <ShimmerButton
                    whileHover={{
                      scale: 1.01,
                      boxShadow: '0 0 30px rgba(16,185,129,0.4), 0 8px 24px rgba(0,0,0,0.3)',
                    }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirm}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold text-[14px] flex items-center justify-center gap-2 relative overflow-hidden"
                    style={{ boxShadow: '0 0 20px rgba(16,185,129,0.3), 0 6px 20px rgba(0,0,0,0.2)' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                    <Check size={18} /> Подтвердить вход
                  </ShimmerButton>
                  <SecondaryButton
                    whileHover={{
                      scale: 1.01,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      borderColor: 'rgba(255,255,255,0.16)',
                    }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDeny}
                    className="w-full py-3 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white font-semibold text-[14px] flex items-center justify-center gap-2 transition-all"
                  >
                    <X size={18} /> Отклонить
                  </SecondaryButton>
                </motion.div>
              )}

              {(action === 'confirming' || action === 'polling') && (
                <motion.div
                  key={action}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3 py-3"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="w-12 h-12 rounded-full border-2 border-white/10 border-t-[#a5b4fc]"
                  />
                  <p className="text-white/60 text-[14px]">
                    {action === 'confirming' ? 'Подтверждение...' : 'Ожидание подтверждения...'}
                  </p>
                  {action === 'polling' && (
                    <p className="text-white/30 text-[12px] text-center">
                      Подтвердите вход на устройстве, где вы уже авторизованы
                    </p>
                  )}
                </motion.div>
              )}

              {action === 'confirmed' && (
                <motion.div
                  key="confirmed"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', bounce: 0.4 }}
                  className="py-3"
                >
                  <div
                    className="relative w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3"
                    style={{ boxShadow: '0 0 30px rgba(16,185,129,0.3), 0 8px 20px rgba(0,0,0,0.3)' }}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.5, 1.5], opacity: [0.5, 0, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                      className="absolute inset-0 rounded-full bg-emerald-500/30"
                    />
                    <Check size={32} className="text-emerald-400 relative z-10" />
                  </div>
                  <p className="text-emerald-400 font-semibold">Устройство подтверждено</p>
                </motion.div>
              )}

              {action === 'denied' && (
                <motion.div
                  key="denied"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', bounce: 0.4 }}
                  className="py-3"
                >
                  <div
                    className="relative w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3"
                    style={{ boxShadow: '0 0 30px rgba(239,68,68,0.3), 0 8px 20px rgba(0,0,0,0.3)' }}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.5, 1.5], opacity: [0.5, 0, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                      className="absolute inset-0 rounded-full bg-red-500/30"
                    />
                    <X size={32} className="text-red-400 relative z-10" />
                  </div>
                  <p className="text-red-400 font-semibold">Вход отклонён</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
