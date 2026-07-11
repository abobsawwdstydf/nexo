import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CallLayout = 'compact' | 'standard' | 'spacious';
export type ButtonSize = 'small' | 'medium' | 'large';
export type VirtualBackground = 'none' | 'blur' | 'image';
export type VoiceEffect = 'normal' | 'robot' | 'chipmunk' | 'demon';

export interface CallSettings {
  // Layout
  callLayout: CallLayout;
  buttonSize: ButtonSize;
  showLabels: boolean;
  animatedGradients: boolean;
  
  // Audio
  autoGainControl: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  voiceEffect: VoiceEffect;
  
  // Video
  defaultVideoQuality: 'low' | 'medium' | 'high';
  mirrorVideo: boolean;
  virtualBackground: VirtualBackground;
  backgroundImageUrl: string | null;
  
  // Call features
  recordCalls: boolean;
  showConnectionQuality: boolean;
  showWaveform: boolean;
  enableScreenShare: boolean;
  
  // Sync
  syncAcrossDevices: boolean;
  deviceId: string;
  
  // Actions
  setCallLayout: (layout: CallLayout) => void;
  setButtonSize: (size: ButtonSize) => void;
  setShowLabels: (show: boolean) => void;
  setAnimatedGradients: (enabled: boolean) => void;
  setAutoGainControl: (enabled: boolean) => void;
  setNoiseSuppression: (enabled: boolean) => void;
  setEchoCancellation: (enabled: boolean) => void;
  setVoiceEffect: (effect: VoiceEffect) => void;
  setDefaultVideoQuality: (quality: 'low' | 'medium' | 'high') => void;
  setMirrorVideo: (enabled: boolean) => void;
  setVirtualBackground: (bg: VirtualBackground) => void;
  setBackgroundImageUrl: (url: string | null) => void;
  setRecordCalls: (enabled: boolean) => void;
  setShowConnectionQuality: (enabled: boolean) => void;
  setShowWaveform: (enabled: boolean) => void;
  setEnableScreenShare: (enabled: boolean) => void;
  setSyncAcrossDevices: (enabled: boolean) => void;
  generateDeviceId: () => void;
}

function generateUniqueId(): string {
  return `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useCallSettingsStore = create<CallSettings>()(
  persist(
    (set, get) => ({
      // Default settings
      callLayout: 'standard',
      buttonSize: 'medium',
      showLabels: true,
      animatedGradients: true,
      
      // Audio defaults
      autoGainControl: true,
      noiseSuppression: true,
      echoCancellation: true,
      voiceEffect: 'normal',
      
      // Video defaults
      defaultVideoQuality: 'high',
      mirrorVideo: true,
      virtualBackground: 'none',
      backgroundImageUrl: null,
      
      // Call features
      recordCalls: false,
      showConnectionQuality: true,
      showWaveform: true,
      enableScreenShare: true,
      
      // Sync
      syncAcrossDevices: false,
      deviceId: '',
      
      // Actions
      setCallLayout: (layout) => set({ callLayout: layout }),
      setButtonSize: (size) => set({ buttonSize: size }),
      setShowLabels: (show) => set({ showLabels: show }),
      setAnimatedGradients: (enabled) => set({ animatedGradients: enabled }),
      setAutoGainControl: (enabled) => set({ autoGainControl: enabled }),
      setNoiseSuppression: (enabled) => set({ noiseSuppression: enabled }),
      setEchoCancellation: (enabled) => set({ echoCancellation: enabled }),
      setVoiceEffect: (effect) => set({ voiceEffect: effect }),
      setDefaultVideoQuality: (quality) => set({ defaultVideoQuality: quality }),
      setMirrorVideo: (enabled) => set({ mirrorVideo: enabled }),
      setVirtualBackground: (bg) => set({ virtualBackground: bg }),
      setBackgroundImageUrl: (url) => set({ backgroundImageUrl: url }),
      setRecordCalls: (enabled) => set({ recordCalls: enabled }),
      setShowConnectionQuality: (enabled) => set({ showConnectionQuality: enabled }),
      setShowWaveform: (enabled) => set({ showWaveform: enabled }),
      setEnableScreenShare: (enabled) => set({ enableScreenShare: enabled }),
      setSyncAcrossDevices: (enabled) => set({ syncAcrossDevices: enabled }),
      
      generateDeviceId: () => {
        const newId = generateUniqueId();
        set({ deviceId: newId });
        return newId;
      },
    }),
    {
      name: 'nexo-call-settings',
      partialize: (state) => ({
        callLayout: state.callLayout,
        buttonSize: state.buttonSize,
        showLabels: state.showLabels,
        animatedGradients: state.animatedGradients,
        autoGainControl: state.autoGainControl,
        noiseSuppression: state.noiseSuppression,
        echoCancellation: state.echoCancellation,
        voiceEffect: state.voiceEffect,
        defaultVideoQuality: state.defaultVideoQuality,
        mirrorVideo: state.mirrorVideo,
        virtualBackground: state.virtualBackground,
        backgroundImageUrl: state.backgroundImageUrl,
        recordCalls: state.recordCalls,
        showConnectionQuality: state.showConnectionQuality,
        showWaveform: state.showWaveform,
        enableScreenShare: state.enableScreenShare,
        syncAcrossDevices: state.syncAcrossDevices,
        deviceId: state.deviceId,
      }),
    }
  )
);
