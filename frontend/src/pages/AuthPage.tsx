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
  primary: '#ffffff',
  primaryGlow: 'rgba(255,255,255,0.2)',
  success: '#3ba55d',
  error: '#ed4245',
  textPrimary: '#ffffff',
  textMuted: 'rgba(255,255,255,0.4)',
  border: 'rgba(255,255,255,0.12)',
  inputBg: 'rgba(255,255,255,0.04)',
} as const;

const FONT = `'PreschoolPlayhouse', 'Caveat', cursive`;
const AUTH_FONT_SIZE = 'clamp(30px, 5.5vw, 48px)';

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
  opts: { typingSpeed?: number; eraseSpeed?: number; pauseAfter?: number; startDelay?: number; enabled?: boolean; muted?: boolean; noErase?: boolean; onType?: () => void; onErase?: () => void } = {}
) {
  const { typingSpeed = 70, eraseSpeed = 35, pauseAfter = 1500, startDelay = 300, enabled = true, muted = false, noErase = false, onType, onErase } = opts;
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
        const t = window.setTimeout(type, typingSpeed);
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

    const start = window.setTimeout(type, startDelay);
    timersRef.current.push(start);

    return clear;
  }, [text, enabled, startDelay]); // eslint-disable-line react-hooks/exhaustive-deps

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
            fontSize: 20,
            fontWeight: 500,
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

