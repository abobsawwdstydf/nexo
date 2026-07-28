import { create } from 'zustand';

export interface CallSettings {
  callLayout: 'grid' | 'pip';
  buttonSize: 'small' | 'medium' | 'large';
  showLabels: boolean;
  animatedGradients: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  voiceEffect: string;
  virtualBackground: boolean;
  backgroundImageUrl: string;
  recordCalls: boolean;
  showConnectionQuality: boolean;
  showWaveform: boolean;
  syncAcrossDevices: boolean;
  deviceId: string;
}

export interface CallSettingsStore extends CallSettings {
  set: (settings: Partial<CallSettings>) => void;
}

export const useCallSettingsStore = create<CallSettingsStore>((set) => ({
  callLayout: 'grid',
  buttonSize: 'medium',
  showLabels: true,
  animatedGradients: true,
  noiseSuppression: true,
  echoCancellation: true,
  voiceEffect: 'none',
  virtualBackground: false,
  backgroundImageUrl: '',
  recordCalls: false,
  showConnectionQuality: true,
  showWaveform: false,
  syncAcrossDevices: false,
  deviceId: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  set: (settings) => set(settings),
}));
