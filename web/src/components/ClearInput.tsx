// Adapted from Transitions.dev — Input clear with dissolve
// Added: controlled (value/onChange), leftIcon, ref forwarding, className passthrough

import { useEffect, useRef, forwardRef, useImperativeHandle, type ReactNode } from "react";

// ── Styles ──────────────────────────────────────────────
const __TRANSITION_STYLES = `
:root {
  --clear-dur: 1000ms;
  --clear-out-dur: 400ms;
  --clear-in-dur: 400ms;
  --clear-out-fly: 12px;
  --clear-in-fly: 12px;
  --clear-out-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --clear-in-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --clear-blur: 2px;
  --glow-delay: 50ms;
  --glow-peak-at: 0.15;
  --glow-opacity: 0.85;
  --glow-spread: 1.5;
}
.t-clear {
  position: relative;
  overflow: hidden;
}
.t-clear-mirror,
.t-clear-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  z-index: 2;
}
.t-clear-mirror { opacity: 0; }
.t-clear.has-value .t-clear-mirror,
.t-clear.is-clearing .t-clear-mirror { opacity: 1; }
.t-clear.has-value > input,
.t-clear.is-clearing > input {
  -webkit-text-fill-color: transparent;
}
.t-clear.has-value .t-clear-placeholder { opacity: 0; }
.t-clear-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  z-index: 3;
  mix-blend-mode: multiply;
}
.t-clear-left-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 4;
  display: flex;
  align-items: center;
  pointer-events: none;
  color: inherit;
}
.t-clear > input { width: 100%; }
.t-clear.has-icon > input,
.t-clear.has-icon .t-clear-mirror,
.t-clear.has-icon .t-clear-placeholder { padding-left: 0; }
.t-clear-btn {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 5;
  display: none;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border: none;
  border-radius: 9999px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;
  font-size: 14px;
  line-height: 1;
  opacity: 0.5;
  transition: opacity 0.15s;
}
.t-clear.has-value .t-clear-btn { display: flex; }
.t-clear-btn:hover { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .t-clear-glow { opacity: 0 !important; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("transitions-p13")) {
  const __style = document.createElement("style");
  __style.id = "transitions-p13";
  __style.textContent = __TRANSITION_STYLES;
  document.head.appendChild(__style);
}

export interface ClearInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  leftIcon?: ReactNode;
}

export interface ClearInputHandle {
  focus: () => void;
  blur: () => void;
  input: HTMLInputElement | null;
}

export const ClearInput = forwardRef<ClearInputHandle, ClearInputProps>(
  ({ value, onChange, onClear, leftIcon, className = "", placeholder = "", defaultValue, ...rest }, ref) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const fakePhRef = useRef<HTMLDivElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);
    const isClearing = useRef(false);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      get input() { return inputRef.current; },
    }));

    // Sync controlled value → mirror
    useEffect(() => {
      const wrap = wrapRef.current;
      const mirror = mirrorRef.current;
      if (!wrap || !mirror) return;
      const has = (value ?? "").length > 0;
      wrap.classList.toggle("has-value", has);
      if (has) {
        mirror.textContent = value!.replace(/ /g, "\u00a0");
      }
    }, [value]);

    // Also handle uncontrolled defaultValue on mount
    useEffect(() => {
      if (value !== undefined) return; // skip if controlled
      const wrap = wrapRef.current;
      const input = inputRef.current;
      if (!wrap || !input) return;
      const sync = () => {
        const has = input.value.length > 0;
        wrap.classList.toggle("has-value", has);
        if (has && mirrorRef.current) {
          mirrorRef.current.textContent = input.value.replace(/ /g, "\u00a0");
        }
      };
      input.addEventListener("input", sync);
      sync();
      return () => input.removeEventListener("input", sync);
    }, [value]);

    const handleClear = () => {
      const wrap = wrapRef.current;
      const input = inputRef.current;
      const mirror = mirrorRef.current;
      const fakePh = fakePhRef.current;
      const glow = glowRef.current;
      if (!wrap || !input || !mirror || !fakePh || !glow) return;
      if (isClearing.current) return;
      const currentValue = value ?? input.value;
      if (!currentValue) return;
      isClearing.current = true;
      const wasFocused = document.activeElement === input;
      mirror.textContent = currentValue.replace(/ /g, "\u00a0");
      const bg = buildLayers(wrap, mirror.textContent);
      const peakAt = readNum("--glow-peak-at", 0.15);
      const opacity = readNum("--glow-opacity", 0.42);
      const total = readNum("--clear-dur", 1000);
      const outDur = readNum("--clear-out-dur", 400);
      const inDur = readNum("--clear-in-dur", 400);
      const outFly = readNum("--clear-out-fly", 12);
      const inFly = readNum("--clear-in-fly", 12);
      const blurPx = readNum("--clear-blur", 2);
      const glowDly = readNum("--glow-delay", 50);
      const eOut = makeEase(readEase("--clear-out-ease", "cubic-bezier(0.22, 1, 0.36, 1)"));
      const eIn = makeEase(readEase("--clear-in-ease", "cubic-bezier(0.22, 1, 0.36, 1)"));

      // Clear the value — fire onChange for controlled, set .value for uncontrolled
      if (onChange) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, "value"
        )!.set!;
        nativeInputValueSetter.call(input, "");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        // Fire a synthetic onChange
        const syntheticEvent = {
          target: input,
          currentTarget: input,
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      } else {
        input.value = "";
      }

      wrap.classList.remove("has-value");
      wrap.classList.add("is-clearing");
      fakePh.style.transform = `translateY(-${inFly}px)`;
      fakePh.style.opacity = "0.9";
      fakePh.style.filter = `blur(${blurPx}px)`;
      glow.style.background = bg;
      glow.style.opacity = "0";

      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const p = Math.min(1, elapsed / total);
        const e = eOut(Math.min(1, elapsed / outDur));
        mirror.style.transform = `translateY(${(e * outFly).toFixed(1)}px)`;
        mirror.style.opacity = (1 - e).toFixed(3);
        mirror.style.filter = `blur(${(e * blurPx).toFixed(1)}px)`;
        const pe = eIn(Math.min(1, elapsed / inDur));
        fakePh.style.transform = `translateY(${(-inFly + pe * inFly).toFixed(1)}px)`;
        fakePh.style.opacity = (0.9 + pe * 0.1).toFixed(3);
        fakePh.style.filter = `blur(${(blurPx - pe * blurPx).toFixed(1)}px)`;
        let g = 0;
        if (elapsed > glowDly) {
          const remaining = Math.max(1, total - glowDly);
          const gp = Math.min(1, (elapsed - glowDly) / remaining);
          g = gp < peakAt ? gp / peakAt : 1 - (gp - peakAt) / (1 - peakAt);
        }
        glow.style.opacity = (g * opacity).toFixed(3);
        if (p < 1) requestAnimationFrame(tick);
        else {
          wrap.classList.remove("is-clearing");
          for (const el of [mirror, fakePh]) el.style.cssText = "";
          mirror.textContent = "";
          glow.style.opacity = "0";
          glow.style.background = "";
          isClearing.current = false;
          onClear?.();
          if (wasFocused) input.focus({ preventScroll: true });
        }
      };
      requestAnimationFrame(tick);
    };

    const hasVal = (value ?? "").length > 0;

    return (
      <div ref={wrapRef} className={`t-clear ${hasVal ? "has-value" : ""} ${leftIcon ? "has-icon" : ""} ${className}`}>
        {leftIcon && (
          <span className="t-clear-left-icon" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          placeholder={placeholder}
          {...rest}
        />
        <div ref={mirrorRef} className="t-clear-mirror" aria-hidden="true" />
        <div ref={fakePhRef} className="t-clear-placeholder" aria-hidden="true">
          {placeholder}
        </div>
        <div ref={glowRef} className="t-clear-glow" aria-hidden="true" />
        <button
          type="button"
          className="t-clear-btn"
          aria-label="Очистить"
          onPointerDown={(e) => { if (document.activeElement === inputRef.current) e.preventDefault(); }}
          onMouseDown={(e) => { if (document.activeElement === inputRef.current) e.preventDefault(); }}
          onClick={handleClear}
        >
          ×
        </button>
      </div>
    );
  }
);

ClearInput.displayName = "ClearInput";

// ── Helpers ─────────────────────────────────────────────
function buildLayers(wrap: HTMLDivElement, text: string) {
  const inputW = wrap.clientWidth || 280;
  const padLeft = 32;
  const segments = text.split(/(\s+)/);
  const spread = readNum("--glow-spread", 1.5);
  const ctx = (buildLayers as any)._ctx ||= (() => {
    const c = document.createElement("canvas").getContext("2d")!;
    c.font = "400 13px Inter, sans-serif";
    return c;
  })();
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const rgb = isDark ? "255,255,255" : "0,0,0";
  const layers: string[] = [];
  let x = 0;
  for (const seg of segments) {
    const w = ctx.measureText(seg).width;
    if (seg.trim()) {
      const cx = padLeft + x + w / 2;
      const hw = Math.max(w * 0.45, 8) * spread;
      const stops = [
        { dx: 0, rw: hw * 0.8, rh: 7, a: 0.22 },
        { dx: hw * 0.45, rw: hw * 0.55, rh: 8, a: 0.18 },
        { dx: -hw * 0.4, rw: hw * 0.65, rh: 6, a: 0.16 },
        { dx: hw * 0.15, rw: hw * 0.9, rh: 5, a: 0.14 },
      ];
      for (const l of stops) {
        const lx = ((cx + l.dx) / inputW * 100).toFixed(2);
        layers.push(
          `radial-gradient(ellipse ${Math.max(l.rw, 2).toFixed(1)}px ${l.rh}px at ${lx}% 100%, rgba(${rgb},${l.a.toFixed(3)}), transparent)`
        );
      }
    }
    x += w;
  }
  return layers.join(", ");
}

function readNum(name: string, fb: number) {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fb;
}

function readEase(name: string, fb: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fb;
}

function makeEase(ease: string) {
  const m = ease.match(/cubic-bezier\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i);
  if (!m) return (t: number) => t;
  const [x1, y1, x2, y2] = [m[1], m[2], m[3], m[4]].map(parseFloat);
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sX = (s: number) => ((ax * s + bx) * s + cx) * s;
  const sY = (s: number) => ((ay * s + by) * s + cy) * s;
  const dX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i++) {
      const dx = sX(s) - t;
      if (Math.abs(dx) < 1e-6) break;
      const d = dX(s);
      if (d === 0) break;
      s -= dx / d;
    }
    return sY(s);
  };
}
