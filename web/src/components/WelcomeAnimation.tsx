import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WelcomeAnimationProps {
  onComplete: () => void;
}

type Phase = 'greeting' | 'greeting-fade' | 'welcome' | 'welcome-fade' | 'logo' | 'done';

const TYPING_SPEED = 65;
const PHASE_PAUSE = 1200;

export default function WelcomeAnimation({ onComplete }: WelcomeAnimationProps) {
  const [phase, setPhase] = useState<Phase>('greeting');
  const [greetingText, setGreetingText] = useState('');
  const [welcomeText, setWelcomeText] = useState('');
  const timeoutsRef = useRef<number[]>([]);
  const mountedRef = useRef(true);

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeouts();
    };
  }, [clearTimeouts]);

  useEffect(() => {
    if (phase !== 'greeting') return;
    const text = 'Привет';
    let i = 0;
    let cancelled = false;

    const typeChar = () => {
      if (cancelled || !mountedRef.current) return;
      if (i < text.length) {
        setGreetingText(text.slice(0, i + 1));
        i++;
        const t = window.setTimeout(typeChar, TYPING_SPEED + Math.random() * 30);
        timeoutsRef.current.push(t);
      } else {
        const t = window.setTimeout(() => {
          if (!cancelled && mountedRef.current) setPhase('greeting-fade');
        }, PHASE_PAUSE);
        timeoutsRef.current.push(t);
      }
    };

    const startT = window.setTimeout(typeChar, 500);
    timeoutsRef.current.push(startT);

    return () => { cancelled = true; };
  }, [phase, clearTimeouts]);

  useEffect(() => {
    if (phase !== 'greeting-fade') return;
    const t = window.setTimeout(() => {
      if (mountedRef.current) {
        setGreetingText('');
        setPhase('welcome');
      }
    }, 600);
    timeoutsRef.current.push(t);
    return () => {};
  }, [phase]);

  useEffect(() => {
    if (phase !== 'welcome') return;
    const text = 'Добро пожаловать в Нексо';
    let i = 0;
    let cancelled = false;

    const typeChar = () => {
      if (cancelled || !mountedRef.current) return;
      if (i < text.length) {
        setWelcomeText(text.slice(0, i + 1));
        i++;
        const t = window.setTimeout(typeChar, TYPING_SPEED + Math.random() * 20);
        timeoutsRef.current.push(t);
      } else {
        const t = window.setTimeout(() => {
          if (!cancelled && mountedRef.current) setPhase('welcome-fade');
        }, PHASE_PAUSE);
        timeoutsRef.current.push(t);
      }
    };

    const startT = window.setTimeout(typeChar, 300);
    timeoutsRef.current.push(startT);

    return () => { cancelled = true; };
  }, [phase, clearTimeouts]);

  useEffect(() => {
    if (phase !== 'welcome-fade') return;
    const t = window.setTimeout(() => {
      if (mountedRef.current) {
        setWelcomeText('');
        setPhase('logo');
      }
    }, 600);
    timeoutsRef.current.push(t);
    return () => {};
  }, [phase]);

  useEffect(() => {
    if (phase !== 'logo') return;
    const t = window.setTimeout(() => {
      if (mountedRef.current) setPhase('done');
    }, 2800);
    timeoutsRef.current.push(t);
    return () => {};
  }, [phase]);

  useEffect(() => {
    if (phase === 'done') {
      const t = window.setTimeout(() => {
        if (mountedRef.current) onComplete();
      }, 200);
      timeoutsRef.current.push(t);
    }
  }, [phase, onComplete]);

  if (phase === 'done') return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.08, 0.18, 0.08],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full bg-gradient-to-r from-nexo-600/25 to-purple-600/25 blur-[100px]"
        />
        <motion.div
          animate={{
            scale: [1.1, 1, 1.1],
            opacity: [0.05, 0.12, 0.05],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute top-1/3 left-1/3 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-indigo-500/15 to-pink-500/15 blur-[80px]"
        />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-[350px] px-6">
        <AnimatePresence mode="wait">
          {(phase === 'greeting' || phase === 'greeting-fade') && (
            <motion.div
              key="greeting"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, filter: 'blur(10px)', scale: 0.98 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center"
            >
              <span className="text-4xl md:text-6xl font-bold text-white tracking-tight">
                {greetingText}
              </span>
              {phase === 'greeting' && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                  className="ml-1 text-4xl md:text-6xl text-nexo-400/80 font-light"
                >
                  |
                </motion.span>
              )}
            </motion.div>
          )}

          {(phase === 'welcome' || phase === 'welcome-fade') && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, filter: 'blur(10px)', scale: 0.98 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-3"
            >
              <span className="text-3xl md:text-5xl font-bold text-white tracking-tight text-center leading-tight">
                {welcomeText}
              </span>
              {phase === 'welcome' && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                  className="text-3xl md:text-5xl text-nexo-400/80 font-light"
                >
                  |
                </motion.span>
              )}
            </motion.div>
          )}

          {phase === 'logo' && (
            <motion.div
              key="logo"
              initial={{ opacity: 0, scale: 0.6, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-4"
            >
              <motion.div
                initial={{ scale: 0, rotate: -120 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.8, type: 'spring', bounce: 0.45, delay: 0.1 }}
                className="relative"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-nexo-500/30 to-purple-600/30 blur-2xl rounded-full scale-150" />
                <img
                  src="/logo.png"
                  alt="Нексо"
                  className="relative w-24 h-24 md:w-28 md:h-28 rounded-3xl shadow-2xl shadow-nexo-500/40 object-cover"
                />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.5 }}
                className="text-3xl md:text-5xl font-bold gradient-text"
              >
                Нексо
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-white/30 text-sm md:text-base tracking-wide"
              >
                by haker_one
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65, duration: 0.5 }}
                className="text-zinc-400 text-xs md:text-sm"
              >
                Безопасный мессенджер нового поколения
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85, duration: 0.5 }}
                className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mt-3"
              >
                <motion.button
                  whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(99,102,241,0.4)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    clearTimeouts();
                    setPhase('done');
                    setTimeout(() => onComplete(), 50);
                  }}
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-semibold text-base shadow-xl shadow-nexo-500/30 transition-shadow"
                >
                  Регистрация
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    clearTimeouts();
                    setPhase('done');
                    setTimeout(() => onComplete(), 50);
                  }}
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold text-base hover:bg-white/15 transition-colors"
                >
                  Войти
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
