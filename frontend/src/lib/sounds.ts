// Notification sound using Web Audio API — generates a pleasant chime
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

let keyboardAudio: HTMLAudioElement | null = null;
let keyboardAudioPromise: Promise<void> | null = null;

export function playKeyboardSound() {
  try {
    if (!keyboardAudio) {
      keyboardAudio = new Audio('/sounds/computer-keyboard.ogg');
      keyboardAudio.volume = 0.3;
    }
    keyboardAudio.currentTime = 0;
    const p = keyboardAudio.play();
    if (p) keyboardAudioPromise = p.catch(() => {});
  } catch (e) {
    console.warn('[sounds] Keyboard sound failed:', e);
  }
}

let sendAudio: HTMLAudioElement | null = null;

export function playSendSound() {
  try {
    if (!sendAudio) {
      sendAudio = new Audio('/sounds/otpravit_musik.wav');
      sendAudio.volume = 0.4;
    }
    sendAudio.currentTime = 0;
    sendAudio.play().catch(() => {});
  } catch (e) {
    console.warn('[sounds] Send sound failed:', e);
  }
}

let uvedAudio: HTMLAudioElement | null = null;

export function playUvedSound() {
  try {
    if (!uvedAudio) {
      uvedAudio = new Audio('/sounds/uved_musik.mp3');
      uvedAudio.volume = 0.5;
    }
    uvedAudio.currentTime = 0;
    uvedAudio.play().catch(() => {});
  } catch (e) {
    console.warn('[sounds] Notification sound failed:', e);
  }
}

export function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const now = ctx.currentTime;

    // Soft, warm notification — lower frequencies, triangle waves, gentle volume
    // First note — warm mellow tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second note — gentle higher tone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0.06, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.35);
  } catch (e) {
    // Audio context not supported — silent fail
  }
}

// Muted chats stored in localStorage
const MUTED_KEY = 'nexo_muted_chats';

export function getMutedChats(): Set<string> {
  try {
    const stored = localStorage.getItem(MUTED_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

export function toggleMuteChat(chatId: string): boolean {
  const muted = getMutedChats();
  if (muted.has(chatId)) {
    muted.delete(chatId);
  } else {
    muted.add(chatId);
  }
  localStorage.setItem(MUTED_KEY, JSON.stringify([...muted]));
  return muted.has(chatId);
}

export function isChatMuted(chatId: string): boolean {
  return getMutedChats().has(chatId);
}

// Call ringtone
let callAudio: HTMLAudioElement | null = null;
let callAudioContext: AudioContext | null = null;
let callOscillators: { osc: OscillatorNode; gain: GainNode }[] = [];

export function playCallRingtone() {
  try {
    // First try HTMLAudioElement approach
    if (callAudio) {
      callAudio.pause();
      callAudio.currentTime = 0;
    }
    callAudio = new Audio('/sounds/call_sound.mp3');
    callAudio.loop = true;
    callAudio.volume = 0.5;
    
    // Try to play, fallback to Web Audio API if blocked
    callAudio.play().catch(() => {
      // Browser blocked autoplay — use Web Audio API fallback
      playCallRingtoneWebAudio();
    });
  } catch (e) {
    // If HTMLAudioElement fails, use Web Audio API
    playCallRingtoneWebAudio();
  }
}

/**
 * Alternative ringtone using Web Audio API — more reliable for autoplay
 */
function playCallRingtoneWebAudio() {
  try {
    if (!callAudioContext) {
      callAudioContext = new AudioContext();
    }
    if (callAudioContext.state === 'suspended') {
      callAudioContext.resume();
    }

    // Stop any existing oscillators
    stopCallRingtoneWebAudio();

    const ctx = callAudioContext;
    const now = ctx.currentTime;

    // Create a pleasant ringing pattern — two alternating tones
    // Pattern: 440Hz + 480Hz (classic ringtone frequencies)
    const ringPattern = () => {
      const duration = 2.0; // 2 seconds ring cycle
      const ringOn = 0.8;   // ring for 0.8s
      const ringOff = 1.2;  // pause for 1.2s
      
      // Tone 1: 440 Hz
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.setValueAtTime(0.15, now + ringOn);
      gain1.gain.setValueAtTime(0, now + ringOn + 0.01);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + duration);
      callOscillators.push({ osc: osc1, gain: gain1 });

      // Tone 2: 480 Hz
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(480, now);
      gain2.gain.setValueAtTime(0.15, now);
      gain2.gain.setValueAtTime(0.15, now + ringOn);
      gain2.gain.setValueAtTime(0, now + ringOn + 0.01);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now);
      osc2.stop(now + duration);
      callOscillators.push({ osc: osc2, gain: gain2 });

      // Schedule next ring cycle
      const scheduleNext = () => {
        if (callOscillators.length > 0) {
          ringPattern();
        }
      };
      setTimeout(scheduleNext, duration * 1000);
    };

    ringPattern();
  } catch (e) {
    console.error('Web Audio ringtone failed:', e);
  }
}

function stopCallRingtoneWebAudio() {
  try {
    // Stop all oscillators
    callOscillators.forEach(({ osc, gain }) => {
      try {
        gain.gain.setValueAtTime(0, callAudioContext!.currentTime);
        osc.stop();
      } catch (e) {
        // Already stopped
      }
    });
    callOscillators = [];
  } catch (e) {
    // Silent fail
  }
}

export function stopCallRingtone() {
  try {
    if (callAudio) {
      callAudio.pause();
      callAudio.currentTime = 0;
      callAudio = null;
    }
    stopCallRingtoneWebAudio();
  } catch (e) {
    // silent fail
  }
}

// "Абонент недоступен" sound
export function playUnavailableSound(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const audio = new Audio('/sounds/abonent_nedostupen.mp3');
      audio.volume = 0.7;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    } catch (e) {
      resolve();
    }
  });
}

