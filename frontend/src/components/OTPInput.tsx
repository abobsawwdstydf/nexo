import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const D = {
  primary: '#5865f2',
  primaryHover: '#4752c4',
  card: '#1e1f22',
  input: '#141518',
  textPrimary: '#f2f3f5',
  textDim: '#4e5058',
  textMuted: '#949ba4',
  success: '#3ba55d',
  error: '#ed4245',
  border: 'rgba(255,255,255,0.06)',
  borderFocus: 'rgba(88,101,242,0.5)',
  borderSuccess: 'rgba(59,165,93,0.5)',
  borderError: 'rgba(237,66,69,0.5)',
} as const;

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  error?: boolean;
  success?: boolean;
  placeholder?: string;
}

export default function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  autoFocus = true,
  disabled = false,
  error = false,
  success = false,
  placeholder = '0',
}: OTPInputProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(autoFocus ? 0 : -1);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));

  // Sync external value with internal state
  useEffect(() => {
    const newDigits = value.split('').slice(0, length);
    while (newDigits.length < length) newDigits.push('');
    setDigits(newDigits);
  }, [value, length]);

  // Focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus]);

  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < length && inputRefs.current[index]) {
      inputRefs.current[index]?.focus();
      setFocusedIndex(index);
    }
  }, [length]);

  const handleChange = useCallback((index: number, inputValue: string) => {
    if (disabled) return;

    // Handle paste
    if (inputValue.length > 1) {
      const pastedDigits = inputValue.replace(/\D/g, '').slice(0, length).split('');
      const newDigits = [...digits];
      pastedDigits.forEach((digit, i) => {
        if (index + i < length) {
          newDigits[index + i] = digit;
        }
      });
      setDigits(newDigits);
      onChange(newDigits.join(''));

      // Focus next empty or last
      const nextEmptyIndex = newDigits.findIndex(d => d === '');
      const focusIdx = nextEmptyIndex === -1 ? length - 1 : Math.min(nextEmptyIndex, length - 1);
      setTimeout(() => focusInput(focusIdx), 0);
      return;
    }

    // Handle single digit
    const digit = inputValue.replace(/\D/g, '');
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    const newValue = newDigits.join('');
    onChange(newValue);

    // Auto-advance to next input
    if (digit && index < length - 1) {
      setTimeout(() => focusInput(index + 1), 0);
    }

    // NOTE: onComplete is NOT called automatically on input.
    // User must click the submit button or press Enter to confirm.
    // This prevents premature validation before the user intends to submit.
  }, [digits, length, disabled, onChange, onComplete, focusInput]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      const newDigits = [...digits];
      if (digits[index]) {
        // Clear current digit
        newDigits[index] = '';
        setDigits(newDigits);
        onChange(newDigits.join(''));
      } else if (index > 0) {
        // Move to previous and clear
        newDigits[index - 1] = '';
        setDigits(newDigits);
        onChange(newDigits.join(''));
        setTimeout(() => focusInput(index - 1), 0);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      focusInput(index + 1);
    } else if (e.key === 'Enter' && digits.join('').length === length) {
      onComplete?.(digits.join(''));
    }
  }, [digits, length, disabled, onChange, onComplete, focusInput]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    if (pastedData.length > 0) {
      handleChange(0, pastedData);
    }
  }, [handleChange]);

  const getBorderColor = (index: number) => {
    if (error) return D.borderError;
    if (success) return D.borderSuccess;
    if (focusedIndex === index) return D.borderFocus;
    if (digits[index]) return 'rgba(255,255,255,0.12)';
    return D.border;
  };

  const getGlowColor = (index: number) => {
    if (error) return '0 0 0 3px rgba(237,66,69,0.18), 0 4px 20px rgba(237,66,69,0.12)';
    if (success) return '0 0 0 3px rgba(59,165,93,0.18), 0 4px 20px rgba(59,165,93,0.12)';
    if (focusedIndex === index) return '0 0 0 3px rgba(88,101,242,0.18), 0 4px 20px rgba(88,101,242,0.12)';
    return '0 2px 8px rgba(0,0,0,0.15)';
  };

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
      {Array.from({ length }, (_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ 
            opacity: 1, 
            y: 0, 
            scale: 1,
          }}
          transition={{ 
            delay: index * 0.05,
            type: 'spring',
            stiffness: 300,
            damping: 20,
          }}
        >
          <motion.input
            ref={el => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={length} // Allow paste
            value={digits[index]}
            onChange={e => handleChange(index, e.target.value)}
            onKeyDown={e => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => setFocusedIndex(-1)}
            disabled={disabled}
            placeholder={placeholder}
            autoFocus={autoFocus && index === 0}
            style={{
              width: 48,
              height: 56,
              textAlign: 'center',
              fontSize: 22,
              fontWeight: 700,
              fontFamily: "'Inter', sans-serif",
              background: D.input,
              border: `2px solid ${getBorderColor(index)}`,
              borderRadius: 12,
              color: error ? D.error : success ? D.success : D.textPrimary,
              outline: 'none',
              caretColor: D.primary,
              transition: 'border-color 0.2s, color 0.2s',
              letterSpacing: '0.05em',
            }}
            animate={{
              boxShadow: getGlowColor(index),
              scale: focusedIndex === index ? 1.05 : 1,
            }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          />
          
          {/* Animated underline indicator */}
          <motion.div
            style={{
              height: 2,
              borderRadius: 2,
              marginTop: 4,
              background: 'transparent',
              overflow: 'hidden',
            }}
          >
            <motion.div
              animate={{
                scaleX: focusedIndex === index ? 1 : 0,
                opacity: focusedIndex === index ? 1 : 0,
              }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                width: '100%',
                height: '100%',
                background: error ? D.error : success ? D.success : `linear-gradient(90deg, transparent, ${D.primary}, #8b5cf6, transparent)`,
                transformOrigin: 'center',
              }}
            />
          </motion.div>
          
          {/* Active dot indicator */}
          <AnimatePresence>
            {focusedIndex === index && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: D.primary,
                  margin: '4px auto 0',
                  boxShadow: `0 0 8px ${D.primary}`,
                }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
}

// Export for use in other components
export type { OTPInputProps };
