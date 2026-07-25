import { useEffect } from 'react';
import { useCallSettingsStore, CallSettings } from '../stores/callSettingsStore';
import { getSocket } from '../lib/socket';

/**
 * Hook to sync call settings across devices via socket
 */
export function useCallSettingsSync() {
  const settings = useCallSettingsStore();
  
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !settings.syncAcrossDevices || !settings.deviceId) return;
    
    // Send settings to server when they change
    const unsubscribe = useCallSettingsStore.subscribe(
      (state) => {
        const newSettings = {
          callLayout: state.callLayout,
          buttonSize: state.buttonSize,
          showLabels: state.showLabels,
          animatedGradients: state.animatedGradients,
          noiseSuppression: state.noiseSuppression,
          echoCancellation: state.echoCancellation,
          voiceEffect: state.voiceEffect,
          virtualBackground: state.virtualBackground,
          backgroundImageUrl: state.backgroundImageUrl,
          recordCalls: state.recordCalls,
          showConnectionQuality: state.showConnectionQuality,
          showWaveform: state.showWaveform,
        };
        socket.emit('call_settings:update', {
          deviceId: settings.deviceId,
          settings: newSettings,
        });
        return newSettings;
      }
    );
    
    // Listen for settings updates from other devices
    const handleSettingsUpdate = (data: { deviceId: string; settings: Partial<CallSettings> }) => {
      if (data.deviceId === settings.deviceId) return; // Ignore own updates
      
      const { settings: newSettings } = data;
      useCallSettingsStore.setState(newSettings);
    };
    
    socket.on('call_settings:sync', handleSettingsUpdate);
    
    return () => {
      unsubscribe();
      socket.off('call_settings:sync', handleSettingsUpdate);
    };
  }, [settings.syncAcrossDevices, settings.deviceId]);
}
