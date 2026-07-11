import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import {
  Eye, EyeOff, ArrowRight, ArrowLeft, Camera, Check,
  User, FileText, Loader2, X, Fingerprint, KeyRound,
  Repeat, Rocket, Mail, AtSign,
} from 'lucide-react';
import { playKeyboardSound } from '../lib/sounds';
import QRCode from '../lib/qrcode';
import { useResponsive } from '../hooks/useResponsive';


const D = {
  bg: '#0e0f12', card: '#1e1f22', input: '#141518',
  primary: '#5865f2', primaryHover: '#4752c4',
  success: '#3ba55d', error: '#ed4245', warning: '#faa61a',
  textPrimary: '#f2f3f5', textSecondary: '#b5bac1',
  textMuted: '#949ba4', textDim: '#4e5058',
  border: 'rgba(255,255,255,0.03)',
} as const;

type AuthMode = 'login' | 'register';
type RegisterStep = 1 | 2 | 3;
type LoginStep = 'credentials' | 'code';

function pwStrength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++; if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++; if (/[^a-zA-Z0-9]/.test(pw)) s++;
  let l: 'weak' | 'medium' | 'strong' | 'very-strong' = 'weak';
  if (s >= 5) l = 'very-strong'; else if (s >= 4) l = 'strong'; else if (s >= 3) l = 'medium';
  return { score: Math.min(s, 4), level: l };
}

function PwBar({ pw }: { pw: string }) {
  const s = pwStrength(pw);
  const lb: Record<string, string> = { weak: 'Слабый', medium: 'Средний', strong: 'Хороший', 'very-strong': 'Отличный!' };
  const cl: Record<string, string> = { weak: D.error, medium: D.warning, strong: D.success, 'very-strong': D.primary };
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, height: 4 }}>
        {[0,1,2,3].map(i => <div key={i} style={{ flex: 1, borderRadius: 4, background: i < s.score ? cl[s.level] : '#3f4147', transition: '0.3s' }} />)}
      </div>
      <div style={{ color: pw.length > 0 ? cl[s.level] : D.textDim, fontSize: 12, marginTop: 4, fontFamily: "'Inter',sans-serif" }}>
        {pw.length > 0 ? lb[s.level] : 'Введите пароль'}
      </div>
    </div>
  );
}

function Steps({ cur, total }: { cur: number; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: n === cur ? 32 : 12, height: 12,
              borderRadius: 6,
              background: n < cur ? D.success : n === cur ? D.primary : '#3f4147',
              boxShadow: n === cur ? '0 0 20px rgba(88,101,242,0.3)' : 'none',
              transition: 'all 0.4s',
            }} />
            {i < total - 1 && <div style={{ width: 20, height: 3, borderRadius: 2, background: n < cur ? D.primary : '#3f4147' }} />}
          </div>
        );
      })}
    </div>
  );
}

function Inp({
  icon, type = 'text', value, onChange, placeholder, autoFocus, right, onKeyDown, autoComplete, disabled,
}: {
  icon: React.ReactNode; type?: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; autoFocus?: boolean; right?: React.ReactNode; onKeyDown?: (e: React.KeyboardEvent) => void;
  autoComplete?: string; disabled?: boolean;
}) {
  const [f, setF] = useState(false);
  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'center', background: D.input,
        border: `2px solid ${f ? D.primary : D.card}`, borderRadius: 8, transition: 'all 0.2s',
        boxShadow: f ? '0 0 0 3px rgba(88,101,242,0.1)' : 'none',
      }}>
        <span style={{ position: 'absolute', left: 14, color: f ? D.primary : D.textDim, transition: '0.2s', pointerEvents: 'none' }}>{icon}</span>
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} autoFocus={autoFocus}
          onKeyDown={onKeyDown} autoComplete={autoComplete} disabled={disabled}
          onFocus={() => setF(true)} onBlur={() => setF(false)}
          style={{
            width: '100%', padding: '12px 12px 12px 44px', background: 'transparent',
            border: 'none', outline: 'none', color: D.textPrimary, fontSize: 15,
            fontFamily: "'Inter',sans-serif", opacity: disabled ? 0.5 : 1,
          }}
        />
        {right && <div style={{ position: 'absolute', right: 12 }}>{right}</div>}
      </div>
    </div>
  );
}

