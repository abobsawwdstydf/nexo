/**
 * Hook for subtle click sounds on buttons.
 * Uses Web Audio API — no audio files needed.
 * Sound: soft click like macOS / iOS keyboard.
 */

import { getSoundsEnabled } from './soundSettings';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playClick() {
  if (!getSoundsEnabled()) return;
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    // Layer 1: crisp high tap
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.connect(g1); g1.connect(ctx.destination);
    osc1.frequency.value = 2400 + Math.random() * 400;
    osc1.type = 'sine';
    g1.gain.setValueAtTime(0.035, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    osc1.start(t); osc1.stop(t + 0.02);
    // Layer 2: soft body thump
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.connect(g2); g2.connect(ctx.destination);
    osc2.frequency.value = 400 + Math.random() * 100;
    osc2.type = 'sine';
    g2.gain.setValueAtTime(0.025, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
    osc2.start(t); osc2.stop(t + 0.015);
  } catch {}
}

/**
 * AudioClickWrapper — wraps children so all child buttons play a click sound.
 * Uses event delegation on mousedown for performance.
 */
export function AudioClickWrapper({ children }: { children: React.ReactNode }) {
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]') || target.closest('a')) {
      playClick();
    }
  };

  return (
    <div onMouseDown={handleMouseDown} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
