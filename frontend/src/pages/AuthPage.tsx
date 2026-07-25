import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { ArrowRight, ArrowLeft, Camera, Check, Loader2, X, Bell, Mail } from 'lucide-react';

import {
  ShieldCheck, MessageSquarePlus, Sparkles,
  CheckCircle2, User, MessageSquare, StickyNote,
} from 'lucide-react';
import { playKeyboardSound } from '../lib/sounds';
import { useResponsive } from '../hooks/useResponsive';
import ImageCropper from '../components/ImageCropper';
import ModeToggle from '../components/ModeToggle';
import FloatingInput from '../components/FloatingInput';
import OTPInput from '../components/OTPInput';
import LegalPage, { type LegalPageType } from '../components/LegalPage';

const D = {
  bg: '#0a0a0f', card: 'rgba(18,18,24,0.65)', cardSolid: '#121218',
  input: 'rgba(255,255,255,0.04)', inputBorder: 'rgba(255,255,255,0.08)',
  primary: '#7B61FF', primaryHover: '#6c52e6', primaryGlow: 'rgba(123,97,255,0.4)',
  success: '#3ba55d', error: '#ed4245', warning: '#faa61a',
  textPrimary: '#f2f3f5', textSecondary: '#b5bac1',
  textMuted: '#949ba4', textDim: '#4e5058',
  border: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.1)',
  glassShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
} as const;

type AuthMode = 'login' | 'register';
type RegisterStep = 1 | 2 | 3 | 4;
type LoginStep = 'credentials' | 'code';

function Steps({ cur, total }: { cur: number; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 20 }}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: n === cur ? 28 : 8, height: 8,
              borderRadius: 4,
              background: n < cur ? D.success : n === cur ? D.primary : '#3f4147',
              boxShadow: n === cur ? `0 0 16px ${D.primaryGlow}` : 'none',
              transition: 'all 0.4s',
            }} />
            {i < total - 1 && <div style={{ width: 12, height: 2, borderRadius: 1, background: n < cur ? D.primary : '#3f4147' }} />}
          </div>
        );
      })}
    </div>
  );
}

function StepHeader({ stepLabel, title, subtitle }: { stepLabel: string; title: string; subtitle: string }) {
  return (
    <motion.div style={{ textAlign: 'center', marginBottom: 16 }}
      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <motion.div style={{ display: 'inline-block',       background: `rgba(123,97,255,0.12)`, color: D.primary, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, padding: '4px 14px', borderRadius: 50, marginBottom: 8, border: '1px solid rgba(123,97,255,0.15)' }}
        whileHover={{ scale: 1.05 }}>
        {stepLabel}
      </motion.div>
      <h2 style={{ color: D.textPrimary, fontSize: 20, fontWeight: 700 }}>{title}</h2>
      <p style={{ color: D.textMuted, fontSize: 14, marginTop: 4 }}>{subtitle}</p>
    </motion.div>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div key={msg} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            marginTop: 10, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(237,66,69,0.15)', border: '1px solid rgba(237,66,69,0.3)',
            color: '#fca5a5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: "'Inter',sans-serif",
          }}>
          <X size={14} /><span style={{ fontWeight: 500 }}>{msg}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BtnPrimary({ children, onClick, disabled, loading }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button onClick={onClick} disabled={disabled || loading}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.97 }}
      animate={hovered ? { boxShadow: `0 8px 30px ${D.primaryGlow}, 0 0 60px ${D.primaryGlow}` } : { boxShadow: `0 4px 20px ${D.primaryGlow}` }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      style={{
        width: '100%', padding: 14, border: `2px solid ${D.primary}`, borderRadius: 12,
        background: loading ? `${D.primaryHover}22` : 'transparent',
        color: D.primary, backdropFilter: 'blur(12px)',
        fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        opacity: disabled ? 0.5 : 1,
      }}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : children}
    </motion.button>
  );
}

function BtnSecondary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button onClick={onClick}
      whileHover={{ scale: 1.02, y: -1, background: 'rgba(255,255,255,0.05)' }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      style={{
        flex: 1, padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)',
        color: D.textSecondary, border: `1px solid ${D.glassBorder}`, backdropFilter: 'blur(8px)',
        fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 600,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      }}>
      {children}
    </motion.button>
  );
}

function LegalLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: 'none', border: 'none', padding: 0, color: D.primary, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FIXED HEIGHT FORM WRAPPER — prevents size jumps when switching modes
// ═══════════════════════════════════════════════════════════════════════════
const FORM_MIN_HEIGHT = 480;

// ═══════════════════════════════════════════════════════════════════════════
export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [step, setStep] = useState<RegisterStep>(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { isMobile } = useResponsive();
  const { sendLoginCode, loginConfirm, register, user } = useAuthStore();

  // ─── Login state ───────────────────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState('');
  const [loginStep, setLoginStep] = useState<LoginStep>('credentials');
  const [loginCode, setLoginCode] = useState('');
  const [loginCodeResendTimer, setLoginCodeResendTimer] = useState(0);

  // ─── Register state ────────────────────────────────────────────────────
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperSrc, setCropperSrc] = useState('');
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [legalPage, setLegalPage] = useState<LegalPageType | null>(null);

  // Register email verification
  const [regEmail, setRegEmail] = useState('');
  const [regEmailCode, setRegEmailCode] = useState('');
  const [regEmailCodeSent, setRegEmailCodeSent] = useState(false);
  const [regEmailVerified, setRegEmailVerified] = useState(false);
  const [regEmailLoading, setRegEmailLoading] = useState(false);
  const [regEmailResendTimer, setRegEmailResendTimer] = useState(0);
  const [regEmailStatus, setRegEmailStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  // Register notifications preference (step 5)
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifSound, setNotifSound] = useState(true);
  const [notifPreview, setNotifPreview] = useState(true);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // ─── Effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (username.length < 3 || username.length > 17 || !/^[a-zA-Z0-9_.-]+$/.test(username)) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      try { const r = await api.checkUsername(username); setUsernameStatus(r.available ? 'available' : 'taken'); }
      catch { setUsernameStatus('idle'); }
    }, 500);
    return () => clearTimeout(t);
  }, [username]);

  // Debounced email availability check during registration
  useEffect(() => {
    if (!regEmail || !regEmail.includes('@') || !regEmail.includes('.')) { setRegEmailStatus('idle'); return; }
    if (regEmailCodeSent || regEmailVerified) { return; } // Don't check if code already sent
    setRegEmailStatus('checking');
    const t = setTimeout(async () => {
      try {
        const r = await api.checkEmail(regEmail);
        setRegEmailStatus(r.available ? 'available' : 'taken');
      } catch { setRegEmailStatus('idle'); }
    }, 600);
    return () => clearTimeout(t);
  }, [regEmail, regEmailCodeSent, regEmailVerified]);

  useEffect(() => setError(''), [mode]);
  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); if (originalImageSrc) URL.revokeObjectURL(originalImageSrc); }, []);
  useEffect(() => {
    if (loginCodeResendTimer <= 0) return;
    const t = setTimeout(() => setLoginCodeResendTimer(e => e - 1), 1000);
    return () => clearTimeout(t);
  }, [loginCodeResendTimer]);
  useEffect(() => {
    if (regEmailResendTimer <= 0) return;
    const t = setTimeout(() => setRegEmailResendTimer(e => e - 1), 1000);
    return () => clearTimeout(t);
  }, [regEmailResendTimer]);

  // ─── Login handlers ────────────────────────────────────────────────────
  const handleLogin = async () => {
    setError('');
    if (!loginEmail || !loginEmail.includes('@')) { setError('Введите корректный email'); return; }
    setSubmitting(true);
    try {
      const result = await sendLoginCode(loginEmail);
      if (result.requiresCode) {
        setLoginStep('code');
        setLoginCodeResendTimer(60);
      }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Ошибка входа'); }
    finally { setSubmitting(false); }
  };

  const handleLoginConfirm = async () => {
    if (!loginCode || loginCode.length !== 6) { setError('Введите 6-значный код'); return; }
    setSubmitting(true); setError('');
    try { await loginConfirm(loginEmail, loginCode); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Ошибка подтверждения'); }
    finally { setSubmitting(false); }
  };

  const resendLoginCode = async () => {
    setSubmitting(true); setError('');
    try {
      await sendLoginCode(loginEmail);
      setLoginCodeResendTimer(60);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Ошибка отправки'); }
    finally { setSubmitting(false); }
  };

  // ─── Register handlers ─────────────────────────────────────────────────
  const handleAvatar = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError('Файл не более 10MB'); return; }
    if (originalImageSrc) URL.revokeObjectURL(originalImageSrc);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    const src = URL.createObjectURL(file);
    setOriginalImageSrc(src);
    setCropperSrc(src);
    setCropperOpen(true);
  };

  const handleAvatarCropped = (blob: Blob) => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    const url = URL.createObjectURL(blob);
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
    setAvatarFile(file);
    setAvatarPreview(url);
    setCropperOpen(false);
    setError('');
  };

  const handleAvatarClick = () => {
    if (avatarPreview && originalImageSrc) {
      // Re-open cropper with the original uncropped image
      setCropperSrc(originalImageSrc);
      setCropperOpen(true);
    } else {
      document.getElementById('reg-avatar-input')?.click();
    }
  };

  const sendRegEmailCode = async () => {
    if (!regEmail || !regEmail.includes('@') || !regEmail.includes('.')) { setError('Введите корректный email'); return; }
    setRegEmailLoading(true); setError('');
    try {
      // Check email availability first
      const check = await api.checkEmail(regEmail);
      if (!check.available) {
        setError(check.message || 'Этот email уже зарегистрирован');
        setRegEmailStatus('taken');
        setRegEmailLoading(false);
        return;
      }
      await api.sendEmailCode(regEmail);
      setRegEmailCodeSent(true); setRegEmailResendTimer(60); setRegEmailStatus('available');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('409')) {
        setError('Этот email уже зарегистрирован');
        setRegEmailStatus('taken');
      } else {
        setError(err instanceof Error ? err.message : 'Ошибка отправки');
      }
    }
    finally { setRegEmailLoading(false); }
  };

  const confirmRegEmailCode = async () => {
    if (!regEmailCode || regEmailCode.length !== 6) { setError('Введите 6-значный код'); return; }
    setRegEmailLoading(true); setError('');
    try {
      await api.confirmEmailCode(regEmail, regEmailCode);
      setRegEmailVerified(true);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Неверный код'); }
    finally { setRegEmailLoading(false); }
  };

  // ─── Validation per step ──────────────────────────────────────────────
  const val1 = (): boolean => {
    if (displayName.trim().length === 0) { setError('Введите имя'); return false; }
    return true;
  };
  const val2 = (): boolean => {
    if (username.length < 3) { setError('Минимум 3 символа'); return false; }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) { setError('Только латиница, цифры и -_.'); return false; }
    if (usernameStatus === 'taken') { setError('Username занят'); return false; }
    return true;
  };

  const nextStep = () => {
    setError('');
    if (step === 1 && val1()) setStep(2);
    else if (step === 2 && val2()) setStep(3);
    else if (step === 3) setStep(4);
  };
  const prevStep = () => { setError(''); if (step > 1) setStep(step - 1 as RegisterStep); };

  const handleRegister = async () => {
    if (!regEmailVerified) { setError('Подтвердите email'); return; }
    if (!acceptedLegal) { setError('Примите соглашения и согласие на обработку персональных данных'); return; }
    setError(''); setSubmitting(true);
    try {
      await register({ username, displayName: displayName || username, email: regEmail, bio: bio || undefined, avatar: avatarFile || undefined });
      // Backend now returns tokens directly — register() in store stores them and sets user
      setShowSuccess(true);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Ошибка регистрации'); }
    finally { setSubmitting(false); }
  };

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login');
    setStep(1); setError('');
    setLoginStep('credentials'); setLoginCode(''); setLoginCodeResendTimer(0);
    setRegEmailCodeSent(false); setRegEmailVerified(false); setRegEmailCode('');
    setNotifMessages(true); setNotifSound(true); setNotifPreview(true);
    setAcceptedLegal(false); setMarketingConsent(false); setLegalPage(null);
  };

  // ═══════ SUCCESS ═══════
  if (showSuccess) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: D.bg, position: 'relative', overflow: 'hidden' }}>
        <Bg />
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 400, padding: 20 }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.4 }}
            style={{ width: 80, height: 80, borderRadius: 24, background: 'rgba(59,165,93,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 0 40px rgba(59,165,93,0.3)' }}>
            <Check size={40} color={D.success} />
          </motion.div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, background: 'linear-gradient(135deg, #fff, #6ee7b7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: "'Inter',sans-serif" }}>
            Добро пожаловать!
          </h2>
          <p style={{ color: D.textDim, fontSize: 14, fontFamily: "'Inter',sans-serif" }}>Загрузка мессенджера...</p>
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 6 }}>
            {[0,1,2].map(i => <motion.div key={i} animate={{ opacity: [0.3,1,0.3], scale: [0.8,1,0.8] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }} style={{ width: 6, height: 6, borderRadius: '50%', background: D.success }} />)}
          </div>
        </motion.div>
      </div>
    );
  }

  // ═══════ FORM PANEL ═══════
  const formPanel = (
    <div style={{ width: '100%', maxWidth: isMobile ? '100%' : 420, padding: isMobile ? '28px 24px' : '36px 36px 28px' }}>
      {mode === 'login' ? (
        <>
          {/* Login step indicator */}
          <StepHeader
            stepLabel={loginStep === 'credentials' ? 'Вход' : 'Подтверждение'}
            title={loginStep === 'credentials' ? 'Добро пожаловать!' : 'Введите код'}
            subtitle={loginStep === 'credentials' ? 'Войдите в свой аккаунт' : `Код отправлен на ${loginEmail}`}
          />
          <Steps cur={loginStep === 'credentials' ? 1 : 2} total={2} />

          <AnimatePresence mode="wait">
            {loginStep === 'credentials' ? (
              <motion.div key="credentials" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
                <FloatingInput icon={<Mail size={18} color={D.primary} />} value={loginEmail} onChange={e => { setLoginEmail(e.target.value); playKeyboardSound(); }} placeholder="Email" autoFocus autoComplete="email" onKeyDown={e => e.key === 'Enter' && handleLogin()} delay={0.1} />
                <Err msg={error} />
                <motion.div style={{ marginTop: 16 }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <BtnPrimary onClick={handleLogin} loading={submitting}><ArrowRight size={18} color="#fff" /> Продолжить</BtnPrimary>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div key="code" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.3 }}>
                <div style={{ marginBottom: 20 }}>
                  <OTPInput
                    length={6}
                    value={loginCode}
                    onChange={setLoginCode}
                    autoFocus
                    error={!!error}
                  />
                </div>
                <Err msg={error} />
                <motion.div style={{ marginTop: 16 }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <BtnPrimary onClick={handleLoginConfirm} loading={submitting} disabled={loginCode.length < 6}><ShieldCheck size={18} color="#fff" /> Подтвердить</BtnPrimary>
                </motion.div>
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  {loginCodeResendTimer > 0 ? (
                    <motion.p style={{ color: D.textDim, fontSize: 12 }}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Повторно через {loginCodeResendTimer}с</motion.p>
                  ) : (
                    <motion.button onClick={resendLoginCode} style={{ background: 'none', border: 'none', color: D.primary, fontSize: 12, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Отправить код повторно</motion.button>
                  )}
                </div>
                <motion.div style={{ marginTop: 16 }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <BtnSecondary onClick={() => { setLoginStep('credentials'); setLoginCode(''); setError(''); }}><ArrowLeft size={16} /> Назад к email</BtnSecondary>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
       ) : (
        <>
           {/* Register — 4 steps */}
           <Steps cur={step} total={4} />
           <AnimatePresence mode="wait">
             <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>

                {/* STEP 1 — Avatar + Name + Bio */}
                {step === 1 && (
                  <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
                    <StepHeader stepLabel="Шаг 1 из 4" title="Ваш профиль" subtitle="Как вас увидят другие" />
                    <motion.div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '24px 20px 20px', marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
                      <motion.div onClick={handleAvatarClick}
                        style={{ position: 'relative', width: 72, height: 72, borderRadius: '50%', border: `3px solid ${avatarPreview ? D.primary : '#3f4147'}`, background: '#2b2d31', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', marginBottom: 12 }}
                        whileHover={{ scale: 1.05, borderColor: D.primary }} whileTap={{ scale: 0.95 }}>
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <Camera size={22} color={D.textDim} />
                            <span style={{ fontSize: 8, color: D.textDim, fontWeight: 600, textTransform: 'uppercase' }}>Фото</span>
                          </div>
                        )}
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
                          <Camera size={20} color="#fff" />
                        </div>
                      </motion.div>
                      <input id="reg-avatar-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatar(f); }} />
                      {avatarPreview && (
                        <motion.button onClick={() => { setAvatarFile(null); setAvatarPreview(null); if (originalImageSrc) { URL.revokeObjectURL(originalImageSrc); setOriginalImageSrc(null); } }} style={{ background: 'none', border: 'none', color: D.error, fontSize: 11, cursor: 'pointer', fontFamily: "'Inter',sans-serif", marginTop: -4, marginBottom: 8 }}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.05 }}>Убрать фото</motion.button>
                      )}
                      <FloatingInput icon={<User size={18} color={D.primary} />} value={displayName} onChange={e => { setDisplayName(e.target.value.slice(0, 50)); playKeyboardSound(); }} placeholder="Ваше имя" autoFocus delay={0.1} />
                    </motion.div>
                    {/* Bio (optional) — merged into step 1 */}
                    <motion.div style={{ marginTop: 8 }}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <StickyNote size={18} color={D.primary} />
                        <span style={{ color: D.textDim, fontSize: 13, fontFamily: "'Inter',sans-serif" }}>О себе <span style={{ color: D.textDim, opacity: 0.5 }}>(необязательно)</span></span>
                      </div>
                      <textarea value={bio} onChange={e => { setBio(e.target.value.slice(0, 500)); playKeyboardSound(); }} placeholder="Расскажите о себе..." rows={3} maxLength={500}
                        style={{ width: '100%', padding: '12px 14px', background: D.input, border: `2px solid ${D.card}`, borderRadius: 10, color: D.textPrimary, fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', resize: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                        onFocus={e => (e.currentTarget.style.borderColor = D.primary)} onBlur={e => (e.currentTarget.style.borderColor = D.card)} />
                      <p style={{ color: D.textDim, fontSize: 11, textAlign: 'right', marginTop: 4 }}>{bio.length}/500</p>
                    </motion.div>
                    <motion.div style={{ display: 'flex', gap: 10, marginTop: 8 }}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                      <BtnSecondary onClick={switchMode}><ArrowLeft size={16} /> Войти</BtnSecondary>
                      <div style={{ flex: 1 }}><BtnPrimary onClick={nextStep}>Продолжить <ArrowRight size={16} /></BtnPrimary></div>
                    </motion.div>
                  </motion.div>
                )}

               {/* STEP 2 — Username */}
               {step === 2 && (
                 <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
                    <StepHeader stepLabel="Шаг 2 из 4" title="Идентификатор" subtitle="Уникальное имя в Нексо" />
                   <FloatingInput icon={<span style={{ color: D.primary, fontWeight: 700, fontSize: 16 }}>@</span>} value={username} onChange={e => { setUsername(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 17)); playKeyboardSound(); }} placeholder="username" autoFocus delay={0.1} />
                   <div style={{ height: 18, marginTop: -4, marginBottom: 8 }}>
                     <AnimatePresence>
                       {usernameStatus === 'available' && (
                         <motion.span style={{ fontSize: 11, color: D.success, display: 'flex', alignItems: 'center', gap: 3 }}
                           initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                           <CheckCircle2 size={11} color={D.success} /> Свободен
                         </motion.span>
                       )}
                       {usernameStatus === 'taken' && (
                         <motion.span style={{ fontSize: 11, color: D.error }}
                           initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>Занят</motion.span>
                       )}
                     </AnimatePresence>
                   </div>
                   <motion.div style={{ display: 'flex', gap: 10, marginTop: 16 }}
                     initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                     <BtnSecondary onClick={prevStep}><ArrowLeft size={16} /> Назад</BtnSecondary>
                     <div style={{ flex: 1 }}><BtnPrimary onClick={nextStep}>Продолжить <ArrowRight size={16} /></BtnPrimary></div>
                   </motion.div>
                 </motion.div>
               )}

                {/* STEP 3 — Email verification (was step 4) */}
                {step === 3 && (
                  <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
                    <StepHeader stepLabel="Шаг 3 из 4" title="Email" subtitle="Для входа и восстановления доступа" />
                   {!regEmailVerified ? (
                     <>
                        <FloatingInput icon={<MessageSquare size={18} color={D.primary} />} value={regEmail} onChange={e => { setRegEmail(e.target.value); setRegEmailCodeSent(false); setRegEmailVerified(false); setRegEmailCode(''); }} placeholder="Email" autoFocus delay={0.1} />
                        {/* Email availability indicator */}
                        {!regEmailCodeSent && !regEmailVerified && regEmail && regEmail.includes('@') && (
                          <div style={{ height: 18, marginTop: -8, marginBottom: 8 }}>
                            <AnimatePresence>
                              {regEmailStatus === 'checking' && (
                                <motion.span style={{ fontSize: 11, color: D.textDim, display: 'flex', alignItems: 'center', gap: 3 }}
                                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Проверяю...</motion.span>
                              )}
                              {regEmailStatus === 'available' && (
                                <motion.span style={{ fontSize: 11, color: D.success, display: 'flex', alignItems: 'center', gap: 3 }}
                                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                                  <CheckCircle2 size={11} color={D.success} /> Почта свободна
                                </motion.span>
                              )}
                              {regEmailStatus === 'taken' && (
                                <motion.span style={{ fontSize: 11, color: D.error }}
                                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>Этот email уже зарегистрирован</motion.span>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                       {!regEmailCodeSent ? (
                         <motion.div style={{ marginTop: 12 }}
                           initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                            <BtnPrimary onClick={sendRegEmailCode} loading={regEmailLoading} disabled={regEmailStatus === 'taken'}><MessageSquarePlus size={18} color="#fff" /> Отправить код</BtnPrimary>
                         </motion.div>
                       ) : (
                         <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                           <p style={{ color: D.textMuted, fontSize: 13, marginTop: 12, marginBottom: 16 }}>Код отправлен на {regEmail}</p>
                           <div style={{ marginBottom: 20 }}>
                              <OTPInput
                                length={6}
                                value={regEmailCode}
                                onChange={setRegEmailCode}
                                autoFocus
                                error={!!error}
                                success={regEmailVerified}
                              />
                           </div>
                            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                              <BtnSecondary onClick={() => { setRegEmailCodeSent(false); setRegEmailCode(''); }}><ArrowLeft size={16} /> Назад</BtnSecondary>
                              <div style={{ flex: 1 }}><BtnPrimary onClick={confirmRegEmailCode} loading={regEmailLoading} disabled={regEmailCode.length < 6}><ShieldCheck size={18} color="#fff" /> Подтвердить</BtnPrimary></div>
                            </div>
                           <div style={{ textAlign: 'center', marginTop: 12 }}>
                             {regEmailResendTimer > 0 ? (
                               <p style={{ color: D.textDim, fontSize: 12 }}>Повторно через {regEmailResendTimer}с</p>
                             ) : (
                               <motion.button onClick={sendRegEmailCode} style={{ background: 'none', border: 'none', color: D.primary, fontSize: 12, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}
                                 whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Отправить повторно</motion.button>
                             )}
                           </div>
                         </motion.div>
                       )}
                     </>
                   ) : (
                     <motion.div style={{ textAlign: 'center', padding: '16px 0' }}
                       initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', bounce: 0.4 }}>
                       <motion.div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(59,165,93,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}
                         initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}>
                         <CheckCircle2 size={28} color={D.success} />
                       </motion.div>
                       <p style={{ color: D.textPrimary, fontSize: 15, fontWeight: 600 }}>Email подтвержден!</p>
                       <p style={{ color: D.textMuted, fontSize: 13, marginTop: 4 }}>{regEmail}</p>
                     </motion.div>
                   )}
                   <Err msg={error} />
                   <motion.div style={{ display: 'flex', gap: 10, marginTop: 14 }}
                     initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                     <BtnSecondary onClick={prevStep}><ArrowLeft size={16} /> Назад</BtnSecondary>
                     <div style={{ flex: 1 }}>
                       <BtnPrimary onClick={nextStep} disabled={!regEmailVerified}>
                         Продолжить <ArrowRight size={16} />
                       </BtnPrimary>
                     </div>
                   </motion.div>
                 </motion.div>
               )}

                {/* STEP 4 — Notifications + Register */}
                {step === 4 && (
                  <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
                    <StepHeader stepLabel="Шаг 4 из 4" title="Уведомления" subtitle="Настройте оповещения" />
                    <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                     {[
                        { label: 'Сообщения', desc: 'Уведомления о новых сообщениях', value: notifMessages, setter: setNotifMessages, icon: <MessageSquarePlus size={18} color={notifMessages ? D.primary : D.textDim} /> },
                       { label: 'Звуки', desc: 'Звуковые оповещения', value: notifSound, setter: setNotifSound, icon: <Bell size={18} color={notifSound ? D.primary : D.textDim} /> },
                        { label: 'Превью', desc: 'Показывать текст в уведомлениях', value: notifPreview, setter: setNotifPreview, icon: <StickyNote size={18} color={notifPreview ? D.primary : D.textDim} /> },
                     ].map((item, i) => (
                       <motion.div key={item.label} onClick={() => item.setter(!item.value)}
                         whileHover={{ scale: 1.01, background: 'rgba(255,255,255,0.05)' }}
                         whileTap={{ scale: 0.99 }}
                         initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                         style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: item.value ? 'rgba(123,97,255,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${item.value ? 'rgba(123,97,255,0.25)' : D.glassBorder}`, borderRadius: 14, cursor: 'pointer', transition: 'all 0.25s', backdropFilter: 'blur(8px)' }}>
                         {item.icon}
                         <div style={{ flex: 1 }}>
                           <p style={{ color: D.textPrimary, fontSize: 14, fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>{item.label}</p>
                           <p style={{ color: D.textDim, fontSize: 12, fontFamily: "'Inter',sans-serif" }}>{item.desc}</p>
                         </div>
                         <motion.div animate={{ background: item.value ? D.primary : '#3f4147' }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            style={{ width: 44, height: 24, borderRadius: 12, padding: 2, cursor: 'pointer', display: 'flex', alignItems: item.value ? 'center' : 'center', justifyContent: item.value ? 'flex-end' : 'flex-start', transition: 'background 0.2s' }}>
                            <motion.div layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                         </motion.div>
                        </motion.div>
                      ))}
                    </motion.div>
                    <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${acceptedLegal ? 'rgba(123,97,255,0.35)' : D.glassBorder}`, borderRadius: 14, cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
                        <input
                          type="checkbox"
                          checked={acceptedLegal}
                          onChange={e => setAcceptedLegal(e.target.checked)}
                          style={{ marginTop: 3, accentColor: D.primary }}
                        />
                        <span style={{ color: D.textMuted, fontSize: 12, lineHeight: 1.5, fontFamily: "'Inter',sans-serif" }}>
                          Я принимаю <LegalLink onClick={() => setLegalPage('terms')}>Пользовательское соглашение</LegalLink>, <LegalLink onClick={() => setLegalPage('privacy')}>Политику конфиденциальности</LegalLink>, <LegalLink onClick={() => setLegalPage('cookies')}>Политику использования печенек</LegalLink>, <LegalLink onClick={() => setLegalPage('offer')}>Публичную оферту</LegalLink> и даю <LegalLink onClick={() => setLegalPage('personal-data')}>согласие на обработку персональных данных</LegalLink>.
                        </span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: marketingConsent ? 'rgba(123,97,255,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${marketingConsent ? 'rgba(123,97,255,0.25)' : D.glassBorder}`, borderRadius: 14, cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
                        <input
                          type="checkbox"
                          checked={marketingConsent}
                          onChange={e => setMarketingConsent(e.target.checked)}
                          style={{ marginTop: 3, accentColor: D.primary }}
                        />
                        <span style={{ color: D.textMuted, fontSize: 12, lineHeight: 1.5, fontFamily: "'Inter',sans-serif" }}>
                          Хочу получать рекламную рассылку, новости и предложения Нексо. Это необязательно, согласие можно отозвать. <LegalLink onClick={() => setLegalPage('marketing')}>Подробнее</LegalLink>.
                        </span>
                      </label>
                    </motion.div>
                    <Err msg={error} />
                    <motion.div style={{ display: 'flex', gap: 10, marginTop: 14 }}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                     <BtnSecondary onClick={prevStep}><ArrowLeft size={16} /> Назад</BtnSecondary>
                      <div style={{ flex: 1 }}>
                        <BtnPrimary onClick={handleRegister} loading={submitting} disabled={!acceptedLegal}>
                          <Sparkles size={18} color="#fff" /> Зарегистрироваться
                        </BtnPrimary>
                      </div>
                   </motion.div>
                 </motion.div>
               )}

             </motion.div>
           </AnimatePresence>
           </>
         )}
      <div style={{ marginTop: 16 }}>
        <ModeToggle mode={mode} onSwitch={switchMode} />
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: '6px 10px', justifyContent: 'center', color: D.textDim, fontSize: 11, lineHeight: 1.4, fontFamily: "'Inter',sans-serif" }}>
        <LegalLink onClick={() => setLegalPage('terms')}>Соглашение</LegalLink>
        <LegalLink onClick={() => setLegalPage('privacy')}>Конфиденциальность</LegalLink>
        <LegalLink onClick={() => setLegalPage('cookies')}>Печеньки</LegalLink>
        <LegalLink onClick={() => setLegalPage('offer')}>Оферта</LegalLink>
        <LegalLink onClick={() => setLegalPage('personal-data')}>Персональные данные</LegalLink>
        <LegalLink onClick={() => setLegalPage('marketing')}>Рекламная рассылка</LegalLink>
      </div>
    </div>
  );

  // ═══════ MAIN RENDER ═══════
  if (legalPage) {
    return <LegalPage type={legalPage} onClose={() => setLegalPage(null)} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: D.bg, padding: isMobile ? 16 : 24, position: 'relative', overflow: 'hidden' }}>
      <Bg />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="glass-auth"
        style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: isMobile ? 480 : 760,
          borderRadius: isMobile ? 18 : 22,
          overflow: 'hidden', display: isMobile ? 'block' : 'flex',
        }}>
        {/* Left: branding — ALWAYS on left, never swaps */}
        {!isMobile && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', position: 'relative', background: 'rgba(88,101,242,0.02)', minHeight: FORM_MIN_HEIGHT + 80 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse at 50% 30%, rgba(123,97,255,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} style={{ position: 'relative', textAlign: 'center' }}>
              <div style={{ position: 'relative', marginBottom: 20, display: 'inline-block' }}>
                <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.3, 0.2] }} transition={{ duration: 4, repeat: Infinity }}
                  style={{ position: 'absolute', inset: -20, borderRadius: 44, background: 'linear-gradient(135deg, #7B61FF, #8b5cf6, #a855f7)', filter: 'blur(24px)' }} />
                <motion.img src="/logo.png" alt="Нексо"
                  style={{ position: 'relative', width: 88, height: 88, borderRadius: 24, objectFit: 'cover', boxShadow: '0 0 60px rgba(123,97,255,0.35), 0 25px 60px rgba(0,0,0,0.5)' }}
                  initial={{ rotate: -180, scale: 0 }} animate={{ rotate: 0, scale: 1 }}
                  transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }} />
              </div>
              <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 6, letterSpacing: '-0.04em', background: 'linear-gradient(135deg, #fff, #cdbdff, #7B61FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: "'Inter',sans-serif" }}>
                Нексо
              </h1>
              <p style={{ color: D.textDim, fontSize: 13, letterSpacing: '0.06em', fontFamily: "'Inter',sans-serif", maxWidth: 220, margin: '0 auto' }}>
                Безопасный мессенджер нового поколения
              </p>
            </motion.div>
          </div>
        )}

        {/* Right: form — ALWAYS on right, never swaps, fixed min-height */}
        <div style={{ width: isMobile ? '100%' : undefined, flex: isMobile ? undefined : 1.2, display: 'flex', flexDirection: 'column', minHeight: isMobile ? undefined : FORM_MIN_HEIGHT + 80, justifyContent: 'center' }}>
          {/* Logo on mobile only (desktop has left branding panel) */}
          {isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0 4px' }}>
              <motion.img src="/logo.png" alt="Нексо"
                style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', boxShadow: '0 0 30px rgba(123,97,255,0.35)' }}
                initial={{ rotate: -180, scale: 0 }} animate={{ rotate: 0, scale: 1 }}
                transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }} />
              <h1 style={{ fontSize: 20, fontWeight: 800, marginTop: 8, color: D.textPrimary, fontFamily: "'Inter',sans-serif" }}>Нексо</h1>
            </div>
          )}
          {formPanel}
        </div>
      </motion.div>
      <ImageCropper open={cropperOpen} imageSrc={cropperSrc} shape="circle" onCrop={handleAvatarCropped} onClose={() => setCropperOpen(false)} />
    </div>
  );
}

function Bg() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <motion.div animate={{ scale: [1, 1.25, 1], opacity: [0.08, 0.16, 0.08] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '25%', left: '33%', width: 450, height: 450, borderRadius: '50%', background: '#7B61FF', filter: 'blur(130px)' }} />
      <motion.div animate={{ scale: [1, 1.18, 1], opacity: [0.05, 0.1, 0.05] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{ position: 'absolute', bottom: '25%', right: '33%', width: 380, height: 380, borderRadius: '50%', background: '#8b5cf6', filter: 'blur(110px)' }} />
      <motion.div animate={{ scale: [1, 1.12, 1], opacity: [0.04, 0.08, 0.04] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 320, height: 320, borderRadius: '50%', background: '#a855f7', filter: 'blur(90px)' }} />
    </div>
  );
}