function TogPw({ onClick, vis }: { onClick: () => void; vis: boolean }) {
  return (
    <button type="button" onClick={onClick} style={{ background: 'none', border: 'none', color: D.textDim, cursor: 'pointer', padding: 4, transition: '0.2s' }}
      onMouseEnter={e => (e.currentTarget.style.color = D.textSecondary)}
      onMouseLeave={e => (e.currentTarget.style.color = D.textDim)}>
      {vis ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
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

function AvatarUp({ preview, onUp, onRem }: { preview: string | null; onUp: (f: File) => void; onRem: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, margin: '8px 0 14px' }}>
      <div onClick={() => ref.current?.click()} style={{
        width: 72, height: 72, borderRadius: '50%', background: '#2b2d31',
        border: `3px solid ${preview ? D.primary : '#3f4147'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', cursor: 'pointer', transition: '0.3s',
      }}>
        {preview ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <Camera size={24} color={D.textDim} />
            <span style={{ fontSize: 8, color: D.textDim, fontWeight: 600, textTransform: 'uppercase' }}>Загрузить</span>
          </div>}
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onUp(f); }} />
      {preview && <button onClick={onRem} style={{ background: 'none', border: 'none', color: D.error, fontSize: 12, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Убрать</button>}
    </div>
  );
}

function BtnPrimary({ children, onClick, disabled, loading }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <motion.button onClick={onClick} disabled={disabled || loading}
      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
      style={{
        width: '100%', padding: 14, border: 'none', borderRadius: 8,
        background: loading ? '#4752c4' : D.primary, color: '#fff',
        fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        opacity: disabled ? 0.5 : 1, boxShadow: '0 4px 20px rgba(88,101,242,0.2)',
      }}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : children}
    </motion.button>
  );
}

function BtnSecondary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: 14, borderRadius: 8, background: 'transparent',
      color: D.textSecondary, border: '1px solid #3f4147',
      fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 600,
      cursor: 'pointer', transition: 'all 0.2s',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    }}
      onMouseEnter={e => { e.currentTarget.style.background = '#2b2d31'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </button>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [step, setStep] = useState<RegisterStep>(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { isMobile } = useResponsive();
  const { login, loginConfirm, register, user } = useAuthStore();

  // ─── Login state ───────────────────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginShowPw, setLoginShowPw] = useState(false);
  const [loginStep, setLoginStep] = useState<LoginStep>('credentials');
  const [loginCode, setLoginCode] = useState('');
  const [loginCodeResendTimer, setLoginCodeResendTimer] = useState(0);

  // ─── Register state ────────────────────────────────────────────────────
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Register email verification (step 3)
  const [regEmail, setRegEmail] = useState('');
  const [regEmailCode, setRegEmailCode] = useState('');
  const [regEmailCodeSent, setRegEmailCodeSent] = useState(false);
  const [regEmailVerified, setRegEmailVerified] = useState(false);
  const [regEmailLoading, setRegEmailLoading] = useState(false);
  const [regEmailResendTimer, setRegEmailResendTimer] = useState(0);



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

  useEffect(() => setError(''), [mode]);
  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); }, []);
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
    if (loginPw.length < 6) { setError('Пароль минимум 6 символов'); return; }
    setSubmitting(true);
    try {
      const result = await login(loginEmail, loginPw);
      if (result.requiresCode) {
        setLoginStep('code');
        setLoginCodeResendTimer(60);
      }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Ошибка входа'); }
    finally { setSubmitting(false); }
  };

  const handleLoginConfirm = async () => {
    if (!loginCode || loginCode.length !== 6) { setError('Введите 6-значный код'); return; }
    setSubmitting(true);
    try { await loginConfirm(loginEmail, loginCode); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Ошибка подтверждения'); }
    finally { setSubmitting(false); }
  };

  const resendLoginCode = async () => {
    setSubmitting(true); setError('');
    try {
      await login(loginEmail, loginPw);
      setLoginCodeResendTimer(60);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Ошибка отправки'); }
    finally { setSubmitting(false); }
  };

  // ─── Register handlers ─────────────────────────────────────────────────
  const handleAvatar = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError('Файл не более 10MB'); return; }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); setError('');
  };

  const sendRegEmailCode = async () => {
    if (!regEmail || !regEmail.includes('@') || !regEmail.includes('.')) { setError('Введите корректный email'); return; }
    setRegEmailLoading(true); setError('');
    try {
      await api.sendEmailCode(regEmail);
      setRegEmailCodeSent(true); setRegEmailResendTimer(60);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Ошибка отправки'); }
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

  const val1 = (): boolean => {
    if (username.length < 3) { setError('Минимум 3 символа'); return false; }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) { setError('Только латиница, цифры и -_.'); return false; }
    if (usernameStatus === 'taken') { setError('Username занят'); return false; }
    if (displayName.trim().length === 0) { setError('Введите имя'); return false; }
    return true;
  };
  const val2 = (): boolean => {
    if (password.length < 6) { setError('Пароль минимум 6 символов'); return false; }
    if (password !== confirmPw) { setError('Пароли не совпадают'); return false; }
    if (pwStrength(password).score < 2) { setError('Пароль слишком слабый'); return false; }
    return true;
  };

  const nextStep = () => { setError(''); if (step === 1 && val1()) setStep(2); else if (step === 2 && val2()) setStep(3); };
  const prevStep = () => { setError(''); if (step > 1) setStep(step - 1 as RegisterStep); };

  const handleRegister = async () => {
    if (!regEmailVerified) { setError('Подтвердите email'); return; }
    setError(''); setSubmitting(true);
    try {
      await register({ username, displayName: displayName || username, password, bio: bio || undefined, avatar: avatarFile || undefined });
      setShowSuccess(true);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Ошибка регистрации'); }
    finally { setSubmitting(false); }
  };

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login');
    setStep(1); setError('');
    setLoginStep('credentials'); setLoginCode(''); setLoginCodeResendTimer(0);
    setRegEmailCodeSent(false); setRegEmailVerified(false); setRegEmailCode('');
  };

  // ─── QR ────────────────────────────────────────────────────────────────
  const genToken = () => { const a = new Uint8Array(32); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); };
  const [deviceToken, setDeviceToken] = useState(genToken);
  const deviceLink = `${window.location.origin}/device?device=${deviceToken}`;
  const [qrUrl, setQrUrl] = useState('');
  const [qrStatus, setQrStatus] = useState<'waiting' | 'scanned' | 'confirmed' | 'denied' | 'expired'>('waiting');
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const regenQR = () => { setDeviceToken(genToken()); setQrStatus('waiting'); };

  useEffect(() => {
    api.post('/auth/device/init', { token: deviceToken }).catch(() => {});
    try { const url = QRCode.toDataURL(deviceLink, { width: 256, margin: 2, color: { dark: '#000000', light: '#ffffff' } }); setQrUrl(url || ''); } catch {}
  }, [deviceLink, deviceToken]);

  useEffect(() => {
    if (user) return;
    const start = Date.now();
    qrPollRef.current = setInterval(async () => {
      if (Date.now() - start > 5 * 60 * 1000) { clearInterval(qrPollRef.current!); regenQR(); return; }
      try {
        const r: any = await api.get(`/auth/device/check?device=${deviceToken}`);
        if (!r) return;
        if (r.scanned) setQrStatus('scanned');
        if (r.confirmed && r.user) { clearInterval(qrPollRef.current!); setQrStatus('confirmed'); try { useAuthStore.getState().loginWithToken(r.accessToken || '', r.user); } catch {} }
        else if (r.denied) { clearInterval(qrPollRef.current!); setQrStatus('denied'); }
      } catch {}
    }, 2000);
    return () => { if (qrPollRef.current) clearInterval(qrPollRef.current); };
  }, [deviceToken, user]);

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
    <div style={{ width: '100%', maxWidth: isMobile ? '100%' : 420, padding: isMobile ? '32px 24px' : '40px 36px 32px' }}>
      {mode === 'login' ? (
        <>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'inline-block', background: 'rgba(88,101,242,0.1)', color: D.primary, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, padding: '4px 14px', borderRadius: 50, marginBottom: 8 }}>
              {loginStep === 'credentials' ? 'Вход' : 'Подтверждение'}
            </div>
            <h2 style={{ color: D.textPrimary, fontSize: 20, fontWeight: 700 }}>
              {loginStep === 'credentials' ? 'Вход в Нексо' : 'Введите код'}
            </h2>
            <p style={{ color: D.textMuted, fontSize: 14, marginTop: 4 }}>
              {loginStep === 'credentials' ? 'Рады видеть вас снова!' : `Код отправлен на ${loginEmail}`}
            </p>
          </div>

          {loginStep === 'credentials' ? (
            <>
              <Inp icon={<Mail size={16} />} value={loginEmail} onChange={e => { setLoginEmail(e.target.value); playKeyboardSound(); }} placeholder="Email" autoFocus autoComplete="email" onKeyDown={e => e.key === 'Enter' && loginPw && handleLogin()} />
              <Inp icon={<KeyRound size={16} />} type={loginShowPw ? 'text' : 'password'} value={loginPw} onChange={e => setLoginPw(e.target.value)} placeholder="Пароль" autoComplete="current-password" onKeyDown={e => e.key === 'Enter' && handleLogin()} right={<TogPw onClick={() => setLoginShowPw(!loginShowPw)} vis={loginShowPw} />} />
              <Err msg={error} />
              <div style={{ marginTop: 16 }}><BtnPrimary onClick={handleLogin} loading={submitting}><Check size={16} /> Войти</BtnPrimary></div>
              <div style={{ textAlign: 'center', marginTop: 20, color: D.textMuted, fontSize: 14 }}>
                Нет аккаунта? <span onClick={switchMode} style={{ color: D.primary, fontWeight: 600, cursor: 'pointer' }}>Зарегистрироваться</span>
              </div>
            </>
          ) : (
            <>
              <Inp icon={<AtSign size={16} />} value={loginCode} onChange={e => setLoginCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Код подтверждения" autoFocus onKeyDown={e => e.key === 'Enter' && handleLoginConfirm()} />
              <Err msg={error} />
              <div style={{ marginTop: 16 }}><BtnPrimary onClick={handleLoginConfirm} loading={submitting}><Check size={16} /> Подтвердить</BtnPrimary></div>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                {loginCodeResendTimer > 0 ? (
                  <p style={{ color: D.textDim, fontSize: 12 }}>Повторно через {loginCodeResendTimer}с</p>
                ) : (
                  <button onClick={resendLoginCode} style={{ background: 'none', border: 'none', color: D.primary, fontSize: 12, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Отправить код повторно</button>
                )}
              </div>
              <div style={{ marginTop: 16 }}>
                <BtnSecondary onClick={() => { setLoginStep('credentials'); setLoginCode(''); setError(''); }}><ArrowLeft size={16} /> Назад к email</BtnSecondary>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ display: 'inline-block', background: 'rgba(88,101,242,0.1)', color: D.primary, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, padding: '4px 14px', borderRadius: 50, marginBottom: 8 }}>
              Шаг {step} из 3
            </div>
            <h2 style={{ color: D.textPrimary, fontSize: 20, fontWeight: 700 }}>
              {step === 1 ? 'Ваш профиль' : step === 2 ? 'Пароль' : 'Email'}
            </h2>
            <p style={{ color: D.textMuted, fontSize: 14, marginTop: 4 }}>
              {step === 1 ? 'Как вас увидят другие' : step === 2 ? 'Придумайте надежный пароль' : 'Для восстановления доступа'}
            </p>
          </div>
          <Steps cur={step} total={3} />
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
              {step === 1 && (
                <div>
                  {/* Profile card — avatar, name, username all-in-one */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '28px 20px 20px', marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {/* Avatar — click to upload */}
                    <div onClick={() => document.getElementById('reg-avatar-input')?.click()} style={{ position: 'relative', width: 72, height: 72, borderRadius: '50%', border: `3px solid ${avatarPreview ? D.primary : '#3f4147'}`, background: '#2b2d31', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.3s', marginBottom: 16 }}>
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <Camera size={22} color={D.textDim} />
                          <span style={{ fontSize: 8, color: D.textDim, fontWeight: 600, textTransform: 'uppercase' }}>Фото</span>
                        </div>
                      )}
                      {/* Upload overlay on hover */}
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
                        <Camera size={20} color="#fff" />
                      </div>
                    </div>
                    <input id="reg-avatar-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatar(f); }} />
                    {avatarPreview && (
                      <button onClick={() => { setAvatarFile(null); setAvatarPreview(null); }} style={{ background: 'none', border: 'none', color: D.error, fontSize: 11, cursor: 'pointer', fontFamily: "'Inter',sans-serif", marginTop: -8, marginBottom: 12 }}>Убрать фото</button>
                    )}

                    {/* Editable display name */}
                    <input type="text" value={displayName} onChange={e => { setDisplayName(e.target.value.slice(0, 50)); playKeyboardSound(); }} placeholder="Ваше имя"
                      style={{ width: '100%', maxWidth: 260, background: 'transparent', border: 'none', outline: 'none', color: D.textPrimary, fontSize: 18, fontWeight: 700, fontFamily: "'Inter',sans-serif", textAlign: 'center', padding: '4px 8px', borderRadius: 6, transition: 'background 0.2s' }}
                      onFocus={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                      onBlur={e => (e.currentTarget.style.background = 'transparent')} />

                    {/* Editable username with @ */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 4 }}>
                      <span style={{ color: D.textDim, fontSize: 14, fontFamily: "'Inter',sans-serif", fontWeight: 500 }}>@</span>
                      <input type="text" value={username} onChange={e => { setUsername(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 17)); playKeyboardSound(); }} placeholder="username"
                        style={{ width: 120, background: 'transparent', border: 'none', outline: 'none', color: D.textMuted, fontSize: 14, fontFamily: "'Inter',sans-serif", fontWeight: 500, padding: '2px 4px', borderRadius: 4, transition: 'background 0.2s' }}
                        onFocus={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                        onBlur={e => (e.currentTarget.style.background = 'transparent')} />
                    </div>

                    {/* Username status */}
                    <div style={{ height: 18, marginTop: 4 }}>
                      {usernameStatus === 'available' && <span style={{ fontSize: 11, color: D.success, display: 'flex', alignItems: 'center', gap: 3 }}><Check size={11} /> Свободен</span>}
                      {usernameStatus === 'taken' && <span style={{ fontSize: 11, color: D.error }}>Занят</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <BtnSecondary onClick={switchMode}><ArrowLeft size={16} /> Войти</BtnSecondary>
                    <div style={{ flex: 1 }}><BtnPrimary onClick={nextStep}>Продолжить <ArrowRight size={16} /></BtnPrimary></div>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div>
                  <Inp icon={<KeyRound size={16} />} type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); playKeyboardSound(); }} placeholder="Придумайте пароль" autoFocus right={<TogPw onClick={() => setShowPw(!showPw)} vis={showPw} />} />
                  <PwBar pw={password} />
                  <Inp icon={<Repeat size={16} />} type={showPw2 ? 'text' : 'password'} value={confirmPw} onChange={e => { setConfirmPw(e.target.value); playKeyboardSound(); }} placeholder="Повторите пароль" right={<TogPw onClick={() => setShowPw2(!showPw2)} vis={showPw2} />} />
                  {confirmPw && password !== confirmPw && <p style={{ color: D.error, fontSize: 12, marginTop: -8, marginBottom: 8 }}>Пароли не совпадают</p>}
                  <div style={{ marginTop: 14 }}>
                    <textarea value={bio} onChange={e => { setBio(e.target.value.slice(0, 500)); playKeyboardSound(); }} placeholder="О себе..." rows={2} maxLength={500}
                      style={{ width: '100%', padding: '12px 14px', background: D.input, border: `2px solid ${D.card}`, borderRadius: 8, color: D.textPrimary, fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', resize: 'none', transition: 'border-color 0.2s' }}
                      onFocus={e => (e.currentTarget.style.borderColor = D.primary)} onBlur={e => (e.currentTarget.style.borderColor = D.card)} />
                    <p style={{ color: D.textDim, fontSize: 11, textAlign: 'right', marginTop: 4 }}>{bio.length}/500</p>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <BtnSecondary onClick={prevStep}><ArrowLeft size={16} /> Назад</BtnSecondary>
                    <div style={{ flex: 1 }}><BtnPrimary onClick={nextStep}>Продолжить <ArrowRight size={16} /></BtnPrimary></div>
                  </div>
                </div>
              )}
              {step === 3 && (
                <div>
                  {!regEmailVerified ? (
                    <>
                      <Inp icon={<Mail size={16} />} value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="Email" autoFocus />
                      {!regEmailCodeSent ? (
                        <div style={{ marginTop: 12 }}><BtnPrimary onClick={sendRegEmailCode} loading={regEmailLoading}><Mail size={16} /> Отправить код</BtnPrimary></div>
                      ) : (
                        <>
                          <p style={{ color: D.textMuted, fontSize: 13, marginTop: 12, marginBottom: 8 }}>Код отправлен на {regEmail}</p>
                          <Inp icon={<AtSign size={16} />} value={regEmailCode} onChange={e => setRegEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoFocus onKeyDown={e => e.key === 'Enter' && confirmRegEmailCode()} />
                          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                            <BtnSecondary onClick={() => { setRegEmailCodeSent(false); setRegEmailCode(''); }}><ArrowLeft size={16} /> Назад</BtnSecondary>
                            <div style={{ flex: 1 }}><BtnPrimary onClick={confirmRegEmailCode} loading={regEmailLoading}><Check size={16} /> Подтвердить</BtnPrimary></div>
                          </div>
                          <div style={{ textAlign: 'center', marginTop: 12 }}>
                            {regEmailResendTimer > 0 ? (
                              <p style={{ color: D.textDim, fontSize: 12 }}>Повторно через {regEmailResendTimer}с</p>
                            ) : (
                              <button onClick={sendRegEmailCode} style={{ background: 'none', border: 'none', color: D.primary, fontSize: 12, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Отправить повторно</button>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(59,165,93,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <Check size={28} color={D.success} />
                      </div>
                      <p style={{ color: D.textPrimary, fontSize: 15, fontWeight: 600 }}>Email подтвержден!</p>
                      <p style={{ color: D.textMuted, fontSize: 13, marginTop: 4 }}>{regEmail}</p>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <BtnSecondary onClick={prevStep}><ArrowLeft size={16} /> Назад</BtnSecondary>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginTop: 0 }}>
                        <BtnPrimary onClick={handleRegister} disabled={!regEmailVerified} loading={submitting}>
                          <Rocket size={16} /> Зарегистрироваться
                        </BtnPrimary>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          <Err msg={error} />
          <div style={{ textAlign: 'center', marginTop: 16, color: D.textMuted, fontSize: 14 }}>
            Уже есть аккаунт? <span onClick={switchMode} style={{ color: D.primary, fontWeight: 600, cursor: 'pointer' }}>Войти</span>
          </div>
        </>
      )}
    </div>
  );

  // ═══════ QR PANEL (desktop only) ═══════
  const qrPanel = !isMobile && mode === 'login' && (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 36px', minWidth: 280, borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
      <p style={{ color: D.textMuted, fontSize: 13, marginBottom: 16 }}>
        {qrStatus === 'waiting' ? 'Отсканируйте QR' : qrStatus === 'scanned' ? 'Подтвердите...' : qrStatus === 'confirmed' ? 'Готово!' : qrStatus === 'denied' ? 'Отклонено' : 'Истёк'}
      </p>
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', boxShadow: qrStatus === 'confirmed' ? '0 0 0 2px rgba(59,165,93,0.7)' : qrStatus === 'scanned' ? '0 0 0 2px rgba(168,85,247,0.7)' : '0 0 0 1px rgba(88,101,242,0.3)' }}>
        {qrStatus === 'confirmed' ? (
          <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59,165,93,0.1)' }}><Check size={36} color={D.success} /></div>
        ) : qrUrl ? (
          <img src={qrUrl} alt="QR" style={{ width: 180, height: 180, display: 'block', imageRendering: 'pixelated', opacity: qrStatus === 'scanned' ? 0.3 : 1, filter: qrStatus === 'scanned' ? 'blur(3px)' : 'none', transition: 'all 0.4s' }} />
        ) : (
          <div style={{ width: 180, height: 180, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} color={D.textDim} className="animate-spin" /></div>
        )}
      </div>
      {(qrStatus === 'denied' || qrStatus === 'expired') && (
        <button onClick={regenQR} style={{ marginTop: 12, background: 'none', border: 'none', color: D.primary, fontSize: 12, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Попробовать снова</button>
      )}
    </div>
  );

  // ═══════ MAIN RENDER ═══════
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: D.bg, padding: isMobile ? 16 : 24, position: 'relative', overflow: 'hidden' }}>
      <Bg />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: isMobile ? 480 : 760,
          background: D.card, borderRadius: isMobile ? 16 : 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: `1px solid ${D.border}`,
          overflow: 'hidden', display: isMobile ? 'block' : 'flex',
        }}>
        {/* Left: branding (desktop only) */}
        {!isMobile && (
          <div style={{ flex: 1, order: mode === 'register' ? 1 : 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', position: 'relative', background: 'rgba(88,101,242,0.02)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse at 50% 30%, rgba(88,101,242,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} style={{ position: 'relative', textAlign: 'center' }}>
              <div style={{ position: 'relative', marginBottom: 20, display: 'inline-block' }}>
                <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.3, 0.2] }} transition={{ duration: 4, repeat: Infinity }}
                  style={{ position: 'absolute', inset: -20, borderRadius: 44, background: 'linear-gradient(135deg, #5865f2, #8b5cf6, #a855f7)', filter: 'blur(24px)' }} />
                <motion.img src="/logo.png" alt="Нексо"
                  style={{ position: 'relative', width: 88, height: 88, borderRadius: 24, objectFit: 'cover', boxShadow: '0 0 60px rgba(88,101,242,0.3), 0 25px 60px rgba(0,0,0,0.5)' }}
                  initial={{ rotate: -180, scale: 0 }} animate={{ rotate: 0, scale: 1 }}
                  transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }} />
              </div>
              <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 6, letterSpacing: '-0.04em', background: 'linear-gradient(135deg, #fff, #c7d2fe, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: "'Inter',sans-serif" }}>
                Нексо
              </h1>
              <p style={{ color: D.textDim, fontSize: 13, letterSpacing: '0.06em', fontFamily: "'Inter',sans-serif", maxWidth: 220, margin: '0 auto' }}>
                Безопасный мессенджер нового поколения
              </p>
            </motion.div>
          </div>
        )}

        {/* Right: form */}
        <div style={{ flex: isMobile ? undefined : 1.2, order: mode === 'register' ? 0 : 1, display: 'flex', flexDirection: 'column' }}>
          {/* Logo on mobile only (desktop has left branding panel) */}
          {isMobile && (
            <div style={{ textAlign: 'center', padding: isMobile ? '32px 0 8px' : '24px 0 4px' }}>
              <motion.img src="/logo.png" alt="Нексо"
                style={{ width: 64, height: 64, borderRadius: 18, objectFit: 'cover', boxShadow: '0 0 30px rgba(88,101,242,0.3)' }}
                initial={{ rotate: -180, scale: 0 }} animate={{ rotate: 0, scale: 1 }}
                transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }} />
            </div>
          )}
          {formPanel}
          {qrPanel}
        </div>
      </motion.div>
    </div>
  );
}

function Bg() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.06, 0.12, 0.06] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '25%', left: '33%', width: 400, height: 400, borderRadius: '50%', background: '#5865f2', filter: 'blur(120px)' }} />
      <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.04, 0.08, 0.04] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{ position: 'absolute', bottom: '25%', right: '33%', width: 350, height: 350, borderRadius: '50%', background: '#8b5cf6', filter: 'blur(100px)' }} />
      <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.03, 0.06, 0.03] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 300, height: 300, borderRadius: '50%', background: '#a855f7', filter: 'blur(80px)' }} />
    </div>
  );
}