// ─── Call UI Sounds (Web Audio API) ─────────────────────────────────────

function playTone(frequency: number, duration: number, volume = 0.12, type: OscillatorType = 'sine') {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {}
}

/** Звук подключения к звонку — восходящая мелодия */
export function playCallConnect() {
  playTone(523.25, 0.15, 0.1, 'sine');
  setTimeout(() => playTone(659.25, 0.15, 0.1, 'sine'), 100);
  setTimeout(() => playTone(783.99, 0.2, 0.1, 'sine'), 200);
}

/** Звук отключения от звонка — нисходящая мелодия */
export function playCallDisconnect() {
  playTone(783.99, 0.15, 0.1, 'sine');
  setTimeout(() => playTone(659.25, 0.15, 0.1, 'sine'), 120);
  setTimeout(() => playTone(523.25, 0.25, 0.08, 'sine'), 240);
}

/** Звук включения мута — короткий щелчок (высокий) */
export function playMuteSound() {
  playTone(880, 0.06, 0.08, 'sine');
  setTimeout(() => playTone(660, 0.06, 0.06, 'sine'), 50);
}

/** Звук отключения мута — двойной щелчок (восходящий) */
export function playUnmuteSound() {
  playTone(660, 0.06, 0.08, 'sine');
  setTimeout(() => playTone(880, 0.1, 0.08, 'sine'), 50);
}

/** Звук включения камеры — мягкий блимп */
export function playCameraOnSound() {
  playTone(740, 0.08, 0.07, 'triangle');
  setTimeout(() => playTone(987, 0.12, 0.07, 'triangle'), 60);
}

/** Звук отключения камеры — приглушённый блимп */
export function playCameraOffSound() {
  playTone(987, 0.08, 0.07, 'triangle');
  setTimeout(() => playTone(740, 0.1, 0.06, 'triangle'), 60);
}

/** Звук начала демонстрации экрана — два тона вверх */
export function playScreenShareOnSound() {
  playTone(587.33, 0.1, 0.07, 'sine');
  setTimeout(() => playTone(880, 0.15, 0.08, 'sine'), 80);
}

/** Звук остановки демонстрации экрана — два тона вниз */
export function playScreenShareOffSound() {
  playTone(880, 0.1, 0.07, 'sine');
  setTimeout(() => playTone(587.33, 0.12, 0.06, 'sine'), 80);
}

/** Звук нажатия кнопки звонка — субтильный клик */
export function playCallButtonSound() {
  playTone(1200, 0.04, 0.06, 'sine');
}

/** Звук входящего звонка — пинг */
export function playIncomingCallSound() {
  playTone(880, 0.2, 0.12, 'sine');
  setTimeout(() => playTone(1108.73, 0.25, 0.12, 'sine'), 250);
}

/** Звук присоединения к голосовой комнате — приветствие */
export function playJoinRoomSound() {
  playTone(440, 0.12, 0.08, 'sine');
  setTimeout(() => playTone(554.37, 0.12, 0.08, 'sine'), 100);
  setTimeout(() => playTone(659.25, 0.18, 0.09, 'sine'), 200);
}

/** Звук выхода из голосовой комнаты */
export function playLeaveRoomSound() {
  playTone(659.25, 0.12, 0.08, 'sine');
  setTimeout(() => playTone(554.37, 0.12, 0.07, 'sine'), 100);
  setTimeout(() => playTone(440, 0.2, 0.06, 'sine'), 200);
}
