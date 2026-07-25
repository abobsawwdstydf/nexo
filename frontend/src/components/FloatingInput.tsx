import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';

const D = {
  primary: '#5865f2',
  primaryHover: '#4752c4',
  card: '#1e1f22',
  input: '#141518',
  textPrimary: '#f2f3f5',
  textDim: '#4e5058',
  textMuted: '#949ba4',
  border: 'rgba(255,255,255,0.03)',
} as const;

interface FloatingInputProps {
  icon: ReactNode;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  autoFocus?: boolean;
  right?: ReactNode;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  autoComplete?: string;
  disabled?: boolean;
  delay?: number;
}

export default function FloatingInput({
  icon, type = 'text', value, onChange, placeholder, autoFocus, right, onKeyDown, autoComplete, disabled, delay = 0,
}: FloatingInputProps) {
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: 'relative', marginBottom: 18 }}
    >
      {/* Glow ring on focus */}
      <motion.div
        animate={focused
          ? { boxShadow: '0 0 0 3px rgba(88,101,242,0.18), 0 4px 20px rgba(88,101,242,0.12)' }
          : { boxShadow: '0 0 0 0px rgba(88,101,242,0), 0 2px 8px rgba(0,0,0,0.15)' }
        }
        transition={{ duration: 0.25, ease: 'easeOut' }}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          background: D.input,
          border: `1.5px solid ${focused ? D.primary : 'rgba(255,255,255,0.06)'}`,
          borderRadius: 12,
          transition: 'border-color 0.25s',
        }}
      >
        {/* Icon */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 42,
          flexShrink: 0,
          color: focused ? D.primary : D.textDim,
          transition: 'color 0.2s',
        }}>
          {icon}
        </div>

        {/* Input */}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder=""
          autoFocus={autoFocus}
          onKeyDown={onKeyDown}
          autoComplete={autoComplete}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: D.textPrimary,
            fontSize: 14,
            padding: '14px 0',
            fontFamily: "'Inter', sans-serif",
            caretColor: D.primary,
          }}
        />

        {/* Floating label — centered in the input area (right of icon) */}
        <motion.span
          animate={{
            top: focused || hasValue ? 4 : '50%',
            left: focused || hasValue ? 48 : 42,
            x: focused || hasValue ? 0 : 0,
            y: focused || hasValue ? 0 : '-50%',
            scale: focused || hasValue ? 0.82 : 1,
            color: focused ? D.primary : hasValue ? D.textMuted : D.textDim,
          }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            top: '50%',
            left: 42,
            width: 'calc(100% - 42px)',
            textAlign: 'center',
            pointerEvents: 'none',
            fontSize: 14,
            fontFamily: "'Inter', sans-serif",
            whiteSpace: 'nowrap',
          }}
        >
          {placeholder}
        </motion.span>

        {/* Right button (eye toggle, etc.) */}
        {right && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            flexShrink: 0,
            paddingRight: 6,
          }}>
            {right}
          </div>
        )}
      </motion.div>

      {/* Animated underline glow */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: '10%',
        right: '10%',
        height: 2,
        borderRadius: 2,
        background: 'transparent',
        overflow: 'hidden',
      }}>
        <motion.div
          animate={focused
            ? { scaleX: 1, opacity: 1 }
            : { scaleX: 0, opacity: 0 }
          }
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: '100%',
            height: '100%',
            background: `linear-gradient(90deg, transparent, ${D.primary}, #8b5cf6, transparent)`,
            borderRadius: 2,
            transformOrigin: 'center',
          }}
        />
      </div>
    </motion.div>
  );
}