export default function AuthPage({ onLegalClick }: { onLegalClick?: (tab: 'privacy' | 'terms' | 'cookies') => void }) {
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
  const [nameFocused, setNameFocused] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);

  // ─── Username generator ──────────────────────────────────────────────
  const generateUsername = useCallback((displayName: string) => {
    const adjectives = ['cool', 'happy', 'lucky', 'swift', 'bold', 'calm', 'epic', 'fast', 'keen', 'wise'];
    const nouns = ['fox', 'wolf', 'bear', 'hawk', 'star', 'moon', 'fire', 'wave', 'code', 'dev'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 900 + 100);
    // Transliterate Russian to Latin for username base
    const translit = displayName
      .toLowerCase()
      .replace(/[а-яё]/g, c => {
        const map: Record<string, string> = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya' };
        return map[c] || c;
      })
      .replace(/[^a-z]/g, '');
    if (translit.length >= 3) {
      return `${translit.slice(0, 8)}_${adj}${num}`;
    }
    return `${adj}_${noun}${num}`;
  }, []);

  // ─── Typing animations ─────────────────────────────────────────────────
  const greet = useTypingAnimation('Привет', { enabled: screen === 'greeting', muted, onType: () => playTypeClick(muted), onErase: () => playEraseClick(muted) });
  const welcome = useTypingAnimation('Добро пожаловать в Нексо', { enabled: screen === 'welcome', muted, onType: () => playTypeClick(muted), onErase: () => playEraseClick(muted) });
  const chooseLogin = useTypingAnimation('Войти', { enabled: screen === 'choose', muted, typingSpeed: 70, startDelay: 0, noErase: true, onType: () => playTypeClick(muted) });
  const chooseOr = useTypingAnimation(' или ', { enabled: screen === 'choose' && chooseLogin.phase === 'done', muted, typingSpeed: 70, startDelay: 0, noErase: true, onType: () => playTypeClick(muted) });
  const chooseReg = useTypingAnimation('зарегистрироваться', { enabled: screen === 'choose' && chooseOr.phase === 'done', muted, typingSpeed: 70, startDelay: 0, noErase: true, onType: () => playTypeClick(muted) });
  const chooseQuestion = useTypingAnimation('?', { enabled: screen === 'choose' && chooseReg.phase === 'done', muted, typingSpeed: 70, startDelay: 0, noErase: true, onType: () => playTypeClick(muted) });

  const loginEmailLabel = useTypingAnimation('Введи свой email', { enabled: screen === 'login-email', muted, onType: () => playTypeClick(muted), onErase: () => playEraseClick(muted) });
  const loginCodeLabel = useTypingAnimation('Введи код', { enabled: screen === 'login-code', muted, onType: () => playTypeClick(muted), onErase: () => playEraseClick(muted) });
  const loginSuccessText = useTypingAnimation('Вход выполнен', { enabled: screen === 'login-success', muted, noErase: true, onType: () => playTypeClick(muted) });

  const regNameLabel = useTypingAnimation('Как тебя зовут?', { enabled: screen === 'reg-name', muted, onType: () => playTypeClick(muted), onErase: () => playEraseClick(muted) });
  const regUsernameLabel = useTypingAnimation('Придумай username', { enabled: screen === 'reg-username', muted, onType: () => playTypeClick(muted), onErase: () => playEraseClick(muted) });
  const regEmailLabel = useTypingAnimation('Введи email', { enabled: screen === 'reg-email', muted, onType: () => playTypeClick(muted), onErase: () => playEraseClick(muted) });
  const regCodeLabel = useTypingAnimation('Введи код', { enabled: screen === 'reg-code', muted, onType: () => playTypeClick(muted), onErase: () => playEraseClick(muted) });
  const regSuccessText = useTypingAnimation('Регистрация завершена!', { enabled: screen === 'reg-success', muted, noErase: true, onType: () => playTypeClick(muted) });

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
    if (username.length < 3 || !/^[a-zA-Zа-яА-ЯёЁ0-9_.-]+$/.test(username)) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      try { const r = await api.checkUsername(username); setUsernameStatus(r.available ? 'available' : 'taken'); }
      catch { setUsernameStatus('idle'); }
    }, 500);
    return () => clearTimeout(t);
  }, [username]);

  // ─── Login handlers ─────────────────────────────────────────────────────
  const handleSendLoginCode = async (emailToUse: string) => {
    if (!emailToUse || !emailToUse.includes('@')) return;
    setEmail(emailToUse);
    setSubmitting(true); setError('');
    try {
      const result = await sendLoginCode(emailToUse);
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
  const handleRegisterEmail = async (emailToUse: string) => {
    if (!emailToUse || !emailToUse.includes('@')) return;
    setRegEmail(emailToUse);
    setSubmitting(true); setError('');
    try {
      await api.sendEmailCode(emailToUse);
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
    if (EMAIL_PROVIDERS.includes(domain.toLowerCase())) return [];
    return EMAIL_PROVIDERS
      .filter(p => p.startsWith(domain.toLowerCase()))
      .slice(0, 6)
      .map(p => `${local}@${p}`);
  }, [emailDraft]);

  const regEmailSuggestions = useMemo(() => {
    if (!regEmailDraft.includes('@') || regEmailDraft.endsWith('@')) return [];
    const [local, domain] = regEmailDraft.split('@');
    if (!domain) return [];
    if (EMAIL_PROVIDERS.includes(domain.toLowerCase())) return [];
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
              fontSize: AUTH_FONT_SIZE,
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
              fontSize: AUTH_FONT_SIZE,
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              lineHeight: 1.2,
              wordBreak: 'keep-all',
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
              fontSize: AUTH_FONT_SIZE,
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              lineHeight: 1.4,
              wordBreak: 'keep-all',
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
              {chooseReg.phase === 'done' && (
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
              fontSize: AUTH_FONT_SIZE,
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              marginBottom: 40,
              wordBreak: 'keep-all',
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
                <div style={{ marginBottom: 16 }}>
                  {/* Email autocomplete hints - horizontal chips above input */}
                  <AnimatePresence>
                    {emailSuggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          justifyContent: 'center',
                          marginBottom: 12,
                        }}
                      >
                        {emailSuggestions.map(s => (
                          <motion.button
                            key={s}
                            onClick={() => { setEmailDraft(s); setEmail(s); }}
                            whileHover={{ background: 'rgba(255,255,255,0.1)' }}
                            style={{
                              padding: '6px 14px',
                              background: 'rgba(255,255,255,0.04)',
                              border: `1px solid ${D.border}`,
                              borderRadius: 8,
                              color: D.textMuted,
                              fontSize: 13,
                              fontFamily: FONT,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                          >{s}</motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <input
                    ref={emailInputRef}
                    type="email"
                    value={emailDraft}
                    onChange={e => { setEmailDraft(e.target.value); playTypeClick(muted); }}
                    onKeyDown={e => { if (e.key === 'Enter') { handleSendLoginCode(emailDraft); } }}
                    placeholder="Свой email, можно продолжить"
                    autoComplete="email"
                    style={{
                      width: '100%',
                      padding: '16px 16px',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${D.border}`,
                      borderRadius: 12,
                      color: D.textPrimary,
                      fontSize: 20,
                      fontFamily: FONT,
                      fontWeight: 500,
                      outline: 'none',
                      caretColor: D.primary,
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = D.border; }}
                  />
                </div>

                {/* Continue button - gray with border */}
                <motion.button
                  onClick={() => { handleSendLoginCode(emailDraft); }}
                  whileHover={emailDraft.includes('@') ? { scale: 1.03 } : {}}
                  whileTap={emailDraft.includes('@') ? { scale: 0.97 } : {}}
                  disabled={submitting || !emailDraft.includes('@')}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    borderRadius: 12,
                    background: emailDraft.includes('@') ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${emailDraft.includes('@') ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
                    color: emailDraft.includes('@') ? '#fff' : 'rgba(255,255,255,0.3)',
                    fontSize: 16,
                    fontWeight: 600,
                    fontFamily: FONT,
                    cursor: emailDraft.includes('@') ? 'pointer' : 'default',
                    opacity: emailDraft.includes('@') ? 1 : 0.5,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  Продолжить
                  <ArrowRight size={18} />
                </motion.button>

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
              fontSize: AUTH_FONT_SIZE,
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              marginBottom: 8,
              wordBreak: 'keep-all',
            }}>
              {loginCodeLabel.display}
              {loginCodeLabel.phase === 'typing' && (
                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} style={{ color: D.primary }}>|</motion.span>
              )}
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ color: D.textMuted, fontSize: 16, fontFamily: FONT, marginBottom: 32 }}
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
                    color: D.textMuted, fontSize: 16, fontFamily: FONT, cursor: 'pointer',
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
              fontSize: AUTH_FONT_SIZE,
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
              fontSize: AUTH_FONT_SIZE,
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
              fontSize: AUTH_FONT_SIZE,
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              marginBottom: 40,
              wordBreak: 'keep-all',
            }}>
              {regNameLabel.display}
              {regNameLabel.phase === 'typing' && (
                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} style={{ color: D.primary }}>|</motion.span>
              )}
            </div>
            {regNameLabel.phase === 'done' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                {/* Floating label input */}
                <div style={{ position: 'relative', marginBottom: 32 }}>
                  <motion.span
                    animate={{
                      y: nameFocused || name ? -24 : 0,
                      scale: nameFocused || name ? 0.8 : 1,
                      color: nameFocused ? D.primary : D.textMuted,
                    }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      top: 16,
                      fontSize: 16,
                      fontFamily: FONT,
                      fontWeight: 500,
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                      transformOrigin: 'center',
                    }}
                  >
                    Твоё имя
                  </motion.span>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    onChange={e => { setName(e.target.value); playTypeClick(muted); }}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                    onKeyDown={e => { if (e.key === 'Enter' && name.trim()) setScreen('reg-username'); }}
                    maxLength={50}
                    autoComplete="name"
                    style={{
                      width: '100%',
                      padding: '24px 0 8px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `2px solid ${nameFocused ? D.primary : D.border}`,
                      color: D.textPrimary,
                      fontSize: 20,
                      fontFamily: FONT,
                      fontWeight: 500,
                      outline: 'none',
                      caretColor: D.primary,
                      textAlign: 'center',
                      transition: 'border-color 0.2s',
                    }}
                  />
                </div>
                <motion.button
                  onClick={() => { if (name.trim()) setScreen('reg-username'); }}
                  whileHover={name.trim() ? { scale: 1.05 } : {}}
                  whileTap={name.trim() ? { scale: 0.95 } : {}}
                  disabled={!name.trim()}
                  style={{
                    padding: '12px 36px',
                    borderRadius: 50,
                    background: name.trim() ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: `1px solid ${name.trim() ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: FONT,
                    cursor: name.trim() ? 'pointer' : 'default',
                    opacity: name.trim() ? 1 : 0.4,
                    transition: 'all 0.2s',
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
              fontSize: AUTH_FONT_SIZE,
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              marginBottom: 40,
              wordBreak: 'keep-all',
            }}>
              {regUsernameLabel.display}
              {regUsernameLabel.phase === 'typing' && (
                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} style={{ color: D.primary }}>|</motion.span>
              )}
            </div>
            {regUsernameLabel.phase === 'done' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                {/* Floating label input with @ prefix */}
                <div style={{ position: 'relative', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: D.primary, fontSize: 20, fontWeight: 700, fontFamily: FONT, marginRight: 2, position: 'relative', top: -2 }}>@</span>
                  <div style={{ position: 'relative', flex: 1, maxWidth: 260 }}>
                    <motion.span
                      animate={{
                        y: usernameFocused || username ? -20 : 0,
                        scale: usernameFocused || username ? 0.75 : 1,
                        color: usernameFocused ? D.primary : D.textMuted,
                      }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 14,
                        fontSize: 16,
                        fontFamily: FONT,
                        fontWeight: 500,
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        transformOrigin: 'left',
                      }}
                    >
                      username
                    </motion.span>
                    <input
                      ref={usernameInputRef}
                      type="text"
                      value={username}
                      onChange={e => { setUsername(e.target.value.replace(/[^a-zA-Zа-яА-ЯёЁ0-9_.-]/g, '').slice(0, 20)); playTypeClick(muted); }}
                      onFocus={() => setUsernameFocused(true)}
                      onBlur={() => setUsernameFocused(false)}
                      onKeyDown={e => { if (e.key === 'Enter' && username.length >= 3 && usernameStatus !== 'taken') setScreen('reg-email'); }}
                      maxLength={20}
                      autoComplete="username"
                      style={{
                        width: '100%',
                        padding: '24px 0 6px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: `2px solid ${usernameFocused ? D.primary : D.border}`,
                        color: D.textPrimary,
                        fontSize: 20,
                        fontFamily: FONT,
                        fontWeight: 500,
                        outline: 'none',
                        caretColor: D.primary,
                        transition: 'border-color 0.2s',
                      }}
                    />
                  </div>
                </div>

                {/* Username status */}
                <div style={{ height: 20, marginTop: 4 }}>
                  <AnimatePresence>
                    {usernameStatus === 'available' && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: 12, color: D.success, fontFamily: FONT }}>Свободен</motion.span>
                    )}
                    {usernameStatus === 'taken' && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: 12, color: D.error, fontFamily: FONT }}>Занят</motion.span>
                    )}
                  </AnimatePresence>
                </div>

                {/* Generate username button */}
                <motion.button
                  onClick={() => {
                    const generated = generateUsername(name || 'user');
                    setUsername(generated);
                    playTypeClick(muted);
                    usernameInputRef.current?.focus();
                  }}
                  whileHover={{ scale: 1.03, color: D.primary }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    marginTop: 12,
                    padding: '8px 20px',
                    borderRadius: 20,
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid rgba(255,255,255,0.08)`,
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: D.textMuted,
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: FONT,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >Сгенерировать</motion.button>

                {/* Continue button */}
                <div style={{ marginTop: 24 }}>
                  <motion.button
                    onClick={() => { if (username.length >= 3 && usernameStatus !== 'taken') setScreen('reg-email'); }}
                    whileHover={username.length >= 3 && usernameStatus !== 'taken' ? { scale: 1.05 } : {}}
                    whileTap={username.length >= 3 && usernameStatus !== 'taken' ? { scale: 0.95 } : {}}
                    disabled={username.length < 3 || usernameStatus === 'taken'}
                    style={{
                      padding: '12px 36px',
                      borderRadius: 50,
                    background: username.length >= 3 && usernameStatus !== 'taken' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: `1px solid ${username.length >= 3 && usernameStatus !== 'taken' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: FONT,
                      cursor: username.length >= 3 && usernameStatus !== 'taken' ? 'pointer' : 'default',
                    opacity: username.length >= 3 && usernameStatus !== 'taken' ? 1 : 0.4,
                    transition: 'all 0.2s',
                    }}
                  >Продолжить</motion.button>
                </div>
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
              fontSize: AUTH_FONT_SIZE,
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              marginBottom: 40,
              wordBreak: 'keep-all',
            }}>
              {regEmailLabel.display}
              {regEmailLabel.phase === 'typing' && (
                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }} style={{ color: D.primary }}>|</motion.span>
              )}
            </div>
            {regEmailLabel.phase === 'done' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div style={{ marginBottom: 16 }}>
                  {/* Email autocomplete hints - horizontal chips above input */}
                  <AnimatePresence>
                    {regEmailSuggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          justifyContent: 'center',
                          marginBottom: 12,
                        }}
                      >
                        {regEmailSuggestions.map(s => (
                          <motion.button
                            key={s}
                            onClick={() => { setRegEmailDraft(s); setRegEmail(s); }}
                            whileHover={{ background: 'rgba(255,255,255,0.1)' }}
                            style={{
                              padding: '6px 14px',
                              background: 'rgba(255,255,255,0.04)',
                              border: `1px solid ${D.border}`,
                              borderRadius: 8,
                              color: D.textMuted,
                              fontSize: 13,
                              fontFamily: FONT,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                          >{s}</motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <input
                    ref={regEmailInputRef}
                    type="email"
                    value={regEmailDraft}
                    onChange={e => { setRegEmailDraft(e.target.value); playTypeClick(muted); }}
                    onKeyDown={e => { if (e.key === 'Enter') { handleRegisterEmail(regEmailDraft); } }}
                    placeholder="Свой email, можно продолжить"
                    autoComplete="email"
                    style={{
                      width: '100%',
                      padding: '16px 16px',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${D.border}`,
                      borderRadius: 12,
                      color: D.textPrimary,
                      fontSize: 20,
                      fontFamily: FONT,
                      fontWeight: 500,
                      outline: 'none',
                      caretColor: D.primary,
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = D.border; }}
                  />
                </div>

                {/* Continue button - gray with border */}
                <motion.button
                  onClick={() => { handleRegisterEmail(regEmailDraft); }}
                  whileHover={regEmailDraft.includes('@') ? { scale: 1.03 } : {}}
                  whileTap={regEmailDraft.includes('@') ? { scale: 0.97 } : {}}
                  disabled={submitting || !regEmailDraft.includes('@')}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    borderRadius: 12,
                    background: regEmailDraft.includes('@') ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${regEmailDraft.includes('@') ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
                    color: regEmailDraft.includes('@') ? '#fff' : 'rgba(255,255,255,0.3)',
                    fontSize: 16,
                    fontWeight: 600,
                    fontFamily: FONT,
                    cursor: regEmailDraft.includes('@') ? 'pointer' : 'default',
                    opacity: regEmailDraft.includes('@') ? 1 : 0.5,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  Продолжить
                  <ArrowRight size={18} />
                </motion.button>

                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: D.error, fontSize: 13, fontFamily: FONT, marginTop: 8 }}>{error}</motion.p>
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
              fontSize: AUTH_FONT_SIZE,
              fontWeight: 500,
              color: D.textPrimary,
              letterSpacing: '-0.01em',
              fontFamily: FONT,
              marginBottom: 8,
              wordBreak: 'keep-all',
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
              fontSize: AUTH_FONT_SIZE,
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
              fontSize: AUTH_FONT_SIZE,
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

      {/* ─── Legal footer ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        className="fixed bottom-6 left-0 right-0 flex items-center justify-center gap-4 px-4 z-50"
        style={{ fontFamily: "'Onest', system-ui, -apple-system, sans-serif", pointerEvents: 'auto' }}
      >
        <button
          onClick={() => onLegalClick?.('privacy')}
          className="text-[11px] text-white/20 hover:text-white/50 transition-colors"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >Политика конфиденциальности</button>
        <span className="text-[11px] text-white/10">·</span>
        <button
          onClick={() => onLegalClick?.('terms')}
          className="text-[11px] text-white/20 hover:text-white/50 transition-colors"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >Пользовательское соглашение</button>
        <span className="text-[11px] text-white/10">·</span>
        <button
          onClick={() => onLegalClick?.('cookies')}
          className="text-[11px] text-white/20 hover:text-white/50 transition-colors"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >Cookie</button>
      </motion.div>
    </div>
  );
}
