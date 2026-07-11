import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

interface CaptchaWidgetProps {
  onVerify: (captchaId: string) => void;
  onError?: (error: string) => void;
}

const D = {
  bg: '#141518',
  card: '#1e1f22',
  primary: '#5865f2',
  primaryHover: '#4752c4',
  success: '#3ba55d',
  error: '#ed4245',
  textPrimary: '#f2f3f5',
  textSecondary: '#b5bac1',
  textMuted: '#949ba4',
  textDim: '#4e5058',
  border: 'rgba(255,255,255,0.03)',
} as const;

export default function CaptchaWidget({ onVerify, onError }: CaptchaWidgetProps) {
  const [captchaId, setCaptchaId] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);

  const loadCaptcha = useCallback(async () => {
    setLoading(true);
    setError('');
    setAnswer('');
    setVerified(false);
    setExpired(false);
    try {
      const result = await api.generateCaptcha();
      setCaptchaId(result.id);
      setQuestion(result.question);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка загрузки CAPTCHA';
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha]);

  // Auto-expire after 5 minutes
  useEffect(() => {
    if (!captchaId || verified) return;
    const timer = setTimeout(() => {
      setExpired(true);
      loadCaptcha();
    }, 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [captchaId, verified, loadCaptcha]);

  const handleVerify = async () => {
    if (!answer.trim()) {
      setError('Введите ответ');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.verifyCaptcha(captchaId, answer.trim());
      if (result.valid) {
        setVerified(true);
        onVerify(captchaId);
      } else {
        setError('Неверный ответ');
        loadCaptcha();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка проверки';
      setError(msg);
      loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  if (verified) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: 'rgba(59,165,93,0.1)',
          border: '1px solid rgba(59,165,93,0.3)',
          borderRadius: 10,
          color: D.success,
          fontFamily: "'Inter',sans-serif",
          fontSize: 14,
        }}
      >
        <ShieldCheck size={18} />
        <span style={{ fontWeight: 500 }}>Проверка пройдена</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: D.bg,
        border: `1px solid ${error ? 'rgba(237,66,69,0.3)' : D.border}`,
        borderRadius: 12,
        padding: 16,
        marginTop: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <ShieldCheck size={16} color={D.textDim} />
        <span style={{ color: D.textSecondary, fontSize: 13, fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>
          Проверка на бота
        </span>
        <button
          onClick={loadCaptcha}
          disabled={loading}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: D.textDim,
            cursor: loading ? 'not-allowed' : 'pointer',
            padding: 4,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            transition: '0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = D.primary)}
          onMouseLeave={e => (e.currentTarget.style.color = D.textDim)}
          title="Обновить CAPTCHA"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {expired ? (
          <motion.div
            key="expired"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              background: 'rgba(250,166,26,0.1)',
              border: '1px solid rgba(250,166,26,0.2)',
              borderRadius: 8,
              color: D.textMuted,
              fontSize: 13,
              fontFamily: "'Inter',sans-serif",
            }}
          >
            <AlertCircle size={14} color="#faa61a" />
            <span>CAPTTCHA истекла. Нажмите обновить.</span>
          </motion.div>
        ) : (
          <motion.div key="challenge" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{
              background: D.card,
              borderRadius: 8,
              padding: '14px 16px',
              marginBottom: 12,
              textAlign: 'center',
            }}>
              <div style={{
                color: D.primary,
                fontSize: 20,
                fontWeight: 800,
                fontFamily: "monospace",
                letterSpacing: 2,
              }}>
                {question || '...'}
              </div>
            </div>

            <input
              type="text"
              value={answer}
              onChange={e => { setAnswer(e.target.value.replace(/[^0-9\-]/g, '').slice(0, 6)); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="Ваш ответ"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                background: D.card,
                border: `2px solid ${error ? 'rgba(237,66,69,0.5)' : 'transparent'}`,
                borderRadius: 8,
                color: D.textPrimary,
                fontSize: 15,
                fontFamily: "'Inter',sans-serif",
                outline: 'none',
                textAlign: 'center',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = D.primary)}
              onBlur={e => (e.currentTarget.style.borderColor = error ? 'rgba(237,66,69,0.5)' : 'transparent')}
            />

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ color: D.error, fontSize: 12, marginTop: 8, textAlign: 'center', fontFamily: "'Inter',sans-serif" }}
              >
                {error}
              </motion.p>
            )}

            <button
              onClick={handleVerify}
              disabled={loading || !answer.trim()}
              style={{
                width: '100%',
                marginTop: 10,
                padding: 10,
                background: loading || !answer.trim() ? '#3f4147' : D.primary,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "'Inter',sans-serif",
                cursor: loading || !answer.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: '0.2s',
              }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              Проверить
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
