import { useRef, useState, useCallback, useEffect, ReactNode } from 'react';
import { cn } from '../../lib/utils';

// ── CSS Variables (auto-injected, SSR-safe) ────────────────
const __SHAKE_STYLES = `
:root {
  --shake-distance: 6px;
  --shake-overshoot: 4px;
  --shake-dur-a: 80ms;
  --shake-dur-b: 60ms;
  --shake-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --revert-hold: 3000ms;
  --revert-dur: 280ms;
}

/* Shake input wrapper */
.nexo-shake-input {
  transition: border-color 150ms ease-out;
  will-change: transform;
}
.nexo-shake-input.is-error {
  transition: border-color var(--revert-dur, 280ms) ease-out;
}

/* Error message reveal */
.nexo-shake-msg {
  opacity: 0;
  visibility: hidden;
  transition:
    opacity    var(--revert-dur, 280ms) ease-out,
    visibility 0s linear var(--revert-dur, 280ms);
}
.nexo-shake-wrap.is-error .nexo-shake-msg {
  opacity: 1;
  visibility: visible;
  transition:
    opacity    var(--revert-dur, 280ms) ease-out,
    visibility 0s linear 0s;
}

/* Multi-segment shake keyframe */
.nexo-shake-input.is-shaking {
  animation: nexo-input-shake calc(
      var(--shake-dur-a) * 2 + var(--shake-dur-b) * 2
    ) linear;
}
@keyframes nexo-input-shake {
  0%      { transform: translateX(0);                                 animation-timing-function: var(--shake-ease); }
  28.57%  { transform: translateX(var(--shake-distance));             animation-timing-function: var(--shake-ease); }
  57.14%  { transform: translateX(calc(var(--shake-distance) * -1)); animation-timing-function: var(--shake-ease); }
  78.57%  { transform: translateX(var(--shake-overshoot));            animation-timing-function: var(--shake-ease); }
  100%    { transform: translateX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .nexo-shake-input { animation: none !important; transform: none !important; }
}
`;

// Auto-inject styles on first import (idempotent)
if (typeof document !== 'undefined' && !document.getElementById('nexo-shake-styles')) {
  const __style = document.createElement('style');
  __style.id = 'nexo-shake-styles';
  __style.textContent = __SHAKE_STYLES;
  document.head.appendChild(__style);
}

// ── Helper ─────────────────────────────────────────────────
function readMs(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

// ── Props ──────────────────────────────────────────────────
export interface InputShakeProps {
  /** The input element to wrap */
  children: ReactNode;
  /** Error message to display below the input */
  message?: string;
  /** Whether the error state is active */
  error?: boolean;
  /** Called when user starts typing (to clear error early) */
  onCancel?: () => void;
  /** Additional class names for the wrapper div */
  className?: string;
  /** Additional class names for the input container div */
  inputClassName?: string;
}

/**
 * InputShake — wraps an input with error shake animation.
 *
 * Usage:
 *   <InputShake error={hasError} message="Invalid email">
 *     <input type="email" onInput={clearError} />
 *   </InputShake>
 */
export function InputShake({
  children,
  message,
  error = false,
  onCancel,
  className,
  inputClassName,
}: InputShakeProps) {
  const inputRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shaking, setShaking] = useState(false);

  // Trigger shake animation
  const triggerShake = useCallback(() => {
    if (!inputRef.current) return;
    setShaking(false);
    // Force reflow to restart animation
    void inputRef.current.offsetWidth;
    setShaking(true);

    // Auto-revert after hold time
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const shakeMs =
      readMs('--shake-dur-a', 80) * 2 +
      readMs('--shake-dur-b', 60) * 2;
    const hold = readMs('--revert-hold', 3000);
    timerRef.current = window.setTimeout(() => {
      setShaking(false);
      timerRef.current = null;
    }, shakeMs + hold);
  }, []);

  // Trigger shake when error becomes true
  useEffect(() => {
    if (error) {
      triggerShake();
    } else {
      // Clear error — cancel any pending timer
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setShaking(false);
    }
  }, [error, triggerShake]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  // Cancel error on user input
  const cancel = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShaking(false);
    onCancel?.();
  }, [onCancel]);

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('nexo-shake-wrap', error && 'is-error')}>
        <div
          ref={inputRef}
          className={cn(
            'nexo-shake-input',
            error && 'is-error',
            shaking && 'is-shaking',
            inputClassName
          )}
          onInput={cancel}
        >
          {children}
        </div>
        {message && (
          <p className="nexo-shake-msg mt-1.5 text-xs text-red-400">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default InputShake;
