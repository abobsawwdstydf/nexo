import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { ArrowRight, Volume2, VolumeX } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════
const D = {
  bg: '#000000',
  primary: '#7B61FF',
  primaryGlow: 'rgba(123,97,255,0.4)',
  success: '#3ba55d',
  error: '#ed4245',
  textPrimary: '#ffffff',
  textMuted: 'rgba(255,255,255,0.4)',
  border: 'rgba(255,255,255,0.12)',
  inputBg: 'rgba(255,255,255,0.04)',
} as const;

const FONT = `'PreschoolPlayhouse', 'Caveat', cursive`;

// ═══════════════════════════════════════════════════════════════════════════
// WEB AUDIO — Apple-style sounds
// ═══════════════════════════════════════════════════════════════════════════
let audioCtx: AudioContext | null = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTypeClick(muted: boolean) {
  if (muted) return;
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    // Layer 1: crisp high click
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.connect(g1); g1.connect(ctx.destination);
    osc1.frequency.value = 2800 + Math.random() * 600;
    osc1.type = 'sine';
    g1.gain.setValueAtTime(0.045, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    osc1.start(t); osc1.stop(t + 0.025);
    // Layer 2: body click
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.connect(g2); g2.connect(ctx.destination);
    osc2.frequency.value = 1200 + Math.random() * 300;
    osc2.type = 'triangle';
    g2.gain.setValueAtTime(0.03, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
    osc2.start(t); osc2.stop(t + 0.018);
  } catch {}
}

function playEraseClick(muted: boolean) {
  if (muted) return;
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.value = 600 + Math.random() * 200;
    osc.type = 'triangle';
    g.gain.setValueAtTime(0.025, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    osc.start(t); osc.stop(t + 0.035);
  } catch {}
}

function playSuccessSound(muted: boolean) {
  if (muted) return;
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    // Apple-style ascending arpeggio: C5 E5 G5 C6
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const start = t + i * 0.09;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.07, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.start(start); osc.stop(start + 0.28);
      // harmonic overtone for warmth
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.connect(g2); g2.connect(ctx.destination);
      osc2.frequency.value = freq * 2;
      osc2.type = 'sine';
      g2.gain.setValueAtTime(0, start);
      g2.gain.linearRampToValueAtTime(0.02, start + 0.015);
      g2.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc2.start(start); osc2.stop(start + 0.2);
    });
  } catch {}
}

