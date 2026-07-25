import { useCallback, useRef } from 'react';

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/**
 * Plays a short UI click sound using Web Audio API.
 * No external audio files needed — generates a subtle 50ms tick.
 */
export function playClickSound(volume = 0.15) {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  } catch {
    // Silent fail — audio not critical
  }
}

/**
 * Hook that returns an onClick handler with click sound.
 * Attach to any interactive element (button, link, etc.)
 */
export function useClickSound(volume = 0.15) {
  const lastPlayRef = useRef(0);

  const onClick = useCallback<React.MouseEventHandler<HTMLElement>>(
    (e) => {
      // Debounce: max once per 30ms
      const now = Date.now();
      if (now - lastPlayRef.current < 30) return;
      lastPlayRef.current = now;

      playClickSound(volume);
    },
    [volume],
  );

  return onClick;
}
