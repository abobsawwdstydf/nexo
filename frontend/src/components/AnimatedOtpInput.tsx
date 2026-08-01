import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED OTP INPUT
// Auto-advance + backspace, animated focus/validation, masking, accessible.
// Animations (slot entrance, digit flip, blinking caret) are disabled when
// the user prefers reduced motion.
// ═══════════════════════════════════════════════════════════════════════════

export interface AnimatedInputOTPTheme {
  border: string;
  borderFocused: string;
  inputBg: string;
  textPrimary: string;
  primary: string;
  success: string;
  error: string;
}

export const ANIMATED_OTP_DEFAULT_THEME: AnimatedInputOTPTheme = {
  border: 'rgba(255,255,255,0.12)',
  borderFocused: 'rgba(255,255,255,0.5)',
  inputBg: 'rgba(255,255,255,0.04)',
  textPrimary: '#ffffff',
  primary: '#ffffff',
  success: '#3ba55d',
  error: '#ed4245',
};

export interface AnimatedInputOTPProps {
  /** Number of digit slots. Defaults to 6. */
  length?: number;
  /** Controlled value (digits only). */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  /** Called with the current value on every change. */
  onChange?: (value: string) => void;
  /** Called when `length` digits have been entered. */
  onComplete?: (value: string) => void;
  /** Marks validation as failed → red slots + shake. */
  error?: boolean;
  /** Marks validation as successful → green slots. */
  success?: boolean;
  disabled?: boolean;
  /** Focuses the first slot on mount. */
  autoFocus?: boolean;
  /** Mask the entered digits. `true` → dot, or a custom character. */
  mask?: boolean | string;
  /** Accessible name of the OTP input. Defaults to "One-time password input". */
  ariaLabel?: string;
  /** References a description element for additional context. */
  ariaDescribedBy?: string;
  fontFamily?: string;
  /** Played when a digit is entered. */
  onSlotType?: () => void;
  /** Played when a digit is erased. */
  onSlotErase?: () => void;
  theme?: Partial<AnimatedInputOTPTheme>;
}

export function AnimatedOtpInput({
  length = 6,
  value: controlledValue,
  defaultValue = '',
  onChange,
  onComplete,
  error = false,
  success = false,
  disabled = false,
  autoFocus = false,
  mask = false,
  ariaLabel = 'One-time password input',
  ariaDescribedBy,
  fontFamily = `-apple-system, 'Segoe UI', system-ui, sans-serif`,
  onSlotType,
  onSlotErase,
  theme,
}: AnimatedInputOTPProps) {
  const reduceMotion = useReducedMotion();
  const t = { ...ANIMATED_OTP_DEFAULT_THEME, ...theme };

  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = controlledValue ?? internalValue;
  const setValue = useCallback(
    (next: string) => {
      if (controlledValue === undefined) setInternalValue(next);
      onChange?.(next);
    },
    [controlledValue, onChange],
  );

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [shakeKey, setShakeKey] = useState(0);
  const prevError = useRef(false);

  useEffect(() => {
    if (autoFocus) {
      const raf = requestAnimationFrame(() => inputRefs.current[0]?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, [autoFocus]);

  useEffect(() => {
    if (error && !prevError.current) setShakeKey(k => k + 1);
    prevError.current = error;
  }, [error]);

  useEffect(() => {
    if (value.length === length) onComplete?.(value);
  }, [value, length, onComplete]);

  const maskChar = mask === true ? '•' : typeof mask === 'string' ? mask : null;

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[i] = digit;
    setValue(arr.join('').slice(0, length));
    onSlotType?.();
    if (digit && i < length - 1) {
      inputRefs.current[i + 1]?.focus();
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[i]) {
        const arr = value.split('');
        arr[i] = '';
        setValue(arr.join(''));
        onSlotErase?.();
        if (i > 0) inputRefs.current[i - 1]?.focus();
      } else if (i > 0) {
        onSlotErase?.();
        inputRefs.current[i - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    setValue(pasted);
    onSlotType?.();
    const target = Math.min(pasted.length, length - 1);
    inputRefs.current[target]?.focus();
  };

  const entranceDelay = (i: number) => (reduceMotion ? 0 : i * 0.045);

  return (
    <motion.div
      role="group"
      aria-label={ariaLabel}
      key={shakeKey}
      style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}
      animate={error && !reduceMotion ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: 'easeInOut' }}
    >
      {Array.from({ length }, (_, i) => {
        const isFocused = focusedIndex === i;
        const filled = Boolean(value[i]);
        const accent = success ? t.success : error ? t.error : t.primary;
        const slotBorder = success ? t.success : error ? t.error : isFocused ? t.borderFocused : t.border;
        const glow = success
          ? 'rgba(59,165,93,0.35)'
          : error
            ? 'rgba(237,66,69,0.35)'
            : isFocused
              ? 'rgba(255,255,255,0.18)'
              : 'rgba(0,0,0,0)';

        return (
          <motion.div
            key={i}
            initial={reduceMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 14, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.34, delay: entranceDelay(i), ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              style={{
                position: 'relative',
                width: 50,
                height: 58,
                borderRadius: 14,
                background: `linear-gradient(180deg, rgba(255,255,255,0.08), ${t.inputBg})`,
                border: `2px solid ${slotBorder}`,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: isFocused ? `0 0 0 4px ${glow}, 0 8px 24px rgba(0,0,0,0.35)` : `0 4px 16px rgba(0,0,0,0.2)`,
                transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
                overflow: 'hidden',
              }}
            >
              {/* Digit display with flip animation */}
              <AnimatePresence mode="popLayout" initial={false}>
                {filled && (
                  <motion.span
                    key={`${i}-${value[i]}`}
                    initial={reduceMotion ? { opacity: 1, rotateX: 0, y: 0 } : { opacity: 0, rotateX: 90, y: 8, scale: 0.7 }}
                    animate={{ opacity: 1, rotateX: 0, y: 0, scale: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0, rotateX: -90, y: -8, scale: 0.7 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: filled && !success && !error ? t.textPrimary : accent,
                      fontSize: 24,
                      fontWeight: 600,
                      fontFamily,
                      pointerEvents: 'none',
                      transformStyle: 'preserve-3d',
                    }}
                  >
                    {maskChar ?? value[i]}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Blinking caret */}
              {isFocused && !filled && !reduceMotion && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, repeatType: 'reverse' }}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 2,
                    height: 24,
                    borderRadius: 2,
                    background: t.primary,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    boxShadow: `0 0 8px ${t.primary}`,
                  }}
                />
              )}

              {/* Invisible native input for keyboard + mobile support */}
              <input
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                name={`otp-${i}`}
                maxLength={1}
                disabled={disabled}
                value={value[i] || ''}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={handlePaste}
                onFocus={() => setFocusedIndex(i)}
                onBlur={() => setFocusedIndex(-1)}
                aria-label={`${ariaLabel} ${i + 1} из ${length}`}
                aria-describedby={ariaDescribedBy}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  cursor: 'text',
                  fontSize: 24,
                  color: 'transparent',
                  caretColor: 'transparent',
                  margin: 0,
                  padding: 0,
                }}
              />
            </motion.div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