function playErrorSound(muted: boolean) {
  if (muted) return;
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    // Low thud + dissonant buzz
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.value = 180;
    osc.type = 'sine';
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t); osc.stop(t + 0.35);
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.connect(g2); g2.connect(ctx.destination);
    osc2.frequency.value = 130;
    osc2.type = 'sawtooth';
    g2.gain.setValueAtTime(0.03, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc2.start(t + 0.02); osc2.stop(t + 0.25);
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPING ANIMATION HOOK
// ═══════════════════════════════════════════════════════════════════════════
type TypingPhase = 'idle' | 'typing' | 'pausing' | 'erasing' | 'done';

function useTypingAnimation(
  text: string,
  opts: { typingSpeed?: number; eraseSpeed?: number; pauseAfter?: number; enabled?: boolean; muted?: boolean; noErase?: boolean; onType?: () => void; onErase?: () => void } = {}
) {
  const { typingSpeed = 75, eraseSpeed = 35, pauseAfter = 1500, enabled = true, muted = false, noErase = false, onType, onErase } = opts;
  const [display, setDisplay] = useState('');
  const [phase, setPhase] = useState<TypingPhase>('idle');
  const idxRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const clear = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    clear();
    if (!enabled || !text) { setDisplay(''); setPhase('idle'); return; }

    idxRef.current = 0;
    setDisplay('');
    setPhase('typing');

    const type = () => {
      if (idxRef.current < text.length) {
        idxRef.current++;
        setDisplay(text.slice(0, idxRef.current));
        onType?.();
        const t = window.setTimeout(type, typingSpeed + Math.random() * 20);
        timersRef.current.push(t);
      } else {
        if (noErase) {
          setPhase('done');
        } else {
          setPhase('pausing');
          const t = window.setTimeout(() => {
            setPhase('erasing');
            erase();
          }, pauseAfter);
          timersRef.current.push(t);
        }
      }
    };

    const erase = () => {
      if (idxRef.current > 0) {
        idxRef.current--;
        setDisplay(text.slice(0, idxRef.current));
        onErase?.();
        const t = window.setTimeout(erase, eraseSpeed);
        timersRef.current.push(t);
      } else {
        setPhase('done');
      }
    };

    const start = window.setTimeout(type, 300);
    timersRef.current.push(start);

    return clear;
  }, [text, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { display, phase };
}

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL AUTOCOMPLETE DATA
// ═══════════════════════════════════════════════════════════════════════════
const EMAIL_PROVIDERS = [
  'gmail.com', 'yandex.ru', 'yandex.com', 'outlook.com', 'outlook.ru',
  'mail.ru', 'icloud.com', 'yahoo.com', 'protonmail.com', 'proton.me',
  'zoho.com', 'aol.com', 'gmx.com', 'rambler.ru', 'inbox.ru',
  'mail.com', 'fastmail.com', 'hey.com', 'tutanota.com', 'list.ru',
];

// ═══════════════════════════════════════════════════════════════════════════
// OTP INPUT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  error,
  success,
  muted,
}: {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  error?: boolean;
  success?: boolean;
  muted: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (value.length === length) {
      onComplete(value);
    }
  }, [value, length, onComplete]);

  const handleChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[i] = digit;
    const next = arr.join('').slice(0, length);
    onChange(next);
    playTypeClick(muted);
    if (digit && i < length - 1) {
      inputRefs.current[i + 1]?.focus();
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasted);
    if (pasted.length === length) {
      inputRefs.current[length - 1]?.focus();
    } else {
      inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
    }
  };

  const borderColor = success ? D.success : error ? D.error : D.border;
  const glowColor = success ? 'rgba(59,165,93,0.3)' : error ? 'rgba(237,66,69,0.3)' : 'none';

  return (
    <motion.div
      style={{ display: 'flex', gap: 8, justifyContent: 'center' }}
      animate={error ? { x: [0, -6, 6, -4, 4, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {Array.from({ length }, (_, i) => (
        <motion.input
          key={i}
          ref={el => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          animate={success ? { borderColor: D.success, boxShadow: `0 0 20px ${glowColor}` } : error ? { borderColor: D.error, boxShadow: `0 0 20px ${glowColor}` } : { borderColor: D.border, boxShadow: 'none' }}
          transition={{ duration: 0.3 }}
          style={{
            width: 48,
            height: 56,
            borderRadius: 12,
            background: D.inputBg,
            border: `2px solid ${borderColor}`,
            color: D.textPrimary,
            fontSize: 24,
            fontWeight: 700,
            fontFamily: FONT,
            textAlign: 'center',
            outline: 'none',
            caretColor: D.primary,
          }}
        />
      ))}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN AUTH PAGE
// ═══════════════════════════════════════════════════════════════════════════
type Screen =
  | 'greeting'
  | 'welcome'
  | 'choose'
  | 'login-email'
  | 'login-code'
  | 'login-success'
  | 'login-error'
  | 'reg-name'
  | 'reg-username'
  | 'reg-email'
  | 'reg-code'
  | 'reg-success'
  | 'reg-error';

export default function AuthPage() {
  const { sendLoginCode, loginConfirm, register } = useAuthStore();
  const [muted, setMuted] = useState(false);
  const [screen, setScreen] = useState<Screen>('greeting');
  const [email, setEmail] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [otpError, setOtpError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [regEmail, setRegEmail] = useState('');
  const [regEmailDraft, setRegEmailDraft] = useState('');
  const emailInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const regEmailInputRef = useRef<HTMLInputElement>(null);

  // ─── Typing animations ─────────────────────────────────────────────────
  const greet = useTypingAnimation('Привет', { enabled: screen === 'greeting', muted, onType: () => playTypeClick(muted), onErase: () => playEraseClick(muted) });
  const welcome = useTypingAnimation('Добро пожаловать в Нексо', { enabled: screen === 'welcome', muted, onType: () => playTypeClick(muted), onErase: () => playEraseClick(muted) });
  const chooseLogin = useTypingAnimation('Войти', { enabled: screen === 'choose', muted, typingSpeed: 90, noErase: true, onType: () => playTypeClick(muted) });
  const chooseOr = useTypingAnimation(' или ', { enabled: screen === 'choose' && chooseLogin.phase === 'done', muted, typingSpeed: 60, noErase: true, onType: () => playTypeClick(muted) });
  const chooseReg = useTypingAnimation('зарегистрироваться', { enabled: screen === 'choose' && chooseOr.phase === 'done', muted, typingSpeed: 70, noErase: true, onType: () => playTypeClick(muted) });
  const chooseQuestion = useTypingAnimation('?', { enabled: screen === 'choose' && chooseReg.phase === 'done', muted, typingSpeed: 100, noErase: true, onType: () => playTypeClick(muted) });

  const loginEmailLabel = useTypingAnimation('Введи свой email', { enabled: screen === 'login-email', muted, onType: () => playTypeClick(muted) });
  const loginCodeLabel = useTypingAnimation('Введи код', { enabled: screen === 'login-code', muted, onType: () => playTypeClick(muted) });
  const loginSuccessText = useTypingAnimation('Вход выполнен', { enabled: screen === 'login-success', muted, onType: () => playTypeClick(muted) });

  const regNameLabel = useTypingAnimation('Как тебя зовут?', { enabled: screen === 'reg-name', muted, onType: () => playTypeClick(muted) });
  const regUsernameLabel = useTypingAnimation('Придумай username', { enabled: screen === 'reg-username', muted, onType: () => playTypeClick(muted) });
  const regEmailLabel = useTypingAnimation('Введи email', { enabled: screen === 'reg-email', muted, onType: () => playTypeClick(muted) });
  const regCodeLabel = useTypingAnimation('Введи код', { enabled: screen === 'reg-code', muted, onType: () => playTypeClick(muted) });
  const regSuccessText = useTypingAnimation('Регистрация завершена!', { enabled: screen === 'reg-success', muted, onType: () => playTypeClick(muted) });

  // ─── Phase transitions ──────────────────────────────────────────────────
  useEffect(() => {
    if (greet.phase === 'done' && screen === 'greeting') {
      setScreen('welcome');
    }
  }, [greet.phase, screen]);

  useEffect(() => {
    if (welcome.phase === 'done' && screen === 'welcome') {
      setScreen('choose');
    }
  }, [welcome.phase, screen]);

  // Focus email input when login-email appears
  useEffect(() => {
    if (screen === 'login-email' && loginEmailLabel.phase === 'done') {
      setTimeout(() => emailInputRef.current?.focus(), 100);
    }
  }, [screen, loginEmailLabel.phase]);

  // Focus name input when reg-name appears
  useEffect(() => {
    if (screen === 'reg-name' && regNameLabel.phase === 'done') {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [screen, regNameLabel.phase]);

  // Focus username input
  useEffect(() => {
    if (screen === 'reg-username' && regUsernameLabel.phase === 'done') {
      setTimeout(() => usernameInputRef.current?.focus(), 100);
    }
  }, [screen, regUsernameLabel.phase]);

  // Focus reg email input
  useEffect(() => {
    if (screen === 'reg-email' && regEmailLabel.phase === 'done') {
      setTimeout(() => regEmailInputRef.current?.focus(), 100);
    }
  }, [screen, regEmailLabel.phase]);

  // ─── Username check ─────────────────────────────────────────────────────
  useEffect(() => {
    if (username.length < 3 || !/^[a-zA-Z0-9_.-]+$/.test(username)) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      try { const r = await api.checkUsername(username); setUsernameStatus(r.available ? 'available' : 'taken'); }
      catch { setUsernameStatus('idle'); }
    }, 500);
    return () => clearTimeout(t);
  }, [username]);

  // ─── Login handlers ─────────────────────────────────────────────────────
  const handleSendLoginCode = async () => {
    if (!email || !email.includes('@')) return;
    setSubmitting(true); setError('');
    try {
      const result = await sendLoginCode(email);
      if (result.requiresCode) {
        setScreen('login-code');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally { setSubmitting(false); }
  };

  const handleLoginConfirm = useCallback(async (codeStr: string) => {
    setSubmitting(true); setError('');
    try {
      await loginConfirm(email, codeStr);
      playSuccessSound(muted);
      setScreen('login-success');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: unknown) {
      playErrorSound(muted);
      setError(err instanceof Error ? err.message : 'Неверный код');
      setOtpError(true);
      setScreen('login-error');
    } finally { setSubmitting(false); }
  }, [email, loginConfirm, muted]);

  // ─── Register handlers ──────────────────────────────────────────────────
  const handleRegisterEmail = async () => {
    if (!regEmail || !regEmail.includes('@')) return;
    setSubmitting(true); setError('');
    try {
      await api.sendEmailCode(regEmail);
      setScreen('reg-code');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally { setSubmitting(false); }
  };

  const handleRegisterConfirm = useCallback(async (codeStr: string) => {
    setSubmitting(true); setError('');
    try {
      await api.confirmEmailCode(regEmail, codeStr);
      // Now register
      await register({ username, displayName: name, email: regEmail });
      playSuccessSound(muted);
      setScreen('reg-success');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: unknown) {
      playErrorSound(muted);
      setError(err instanceof Error ? err.message : 'Ошибка');
      setOtpError(true);
      setScreen('reg-error');
    } finally { setSubmitting(false); }
  }, [regEmail, username, name, register, muted]);

  // ─── Email autocomplete ─────────────────────────────────────────────────
  const emailSuggestions = useMemo(() => {
    if (!emailDraft.includes('@') || emailDraft.endsWith('@')) return [];
    const [local, domain] = emailDraft.split('@');
    if (!domain) return [];
    return EMAIL_PROVIDERS
      .filter(p => p.startsWith(domain.toLowerCase()))
      .slice(0, 6)
      .map(p => `${local}@${p}`);
  }, [emailDraft]);

  const regEmailSuggestions = useMemo(() => {
    if (!regEmailDraft.includes('@') || regEmailDraft.endsWith('@')) return [];
    const [local, domain] = regEmailDraft.split('@');
    if (!domain) return [];
    return EMAIL_PROVIDERS
      .filter(p => p.startsWith(domain.toLowerCase()))
      .slice(0, 6)
      .map(p => `${local}@${p}`);
  }, [regEmailDraft]);

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: D.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: FONT,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Sound toggle */}
      <motion.button
        onClick={() => setMuted(m => !m)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 10,
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </motion.button>

      {/* ═══ GREETING ═══ */}
      <AnimatePresence mode="wait">
        {screen === 'greeting' && (
          <motion.div
            key="greeting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', textAlign: 'center' }}
          >
            <span style={{
              fontSize: 'clamp(56px, 10vw, 96px)',
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              lineHeight: 1.1,
            }}>
              {greet.display}
              {greet.phase === 'typing' && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                  style={{ color: D.primary, fontWeight: 400 }}
                >|</motion.span>
              )}
            </span>
          </motion.div>
        )}

        {/* ═══ WELCOME ═══ */}
        {screen === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', textAlign: 'center', padding: '0 24px' }}
          >
            <span style={{
              fontSize: 'clamp(32px, 6vw, 56px)',
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              lineHeight: 1.2,
            }}>
              {welcome.display}
              {welcome.phase === 'typing' && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                  style={{ color: D.primary, fontWeight: 400 }}
                >|</motion.span>
              )}
            </span>
          </motion.div>
        )}

        {/* ═══ CHOOSE: Login or Register ═══ */}
        {screen === 'choose' && (
          <motion.div
            key="choose"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', textAlign: 'center', padding: '0 24px' }}
          >
            <div style={{
              fontSize: 'clamp(28px, 5vw, 48px)',
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              lineHeight: 1.4,
            }}>
              {chooseLogin.phase !== 'done' && <span>{chooseLogin.display}</span>}
              {chooseLogin.phase === 'typing' && (
                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} style={{ color: D.primary }}>|</motion.span>
              )}
              {chooseLogin.phase === 'done' && (
                <motion.button
                  onClick={() => { setScreen('login-email'); }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ color: D.primary, textShadow: `0 0 20px ${D.primaryGlow}` }}
                  style={{
                    background: 'none', border: 'none', color: D.textPrimary,
                    fontSize: 'inherit', fontWeight: 500, fontFamily: FONT,
                    cursor: 'pointer', textDecoration: 'underline',
                    textUnderlineOffset: 6, textDecorationColor: 'rgba(255,255,255,0.2)',
                  }}
                >Войти</motion.button>
              )}
              <span>{chooseOr.display}</span>
              {chooseOr.phase === 'done' && (
                <motion.button
                  onClick={() => { setScreen('reg-name'); }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ color: D.primary, textShadow: `0 0 20px ${D.primaryGlow}` }}
                  style={{
                    background: 'none', border: 'none', color: D.textPrimary,
                    fontSize: 'inherit', fontWeight: 500, fontFamily: FONT,
                    cursor: 'pointer', textDecoration: 'underline',
                    textUnderlineOffset: 6, textDecorationColor: 'rgba(255,255,255,0.2)',
                  }}
                >зарегистрироваться</motion.button>
              )}
              {chooseReg.phase !== 'done' && <span>{chooseReg.display}</span>}
              <span>{chooseQuestion.display}</span>
              {chooseQuestion.phase === 'typing' && (
                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} style={{ color: D.primary }}>|</motion.span>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══ LOGIN: Email ═══ */}
        {screen === 'login-email' && (
          <motion.div
            key="login-email"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', textAlign: 'center', width: '100%', maxWidth: 420, padding: '0 24px' }}
          >
            <div style={{
              fontSize: 'clamp(18px, 3.5vw, 28px)',
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              marginBottom: 40,
            }}>
              {loginEmailLabel.display}
              {loginEmailLabel.phase === 'typing' && (
                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} style={{ color: D.primary }}>|</motion.span>
              )}
            </div>

            {loginEmailLabel.phase === 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ position: 'relative', marginBottom: 24 }}>
                  <input
                    ref={emailInputRef}
                    type="email"
                    value={emailDraft}
                    onChange={e => { setEmailDraft(e.target.value); playTypeClick(muted); }}
                    onKeyDown={e => { if (e.key === 'Enter') { setEmail(emailDraft); handleSendLoginCode(); } }}
                    placeholder="email@example.com"
                    autoComplete="email"
                    style={{
                      width: '100%',
                      padding: '16px 56px 16px 0',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `2px solid ${D.border}`,
                      color: D.textPrimary,
                      fontSize: 20,
                      fontFamily: FONT,
                      fontWeight: 300,
                      outline: 'none',
                      caretColor: D.primary,
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderBottomColor = D.primary; }}
                    onBlur={e => { e.currentTarget.style.borderBottomColor = D.border; }}
                  />
                  <motion.button
                    onClick={() => { setEmail(emailDraft); handleSendLoginCode(); }}
                    whileHover={{ scale: 1.1, background: D.primary }}
                    whileTap={{ scale: 0.9 }}
                    disabled={submitting || !emailDraft.includes('@')}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: emailDraft.includes('@') ? D.primary : 'rgba(255,255,255,0.06)',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: emailDraft.includes('@') ? 'pointer' : 'default',
                      opacity: emailDraft.includes('@') ? 1 : 0.3,
                      transition: 'all 0.2s',
                    }}
                  >
                    <ArrowRight size={18} color="#fff" />
                  </motion.button>

                  {/* Email autocomplete dropdown */}
                  <AnimatePresence>
                    {emailSuggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: 4,
                          background: 'rgba(18,18,24,0.95)',
                          border: `1px solid ${D.border}`,
                          borderRadius: 12,
                          overflow: 'hidden',
                          zIndex: 20,
                          backdropFilter: 'blur(20px)',
                        }}
                      >
                        {emailSuggestions.map(s => (
                          <motion.button
                            key={s}
                            onClick={() => { setEmailDraft(s); setEmail(s); emailSuggestions.length = 0; }}
                            whileHover={{ background: 'rgba(255,255,255,0.06)' }}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              background: 'transparent',
                              border: 'none',
                              color: D.textPrimary,
                              fontSize: 14,
                              fontFamily: FONT,
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >{s}</motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ color: D.error, fontSize: 13, fontFamily: FONT, marginTop: 8 }}
                  >{error}</motion.p>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ═══ LOGIN: Code ═══ */}
        {screen === 'login-code' && (
          <motion.div
            key="login-code"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', textAlign: 'center', width: '100%', maxWidth: 420, padding: '0 24px' }}
          >
            <div style={{
              fontSize: 'clamp(18px, 3.5vw, 28px)',
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              marginBottom: 8,
            }}>
              {loginCodeLabel.display}
              {loginCodeLabel.phase === 'typing' && (
                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} style={{ color: D.primary }}>|</motion.span>
              )}
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ color: D.textMuted, fontSize: 13, fontFamily: FONT, marginBottom: 32 }}
            >Код отправлен на {email}</motion.p>

            {loginCodeLabel.phase === 'done' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                <OtpInput
                  value={code}
                  onChange={setCode}
                  onComplete={handleLoginConfirm}
                  error={otpError}
                  muted={muted}
                />
                <motion.button
                  onClick={() => { setScreen('login-email'); setCode(''); setError(''); setOtpError(false); }}
                  whileHover={{ color: D.primary }}
                  style={{
                    marginTop: 20, background: 'none', border: 'none',
                    color: D.textMuted, fontSize: 13, fontFamily: FONT, cursor: 'pointer',
                  }}
                >Изменить email</motion.button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ═══ LOGIN: Success ═══ */}
        {screen === 'login-success' && (
          <motion.div
            key="login-success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ position: 'absolute', textAlign: 'center' }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(59,165,93,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
              }}
            >
              <motion.div
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${D.success}` }}
              />
            </motion.div>
            <div style={{
              fontSize: 'clamp(24px, 5vw, 36px)',
              fontWeight: 500,
              color: D.success,
              fontFamily: FONT,
            }}>
              {loginSuccessText.display}
              {loginSuccessText.phase === 'typing' && (
                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} style={{ color: D.success }}>|</motion.span>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══ LOGIN: Error ═══ */}
        {screen === 'login-error' && (
          <motion.div
            key="login-error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', textAlign: 'center', width: '100%', maxWidth: 420, padding: '0 24px' }}
          >
            <div style={{
              fontSize: 'clamp(18px, 3.5vw, 28px)',
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              marginBottom: 8,
            }}>Введи код</div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ color: D.textMuted, fontSize: 13, fontFamily: FONT, marginBottom: 32 }}
            >Код отправлен на {email}</motion.p>

            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={handleLoginConfirm}
              error={true}
              muted={muted}
            />
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ color: D.error, fontSize: 14, fontFamily: FONT, marginTop: 20, lineHeight: 1.5, maxWidth: 340, margin: '20px auto 0' }}
            >Чувак, ты пытаешься ввести неверный код. Не пытайся его угадать, если ты не владелец аккаунта.</motion.p>
            <motion.button
              onClick={() => { setScreen('login-email'); setCode(''); setError(''); }}
              whileHover={{ color: D.primary }}
              style={{
                marginTop: 20, background: 'none', border: 'none',
                color: D.textMuted, fontSize: 13, fontFamily: FONT, cursor: 'pointer',
              }}
            >Изменить email</motion.button>
          </motion.div>
        )}

        {/* ═══ REGISTER: Name ═══ */}
        {screen === 'reg-name' && (
          <motion.div
            key="reg-name"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', textAlign: 'center', width: '100%', maxWidth: 420, padding: '0 24px' }}
          >
            <div style={{
              fontSize: 'clamp(18px, 3.5vw, 28px)',
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              marginBottom: 40,
            }}>
              {regNameLabel.display}
              {regNameLabel.phase === 'typing' && (
                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} style={{ color: D.primary }}>|</motion.span>
              )}
            </div>
            {regNameLabel.phase === 'done' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); playTypeClick(muted); }}
                  onKeyDown={e => { if (e.key === 'Enter' && name.trim()) setScreen('reg-username'); }}
                  placeholder="Твоё имя"
                  maxLength={50}
                  style={{
                    width: '100%',
                    padding: '16px 0',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `2px solid ${D.border}`,
                    color: D.textPrimary,
                    fontSize: 20,
                    fontFamily: FONT,
                    fontWeight: 300,
                    outline: 'none',
                    caretColor: D.primary,
                    textAlign: 'center',
                  }}
                  onFocus={e => { e.currentTarget.style.borderBottomColor = D.primary; }}
                  onBlur={e => { e.currentTarget.style.borderBottomColor = D.border; }}
                />
                <motion.button
                  onClick={() => { if (name.trim()) setScreen('reg-username'); }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={!name.trim()}
                  style={{
                    marginTop: 32, padding: '14px 48px',
                    borderRadius: 50, background: name.trim() ? D.primary : 'rgba(255,255,255,0.06)',
                    border: 'none', color: '#fff', fontSize: 15, fontWeight: 600,
                    fontFamily: FONT, cursor: name.trim() ? 'pointer' : 'default',
                    opacity: name.trim() ? 1 : 0.4, transition: 'all 0.2s',
                  }}
                >Продолжить</motion.button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ═══ REGISTER: Username ═══ */}
        {screen === 'reg-username' && (
          <motion.div
            key="reg-username"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', textAlign: 'center', width: '100%', maxWidth: 420, padding: '0 24px' }}
          >
            <div style={{
              fontSize: 'clamp(18px, 3.5vw, 28px)',
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              marginBottom: 40,
            }}>
              {regUsernameLabel.display}
              {regUsernameLabel.phase === 'typing' && (
                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} style={{ color: D.primary }}>|</motion.span>
              )}
            </div>
            {regUsernameLabel.phase === 'done' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{ color: D.primary, fontSize: 20, fontWeight: 700, fontFamily: FONT, marginRight: 2 }}>@</span>
                  <input
                    ref={usernameInputRef}
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 17)); playTypeClick(muted); }}
                    onKeyDown={e => { if (e.key === 'Enter' && username.length >= 3) setScreen('reg-email'); }}
                    placeholder="username"
                    maxLength={17}
                    style={{
                      width: 240,
                      padding: '16px 0',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `2px solid ${D.border}`,
                      color: D.textPrimary,
                      fontSize: 20,
                      fontFamily: FONT,
                      fontWeight: 300,
                      outline: 'none',
                      caretColor: D.primary,
                    }}
                    onFocus={e => { e.currentTarget.style.borderBottomColor = D.primary; }}
                    onBlur={e => { e.currentTarget.style.borderBottomColor = D.border; }}
                  />
                </div>
                <div style={{ height: 20, marginTop: 8 }}>
                  <AnimatePresence>
                    {usernameStatus === 'available' && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: 12, color: D.success, fontFamily: FONT }}>Свободен</motion.span>
                    )}
                    {usernameStatus === 'taken' && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: 12, color: D.error, fontFamily: FONT }}>Занят</motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <motion.button
                  onClick={() => { if (username.length >= 3 && usernameStatus !== 'taken') setScreen('reg-email'); }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={username.length < 3 || usernameStatus === 'taken'}
                  style={{
                    marginTop: 24, padding: '14px 48px',
                    borderRadius: 50,
                    background: username.length >= 3 && usernameStatus !== 'taken' ? D.primary : 'rgba(255,255,255,0.06)',
                    border: 'none', color: '#fff', fontSize: 15, fontWeight: 600,
                    fontFamily: FONT,
                    cursor: username.length >= 3 && usernameStatus !== 'taken' ? 'pointer' : 'default',
                    opacity: username.length >= 3 && usernameStatus !== 'taken' ? 1 : 0.4,
                    transition: 'all 0.2s',
                  }}
                >Продолжить</motion.button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ═══ REGISTER: Email ═══ */}
        {screen === 'reg-email' && (
          <motion.div
            key="reg-email"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', textAlign: 'center', width: '100%', maxWidth: 420, padding: '0 24px' }}
          >
            <div style={{
              fontSize: 'clamp(18px, 3.5vw, 28px)',
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              marginBottom: 40,
            }}>
              {regEmailLabel.display}
              {regEmailLabel.phase === 'typing' && (
                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} style={{ color: D.primary }}>|</motion.span>
              )}
            </div>
            {regEmailLabel.phase === 'done' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div style={{ position: 'relative', marginBottom: 24 }}>
                  <input
                    ref={regEmailInputRef}
                    type="email"
                    value={regEmailDraft}
                    onChange={e => { setRegEmailDraft(e.target.value); playTypeClick(muted); }}
                    onKeyDown={e => { if (e.key === 'Enter') { setRegEmail(regEmailDraft); handleRegisterEmail(); } }}
                    placeholder="email@example.com"
                    autoComplete="email"
                    style={{
                      width: '100%',
                      padding: '16px 56px 16px 0',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `2px solid ${D.border}`,
                      color: D.textPrimary,
                      fontSize: 20,
                      fontFamily: FONT,
                      fontWeight: 300,
                      outline: 'none',
                      caretColor: D.primary,
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderBottomColor = D.primary; }}
                    onBlur={e => { e.currentTarget.style.borderBottomColor = D.border; }}
                  />
                  <motion.button
                    onClick={() => { setRegEmail(regEmailDraft); handleRegisterEmail(); }}
                    whileHover={{ scale: 1.1, background: D.primary }}
                    whileTap={{ scale: 0.9 }}
                    disabled={submitting || !regEmailDraft.includes('@')}
                    style={{
                      position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
                      width: 40, height: 40, borderRadius: '50%',
                      background: regEmailDraft.includes('@') ? D.primary : 'rgba(255,255,255,0.06)',
                      border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: regEmailDraft.includes('@') ? 'pointer' : 'default',
                      opacity: regEmailDraft.includes('@') ? 1 : 0.3, transition: 'all 0.2s',
                    }}
                  >
                    <ArrowRight size={18} color="#fff" />
                  </motion.button>

                  <AnimatePresence>
                    {regEmailSuggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                          background: 'rgba(18,18,24,0.95)', border: `1px solid ${D.border}`,
                          borderRadius: 12, overflow: 'hidden', zIndex: 20, backdropFilter: 'blur(20px)',
                        }}
                      >
                        {regEmailSuggestions.map(s => (
                          <motion.button
                            key={s}
                            onClick={() => { setRegEmailDraft(s); setRegEmail(s); regEmailSuggestions.length = 0; }}
                            whileHover={{ background: 'rgba(255,255,255,0.06)' }}
                            style={{
                              width: '100%', padding: '12px 16px', background: 'transparent',
                              border: 'none', color: D.textPrimary, fontSize: 14,
                              fontFamily: FONT, textAlign: 'left', cursor: 'pointer',
                            }}
                          >{s}</motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: D.error, fontSize: 13, fontFamily: FONT }}>{error}</motion.p>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ═══ REGISTER: Code ═══ */}
        {screen === 'reg-code' && (
          <motion.div
            key="reg-code"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', textAlign: 'center', width: '100%', maxWidth: 420, padding: '0 24px' }}
          >
            <div style={{
              fontSize: 'clamp(18px, 3.5vw, 28px)',
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              marginBottom: 8,
            }}>
              {regCodeLabel.display}
              {regCodeLabel.phase === 'typing' && (
                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} style={{ color: D.primary }}>|</motion.span>
              )}
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ color: D.textMuted, fontSize: 13, fontFamily: FONT, marginBottom: 32 }}
            >Код отправлен на {regEmail}</motion.p>

            {regCodeLabel.phase === 'done' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                <OtpInput
                  value={code}
                  onChange={setCode}
                  onComplete={handleRegisterConfirm}
                  error={otpError}
                  muted={muted}
                />
                <motion.button
                  onClick={() => { setScreen('reg-email'); setCode(''); setError(''); setOtpError(false); }}
                  whileHover={{ color: D.primary }}
                  style={{
                    marginTop: 20, background: 'none', border: 'none',
                    color: D.textMuted, fontSize: 13, fontFamily: FONT, cursor: 'pointer',
                  }}
                >Изменить email</motion.button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ═══ REGISTER: Success ═══ */}
        {screen === 'reg-success' && (
          <motion.div
            key="reg-success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ position: 'absolute', textAlign: 'center' }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(59,165,93,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
              }}
            >
              <motion.div
                style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${D.success}` }}
              />
            </motion.div>
            <div style={{
              fontSize: 'clamp(24px, 5vw, 36px)',
              fontWeight: 500,
              color: D.success,
              fontFamily: FONT,
            }}>
              {regSuccessText.display}
              {regSuccessText.phase === 'typing' && (
                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} style={{ color: D.success }}>|</motion.span>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══ REGISTER: Error ═══ */}
        {screen === 'reg-error' && (
          <motion.div
            key="reg-error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', textAlign: 'center', width: '100%', maxWidth: 420, padding: '0 24px' }}
          >
            <div style={{
              fontSize: 'clamp(18px, 3.5vw, 28px)',
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              marginBottom: 8,
            }}>Введи код</div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ color: D.textMuted, fontSize: 13, fontFamily: FONT, marginBottom: 32 }}
            >Код отправлен на {regEmail}</motion.p>

            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={handleRegisterConfirm}
              error={true}
              muted={muted}
            />
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ color: D.error, fontSize: 14, fontFamily: FONT, marginTop: 20, lineHeight: 1.5, maxWidth: 340, margin: '20px auto 0' }}
            >Чувак, ты пытаешься ввести неверный код. Не пытайся его угадать, если ты не владелец аккаунта.</motion.p>
            <motion.button
              onClick={() => { setScreen('reg-email'); setCode(''); setError(''); }}
              whileHover={{ color: D.primary }}
              style={{
                marginTop: 20, background: 'none', border: 'none',
                color: D.textMuted, fontSize: 13, fontFamily: FONT, cursor: 'pointer',
              }}
            >Изменить email</motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
