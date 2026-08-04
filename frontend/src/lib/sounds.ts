/**
 * Nexo Sound Engine — deep, warm, signature sounds.
 * Uses Web Audio synthesis for UI clicks and the branded audio files
 * (frontend/public/sounds/*) for notifications, sends, calls and errors.
 */

import { getSoundsEnabled } from './soundSettings';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function sweep(freq: number, oscType: OscillatorType, amp: number, dur: number, attack = 0.005, glideTo?: number) {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = oscType;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(amp, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Deep warm click for buttons (replaces the thin Apple-style tap). */
export function playClick() {
  if (!getSoundsEnabled()) return;
  try {
    sweep(180, 'sine', 0.12, 0.09, 0.004, 90);
    sweep(720, 'triangle', 0.03, 0.045, 0.003, 400);
  } catch {}
}

/** Branded deep notification thump — «Нексо-бум». */
export function playNotification() {
  if (!getSoundsEnabled()) return;
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(61.7, t);
    osc.frequency.exponentialRampToValueAtTime(49, t + 0.55);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    osc.start(t);
    osc.stop(t + 0.7);
    // warmth layer
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.connect(g2);
    g2.connect(ctx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(123.5, t);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc2.start(t);
    osc2.stop(t + 0.5);
    // bright shimmer tail
    sweep(369.99, 'sine', 0.05, 0.3, 0.01, 330);
  } catch {}
}

/** Juicy deep pop when a message is sent. */
export function playSend() {
  if (!getSoundsEnabled()) return;
  try {
    sweep(55, 'sine', 0.35, 0.22, 0.004, 41);
    sweep(880, 'sine', 0.035, 0.05, 0.002, 700);
  } catch {}
}

/** Deep pleasant ringing for calls (file-based loop handled by caller). */
export function playRingtone() {
  if (!getSoundsEnabled()) return;
  try {
    sweep(61.7, 'sine', 0.3, 0.4, 0.02, 61.7);
    sweep(82.4, 'sine', 0.3, 0.4, 0.02, 82.4);
  } catch {}
}

/** Play a static audio file from /sounds (for push/service-worker style tones). */
export function playSoundFile(path: string, loop = false): HTMLAudioElement | null {
  if (!getSoundsEnabled()) return null;
  try {
    const audio = new Audio(path);
    audio.loop = loop;
    audio.volume = 0.8;
    audio.play().catch(() => {});
    return audio;
  } catch {
    return null;
  }
}
