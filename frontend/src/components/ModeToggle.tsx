import { motion } from 'framer-motion';

const D = {
  primary: '#845EF7',
  primaryGlow: 'rgba(132,94,247,0.3)',
  card: '#1e1f22',
  input: '#141518',
  textPrimary: '#f2f3f5',
  textMuted: '#949ba4',
  textDim: '#4e5058',
  border: 'rgba(255,255,255,0.06)',
} as const;

interface ModeToggleProps {
  mode: 'login' | 'register';
  onSwitch: () => void;
}

export default function ModeToggle({ mode, onSwitch }: ModeToggleProps) {
  const isRegister = mode === 'register';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
      }}
    >
      {/* Toggle pill */}
      <motion.button
        onClick={onSwitch}
        whileTap={{ scale: 0.97 }}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: 240,
          height: 46,
          borderRadius: 14,
          background: 'transparent',
          border: `1.5px solid ${D.border}`,
          cursor: 'pointer',
          padding: 4,
          overflow: 'hidden',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* Sliding indicator — outline style */}
        <motion.div
          animate={{ x: isRegister ? '100%' : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: 4,
            width: 'calc(50% - 4px)',
            borderRadius: 11,
            background: 'transparent',
            border: `1.5px solid ${D.primary}`,
            boxShadow: `0 0 20px ${D.primaryGlow}`,
          }}
        />

        {/* Labels */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          width: '100%',
        }}>
          <motion.span
            animate={{
              color: !isRegister ? '#ffffff' : D.textMuted,
              scale: !isRegister ? 1.05 : 1,
            }}
            transition={{ duration: 0.2 }}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 14,
              fontWeight: !isRegister ? 700 : 500,
              fontFamily: "'Inter', sans-serif",
              userSelect: 'none',
              letterSpacing: !isRegister ? '0.02em' : '0',
            }}
          >
            Вход
          </motion.span>
          <motion.span
            animate={{
              color: isRegister ? '#ffffff' : D.textMuted,
              scale: isRegister ? 1.05 : 1,
            }}
            transition={{ duration: 0.2 }}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 14,
              fontWeight: isRegister ? 700 : 500,
              fontFamily: "'Inter', sans-serif",
              userSelect: 'none',
              letterSpacing: isRegister ? '0.02em' : '0',
            }}
          >
            Регистрация
          </motion.span>
        </div>
      </motion.button>

      {/* Description text */}
      <motion.p
        key={mode}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.2)',
          fontFamily: "'Inter', sans-serif",
          textAlign: 'center',
          letterSpacing: '0.01em',
        }}
      >
        {isRegister
          ? 'Уже есть аккаунт? Нажмите чтобы войти'
          : 'Нет аккаунта? Нажмите чтобы зарегистрироваться'}
      </motion.p>
    </motion.div>
  );
}
