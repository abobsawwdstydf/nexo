import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, Maximize, Minimize, SwitchCamera, Minimize2, Maximize2, Volume2, ShieldCheck, ShieldOff, ChevronUp, Smile, Film } from 'lucide-react';
import { getSocket } from '../lib/socket';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n';
import { playCallRingtone, stopCallRingtone, playUnavailableSound, playCallConnect, playCallDisconnect, playMuteSound, playUnmuteSound, playCameraOnSound, playCameraOffSound, playScreenShareOnSound, playScreenShareOffSound, playCallButtonSound } from '../lib/sounds';
import CallReactions from './CallReactions';
import FloatingReactions from './FloatingReactions';
import { useCallSettingsStore } from '../stores/callSettingsStore';
import VideoShareModal from './VideoShareModal';
import { WatchPartyModal } from './WatchPartyModal';
import TelegramCallScreen from './telegram-ui/TelegramCallScreen';

const API_URL = import.meta.env.VITE_API_URL || '';

type CallState = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: { id: string; displayName?: string; username: string; avatar?: string | null } | null;
  callType: 'voice' | 'video';
  incoming?: {
    from: string;
    offer: RTCSessionDescriptionInit;
    callType: 'voice' | 'video';
    callerInfo?: { displayName?: string; username?: string; avatar?: string | null } | null;
  } | null;
}

// ICE servers cache (fetched from server, includes TURN credentials when configured)
let cachedIceConfig: RTCConfiguration | null = null;
let iceCacheFetchedAt = 0;
const ICE_CACHE_TTL = 3600_000; // 1 hour

const FALLBACK_ICE: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

async function getIceServers(): Promise<RTCConfiguration> {
  if (cachedIceConfig && Date.now() - iceCacheFetchedAt < ICE_CACHE_TTL) {
    return cachedIceConfig;
  }
  try {
    const data = await api.getIceServers();
    if (data.iceServers && data.iceServers.length > 0) {
      cachedIceConfig = { iceServers: data.iceServers };
      iceCacheFetchedAt = Date.now();
      return cachedIceConfig;
    }
  } catch (e) {
    console.warn('Failed to fetch ICE servers, using fallback STUN:', e);
  }
  return FALLBACK_ICE;
}

// Try to get video+audio, falling back to audio-only
// If preferDeviceId is given, try that camera first
async function getMediaWithCameraFallback(
  wantVideo: boolean,
  preferDeviceId?: string
): Promise<{ stream: MediaStream; hasVideo: boolean }> {
  // Check if mediaDevices is supported (HTTPS required)
  if (!navigator.mediaDevices) {
    console.error('MediaDevices API not available - requires HTTPS');
    return { stream: new MediaStream(), hasVideo: false };
  }

  if (!wantVideo) {
    // Audio only call
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true 
        } 
      });
      return { stream, hasVideo: false };
    } catch (e) {
      console.warn('Failed to get audio stream:', e);
      return { stream: new MediaStream(), hasVideo: false };
    }
  }

  // Video call - try with preferred camera first
  if (preferDeviceId) {
    try {
      console.log('[getMedia] Trying preferred camera:', preferDeviceId.slice(0, 12));
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: { deviceId: { exact: preferDeviceId } },
      });
      console.log('[getMedia] Preferred camera success');
      return { stream, hasVideo: true };
    } catch (e) {
      console.warn('[getMedia] Preferred camera failed:', e);
    }
  }

  // Try default camera with video
  try {
    console.log('[getMedia] Requesting audio+video (default camera)...');
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000
      },
      video: { 
        width: { ideal: 1920 }, 
        height: { ideal: 1080 },
        frameRate: { ideal: 60, max: 60 }
      }
    });
    console.log('[getMedia] Success');
    return { stream, hasVideo: true };
  } catch (e: any) {
    // Check if it's a "device in use" error
    if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
      console.error('[getMedia] Camera is in use by another application');
    } else {
      console.warn('[getMedia] Video failed, trying audio only:', e);
    }
  }

  // Final fallback: audio only
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
    });
    return { stream, hasVideo: false };
  } catch (e) {
    console.error('[getMedia] All attempts failed:', e);
    return { stream: new MediaStream(), hasVideo: false };
  }
}

// Find a video sender on the peer connection, even if sender.track is null (recvonly transceiver)
function findVideoSender(pc: RTCPeerConnection): RTCRtpSender | undefined {
  // First try sender with an active video track
  const withTrack = pc.getSenders().find(s => s.track?.kind === 'video');
  if (withTrack) return withTrack;
  // Fall back to sender from a video transceiver (may have null track)
  const videoTransceiver = pc.getTransceivers().find(
    t => t.receiver?.track?.kind === 'video'
  );
  return videoTransceiver?.sender;
}

export default function CallModal({ isOpen, onClose, targetUser, callType: initialCallType, incoming }: CallModalProps) {
  const { t } = useLang();
  const [callState, setCallState] = useState<CallState>('idle');
  const [callType, setCallType] = useState<'voice' | 'video'>(initialCallType);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [duration, setDuration] = useState(0);
  const [swapVideo, setSwapVideo] = useState(false); // Swap local/remote video positions
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [remoteVolume, setRemoteVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(false);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [activeMicId, setActiveMicId] = useState<string>('');
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [sentReactions, setSentReactions] = useState<Array<{ id: string; emoji: string; isSticker: boolean; x: number; startTime: number }>>([]);
  // Video share state
  const [showVideoShare, setShowVideoShare] = useState(false);
  const [isVideoShareActive, setIsVideoShareActive] = useState(false);
  const [sharedVideoUrl, setSharedVideoUrl] = useState<string | null>(null);
  const [remoteVideoShareUrl, setRemoteVideoShareUrl] = useState<string | null>(null);
  const [videoShareTime, setVideoShareTime] = useState(0);
  const [videoSharePlaying, setVideoSharePlaying] = useState(false);
  // Watch party state
  const [showWatchParty, setShowWatchParty] = useState(false);
  // Drag state for minimized call widget
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [widgetPosition, setWidgetPosition] = useState<{ x: number; y: number } | null>(null);
  const [showLocalVideoInMinimized, setShowLocalVideoInMinimized] = useState(false); // Show local video when minimized
  // Video quality selector
  const [videoQuality, setVideoQuality] = useState<'auto' | '720p' | '480p' | '360p'>('auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const callSettings = useCallSettingsStore();

  const handleSendReaction = (emoji: string, isSticker?: boolean) => {
    const reaction = {
      id: `reaction_${Date.now()}`,
      emoji,
      isSticker: isSticker || false,
      x: Math.random() * 60 + 20, // 20-80%
      startTime: Date.now(),
    };
    setSentReactions(prev => [...prev, reaction]);

    // Send to other party via socket
    const socket = getSocket();
    console.log('[sendReaction] Socket:', socket ? 'connected' : 'null');
    if (socket?.connected) {
      socket.emit('call_reaction', {
        targetUserId: targetUserIdRef.current,
        emoji,
        isSticker,
      });
      console.log('[sendReaction] Sent reaction:', emoji);
    } else {
      console.error('[sendReaction] Socket not connected');
    }

    setShowReactions(false);
  };
  
  // Listen for reactions from other party
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleReaction = (data: { from: string; emoji: string; isSticker?: boolean; x?: number }) => {
      const reaction = {
        id: `reaction_remote_${Date.now()}_${data.from}`,
        emoji: data.emoji,
        isSticker: data.isSticker || false,
        x: data.x || Math.random() * 60 + 20,
        startTime: Date.now(),
        from: data.from, // Track who sent it
      };
      setSentReactions(prev => [...prev, reaction]);
      
      // Auto-remove after 3 seconds
      setTimeout(() => {
        setSentReactions(prev => prev.filter(r => r.id !== reaction.id));
      }, 3000);
    };

    socket.on('call_reaction', handleReaction);
    return () => { socket.off('call_reaction', handleReaction); };
  }, []);

  // Video share socket listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleVideoShareStarted = (data: { from: string; videoUrl: string; type: string }) => {
      setRemoteVideoShareUrl(data.videoUrl);
      setShowVideoShare(true);
    };

    const handleVideoShareStopped = () => {
      setRemoteVideoShareUrl(null);
      setIsVideoShareActive(false);
    };

    const handleVideoShareSync = (data: { from: string; currentTime: number; isPlaying: boolean }) => {
      setVideoShareTime(data.currentTime);
      setVideoSharePlaying(data.isPlaying);
    };

    socket.on('video_share_started', handleVideoShareStarted);
    socket.on('video_share_stopped', handleVideoShareStopped);
    socket.on('video_share_sync', handleVideoShareSync);

    return () => {
      socket.off('video_share_started', handleVideoShareStarted);
      socket.off('video_share_stopped', handleVideoShareStopped);
      socket.off('video_share_sync', handleVideoShareSync);
    };
  }, []);
  
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const targetUserIdRef = useRef<string>('');
  const iceCandidateBufferRef = useRef<RTCIceCandidateInit[]>([]);
  const callEndedRef = useRef(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  // Track whether video was active before screen share to decide restoration behavior
  const hadVideoBeforeScreenShareRef = useRef(false);
  // Noise gate refs
  const noiseGateCtxRef = useRef<AudioContext | null>(null);
  const noiseGateGainRef = useRef<GainNode | null>(null);
  const noiseGateRafRef = useRef<number>(0);
  const noiseGateTrackRef = useRef<MediaStreamTrack | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    stopCallRingtone();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.ontrack = null;
      peerRef.current.close();
      peerRef.current = null;
    }
    iceCandidateBufferRef.current = [];
    remoteStreamRef.current = null;
    localStreamRef.current = null;
    
    // Clean up noise gate
    if (noiseGateRafRef.current) cancelAnimationFrame(noiseGateRafRef.current);
    if (noiseGateTrackRef.current) { noiseGateTrackRef.current.stop(); noiseGateTrackRef.current = null; }
    if (noiseGateCtxRef.current) { noiseGateCtxRef.current.close().catch(() => {}); noiseGateCtxRef.current = null; }
    noiseGateGainRef.current = null;
    setDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setHasRemoteVideo(false);
    setIsFullscreen(false);
    setIsMinimized(false);
    setShowCameraMenu(false);
    setShowVolumeSlider(false);
    setShowMicMenu(false);
    setNoiseSuppression(false);
    setWidgetPosition(null);
    setIsDragging(false);
  }, []);

  // Drag handlers for minimized call widget
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    // Boundary checks with padding
    const padding = 16;
    const maxX = window.innerWidth - 220;
    const maxY = window.innerHeight - 100;
    setWidgetPosition({
      x: Math.max(padding, Math.min(newX, maxX)),
      y: Math.max(padding, Math.min(newY, maxY)),
    });
  }, [isDragging, dragOffset]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWidgetClick = useCallback(() => {
    // Only expand if not dragging
    if (!isDragging) {
      setIsMinimized(false);
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Cleanup on unmount - release all media devices
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
    };
  }, []);

  // Setup common peer connection event handlers
  const setupPeerHandlers = useCallback((pc: RTCPeerConnection) => {
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const socket = getSocket();
        socket?.emit('ice_candidate', {
          targetUserId: targetUserIdRef.current,
          candidate: e.candidate,
        });
      }
    };

    pc.ontrack = (e) => {
      console.log('[ontrack] Received track:', e.track.kind, 'readyState:', e.track.readyState,
        'enabled:', e.track.enabled, 'streams:', e.streams.length,
        'muted:', e.track.muted);
      // Always merge new tracks into the existing remote stream to avoid losing
      // audio when a video-only screen share track arrives on a separate stream.
      let stream: MediaStream;
      if (remoteStreamRef.current) {
        if (!remoteStreamRef.current.getTracks().includes(e.track)) {
          remoteStreamRef.current.addTrack(e.track);
        }
        stream = remoteStreamRef.current;
      } else if (e.streams[0]) {
        stream = e.streams[0];
      } else {
        stream = new MediaStream([e.track]);
      }

      remoteStreamRef.current = stream;

      // Check if remote has video tracks
      // Include !t.muted so we detect when the remote stops sending
      // (replaceTrack(null) or direction change causes muted=true)
      const checkVideo = () => {
        const videoTracks = stream.getVideoTracks();
        const hasVideo = videoTracks.length > 0 && videoTracks.some(
          t => t.readyState === 'live' && t.enabled && !t.muted
        );
        setHasRemoteVideo(hasVideo);
      };

      // Listen for unmute/mute on every video track (muted→unmuted when data starts flowing)
      const attachTrackListeners = (track: MediaStreamTrack) => {
        if (track.kind !== 'video') return;
        track.onunmute = checkVideo;
        track.onmute = checkVideo;
        track.onended = checkVideo;
      };

      stream.getVideoTracks().forEach(attachTrackListeners);
      checkVideo();

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => { });
      }

      // Track future additions/removals
      stream.onaddtrack = (ev) => {
        attachTrackListeners(ev.track);
        checkVideo();
      };
      stream.onremovetrack = checkVideo;

      // Also schedule a delayed check — some browsers delay unmute
      setTimeout(checkVideo, 500);
      setTimeout(checkVideo, 1500);
    };

    pc.onconnectionstatechange = () => {
      if (callEndedRef.current) return;
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        endCallSafe();
      }
    };
  }, []);

  // Schedule a tracked close timeout
  const scheduleClose = useCallback((delay = 1500) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = undefined;
      onClose();
    }, delay);
  }, [onClose]);

  // End call (safe to call multiple times)
  const endCallSafe = useCallback(() => {
    if (callEndedRef.current) return;
    callEndedRef.current = true;
    const socket = getSocket();
    socket?.emit('call_end', { targetUserId: targetUserIdRef.current });
    stopCallRingtone();
    playCallDisconnect();
    setCallState('ended');
    cleanup();
    scheduleClose();
  }, [cleanup, scheduleClose]);

  // Start outgoing call
  const startCall = useCallback(async () => {
    if (!targetUser) return;
    targetUserIdRef.current = targetUser.id;
    callEndedRef.current = false;
    setCallState('calling');

    try {
      // First, explicitly request permissions
      console.log('[startCall] Requesting permissions...');
      
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('[startCall] MediaDevices API not available');
        const errorMsg = window.isSecureContext 
          ? 'Ваш браузер не поддерживает медиа-устройства.'
          : '❌ Требуется HTTPS!\n\nДля работы звонков сайт должен быть открыт по HTTPS.\n\nЛокально работает http://localhost, но для доступа по сети нужен HTTPS.';
        alert(errorMsg);
        setCallState('ended');
        setTimeout(() => onClose(), 2000);
        return;
      }
      
      try {
        await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video'
        });
        console.log('[startCall] Permissions granted');
      } catch (permError: any) {
        console.error('[startCall] Permission denied:', permError.name, permError.message);
        if (permError.name === 'NotAllowedError' || permError.name === 'PermissionDeniedError') {
          alert('❌ Доступ к микрофону и камере запрещён!\n\nПожалуйста, разрешите доступ в настройках браузера:\n1. Нажмите на значок замка/камеры в адресной строке\n2. Разрешите доступ к микрофону и камере\n3. Обновите страницу и попробуйте снова');
        } else if (permError.name === 'NotFoundError') {
          alert('❌ Микрофон или камера не найдены!\n\nПроверьте, что устройства подключены и работают.');
        } else if (permError.name === 'NotReadableError' || permError.name === 'TrackStartError') {
          alert('❌ Устройство уже используется!\n\nКамера или микрофон заняты другим приложением.\n\nЗакройте другие программы, использующие камеру/микрофон, и попробуйте снова.');
        } else if (permError.name === 'TypeError') {
          alert('❌ Ошибка доступа к устройствам!\n\nВозможно, браузер не поддерживает WebRTC или требуется HTTPS.');
        } else {
          alert(`❌ Ошибка: ${permError.message || permError.name}\n\nПроверьте консоль браузера для деталей.`);
        }
        setCallState('ended');
        setTimeout(() => onClose(), 2000);
        return;
      }

      // Get media (video with camera enumeration fallback)
      console.log('[startCall] Getting media, wantVideo:', callType === 'video');
      const { stream, hasVideo } = await getMediaWithCameraFallback(callType === 'video');
      console.log('[startCall] Got media — hasVideo:', hasVideo,
        'audioTracks:', stream.getAudioTracks().length,
        'videoTracks:', stream.getVideoTracks().length);
      let effectiveCallType = callType;
      if (callType === 'video' && !hasVideo) {
        effectiveCallType = 'voice';
        setCallType('voice');
      }

      if (callEndedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      localStreamRef.current = stream;

      // Track active camera & mic
      const videoTrackSettings = stream.getVideoTracks()[0]?.getSettings();
      if (videoTrackSettings?.deviceId) setActiveCameraId(videoTrackSettings.deviceId);
      const audioTrackSettings = stream.getAudioTracks()[0]?.getSettings();
      if (audioTrackSettings?.deviceId) setActiveMicId(audioTrackSettings.deviceId);
      refreshCameras();
      refreshMicrophones();

      const iceConfig = await getIceServers();
      const pc = new RTCPeerConnection(iceConfig);
      peerRef.current = pc;

      // Add all tracks from the stream
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // If this is a video call but we only have audio, add a recvonly video transceiver
      // so we can receive video from the other side and potentially add video later
      if (effectiveCallType === 'video' && stream.getVideoTracks().length === 0) {
        pc.addTransceiver('video', { direction: 'recvonly' });
      }

      setupPeerHandlers(pc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const socket = getSocket();
      socket?.emit('call_offer', {
        targetUserId: targetUser.id,
        offer: pc.localDescription,
        callType: effectiveCallType,
      });

      // 15 second no-answer timeout
      callTimeoutRef.current = setTimeout(async () => {
        if (callEndedRef.current) return;
        callEndedRef.current = true;
        stopCallRingtone();
        const s = getSocket();
        s?.emit('call_end', { targetUserId: targetUserIdRef.current });
        cleanup();
        setCallState('ended');
        await playUnavailableSound();
        onClose();
      }, 15000);
    } catch (err: any) {
      console.error('Error starting call:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'NotFoundError') {
        alert(callType === 'video'
          ? 'Разрешите доступ к камере и микрофону в настройках браузера для совершения звонков'
          : 'Разрешите доступ к микрофону в настройках браузера для совершения звонков');
      }
      setCallState('ended');
      cleanup();
    }
  }, [targetUser, callType, cleanup, onClose, setupPeerHandlers]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incoming) return;
    targetUserIdRef.current = incoming.from;
    callEndedRef.current = false;
    stopCallRingtone();

    try {
      // First, explicitly request permissions
      console.log('[acceptCall] Requesting permissions...');
      
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('[acceptCall] MediaDevices API not available');
        const errorMsg = window.isSecureContext 
          ? 'Ваш браузер не поддерживает медиа-устройства.'
          : '❌ Требуется HTTPS!\n\nДля работы звонков сайт должен быть открыт по HTTPS.\n\nЛокально работает http://localhost, но для доступа по сети нужен HTTPS.';
        alert(errorMsg);
        declineCall();
        return;
      }
      
      try {
        await navigator.mediaDevices.getUserMedia({ 
          audio: true,
          video: incoming.callType === 'video'
        });
        console.log('[acceptCall] Permissions granted');
      } catch (permError: any) {
        console.error('[acceptCall] Permission denied:', permError.name, permError.message);
        if (permError.name === 'NotAllowedError' || permError.name === 'PermissionDeniedError') {
          alert('❌ Доступ к микрофону и камере запрещён!\n\nПожалуйста, разрешите доступ в настройках браузера:\n1. Нажмите на значок замка/камеры в адресной строке\n2. Разрешите доступ к микрофону и камере\n3. Обновите страницу и попробуйте снова');
        } else if (permError.name === 'NotFoundError') {
          alert('❌ Микрофон или камера не найдены!\n\nПроверьте, что устройства подключены и работают.');
        } else if (permError.name === 'NotReadableError' || permError.name === 'TrackStartError') {
          alert('❌ Устройство уже используется!\n\nКамера или микрофон заняты другим приложением.\n\nЗакройте другие программы, использующие камеру/микрофон, и попробуйте снова.');
        } else if (permError.name === 'TypeError') {
          alert('❌ Ошибка доступа к устройствам!\n\nВозможно, браузер не поддерживает WebRTC или требуется HTTPS.');
        } else {
          alert(`❌ Ошибка: ${permError.message || permError.name}\n\nПроверьте консоль браузера для деталей.`);
        }
        declineCall();
        return;
      }

      console.log('[acceptCall] Getting media, wantVideo:', incoming.callType === 'video');
      const { stream, hasVideo } = await getMediaWithCameraFallback(incoming.callType === 'video');
      console.log('[acceptCall] Got media — hasVideo:', hasVideo,
        'audioTracks:', stream.getAudioTracks().length,
        'videoTracks:', stream.getVideoTracks().length,
        'videoEnabled:', stream.getVideoTracks().map(t => t.enabled));
      let effectiveCallType = incoming.callType;
      if (incoming.callType === 'video' && !hasVideo) {
        effectiveCallType = 'voice';
      }

      if (callEndedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      localStreamRef.current = stream;

      // Track active camera & mic
      const videoTrackSettings = stream.getVideoTracks()[0]?.getSettings();
      if (videoTrackSettings?.deviceId) setActiveCameraId(videoTrackSettings.deviceId);
      const audioTrackSettings = stream.getAudioTracks()[0]?.getSettings();
      if (audioTrackSettings?.deviceId) setActiveMicId(audioTrackSettings.deviceId);
      refreshCameras();
      refreshMicrophones();

      const iceConfig = await getIceServers();
      const pc = new RTCPeerConnection(iceConfig);
      peerRef.current = pc;

      // Setup handlers first so ontrack is ready when setRemoteDescription fires
      setupPeerHandlers(pc);

      // Standard answerer pattern: set remote description FIRST
      // This creates transceivers from the offer's m-lines
      await pc.setRemoteDescription(new RTCSessionDescription(incoming.offer));

      // Now add local tracks — they reuse the transceivers created from the offer,
      // changing direction from recvonly to sendrecv
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // If this is a video call but we only have audio, we need a recvonly video transceiver.
      // After setRemoteDescription, one already exists from the offer — but only if the offer
      // contained a video m-line. If it did, the transceiver is already recvonly.
      // If there's no video transceiver at all and we want to receive video, add one.
      if (incoming.callType === 'video' && !hasVideo) {
        const hasVideoTransceiver = pc.getTransceivers().some(
          t => t.receiver?.track?.kind === 'video'
        );
        if (!hasVideoTransceiver) {
          pc.addTransceiver('video', { direction: 'recvonly' });
        }
      }

      console.log('[acceptCall] Transceivers after setup:',
        pc.getTransceivers().map(t => ({
          mid: t.mid,
          direction: t.direction,
          senderTrack: t.sender?.track?.kind ?? null,
          receiverTrack: t.receiver?.track?.kind ?? null,
        })));

      if (callEndedRef.current) {
        pc.onconnectionstatechange = null;
        pc.close();
        peerRef.current = null;
        stream.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        return;
      }

      // Flush buffered ICE candidates
      for (const candidate of iceCandidateBufferRef.current) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
      }
      iceCandidateBufferRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log('[acceptCall] Answer created, transceivers:',
        pc.getTransceivers().map(t => ({
          mid: t.mid,
          direction: t.direction,
          currentDirection: t.currentDirection,
          senderTrack: t.sender?.track?.kind ?? null,
        })));

      if (callEndedRef.current) {
        pc.onconnectionstatechange = null;
        pc.close();
        peerRef.current = null;
        stream.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        return;
      }

      const socket = getSocket();
      socket?.emit('call_answer', {
        targetUserId: incoming.from,
        answer: pc.localDescription,
      });

      setCallType(effectiveCallType);
      setCallState('connected');
      playCallConnect();
      console.log('[acceptCall] Call connected, effectiveCallType:', effectiveCallType);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err: any) {
      console.error('Error accepting call:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'NotFoundError') {
        alert('Разрешите доступ к микрофону в настройках браузера для совершения звонков');
      }
      if (!callEndedRef.current) {
        setCallState('ended');
        cleanup();
      }
    }
  }, [incoming, cleanup, setupPeerHandlers]);

  // Decline incoming call
  const declineCall = useCallback(() => {
    if (incoming) {
      const socket = getSocket();
      socket?.emit('call_decline', { targetUserId: incoming.from });
    }
    callEndedRef.current = true;
    stopCallRingtone();
    setCallState('ended');
    cleanup();
    scheduleClose();
  }, [incoming, cleanup, scheduleClose]);

  // Toggle mic
  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      if (newMuted) playMuteSound(); else playUnmuteSound();
    }
  };

  // Volume control for remote audio
  const handleVolumeChange = useCallback((vol: number) => {
    const v = Math.max(0, Math.min(1, vol));
    setRemoteVolume(v);
    if (remoteAudioRef.current) remoteAudioRef.current.volume = v;
  }, []);

  // Noise gate with look-ahead: analyse undelayed signal, gate delayed signal
  // This prevents clipping word beginnings and rejects short transients (clicks)
  const applyNoiseGate = useCallback(async () => {
    const pc = peerRef.current;
    if (!pc || !localStreamRef.current) return;
    const rawTrack = localStreamRef.current.getAudioTracks()[0];
    if (!rawTrack) return;

    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(new MediaStream([rawTrack]));

      // Look-ahead delay: signal is delayed so gate can open before audio arrives
      const delayNode = ctx.createDelay(0.2);
      delayNode.delayTime.value = 0.05; // 50ms look-ahead

      // Analysis path: bandpass on voice fundamentals (undelayed, sees audio early)
      const analysisHP = ctx.createBiquadFilter();
      analysisHP.type = 'highpass'; analysisHP.frequency.value = 100; analysisHP.Q.value = 0.7;
      const analysisLP = ctx.createBiquadFilter();
      analysisLP.type = 'lowpass'; analysisLP.frequency.value = 4000; analysisLP.Q.value = 0.7;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;

      const gainNode = ctx.createGain();
      gainNode.gain.value = 0;
      const dest = ctx.createMediaStreamDestination();

      // Signal path: source → delay → gain → output (full quality, just gated)
      source.connect(delayNode);
      delayNode.connect(gainNode);
      gainNode.connect(dest);

      // Analysis path (no delay): source → bandpass → analyser
      source.connect(analysisHP);
      analysisHP.connect(analysisLP);
      analysisLP.connect(analyser);

      const dataArray = new Float32Array(analyser.fftSize);
      const OPEN_THRESHOLD = -38;  // dB in voice band to trigger pending
      const CLOSE_THRESHOLD = -48; // dB hysteresis / transient rejection
      const CONFIRM_MS = 22;       // ms energy must persist to confirm voice (rejects clicks)
      const HOLD_TIME = 150;       // ms keep gate open after speech stops
      const ATTACK = 0.002;        // fast open (gate already decided ahead of time)
      const RELEASE = 0.02;        // smooth close

      // State machine: 0=closed, 1=pending (waiting to confirm voice), 2=open
      let state = 0;
      let pendingSince = 0;
      let holdUntil = 0;

      const check = () => {
        analyser.getFloatTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i] * dataArray[i];
        const rms = Math.sqrt(sum / dataArray.length);
        const db = rms > 0 ? 20 * Math.log10(rms) : -100;
        const now = performance.now();

        if (state === 0) { // closed
          if (db > OPEN_THRESHOLD) {
            state = 1; // pending
            pendingSince = now;
          }
        } else if (state === 1) { // pending — wait to confirm sustained energy (voice) vs transient (click)
          if (db <= CLOSE_THRESHOLD) {
            state = 0; // energy dropped fast → was a click, stay closed
          } else if (now - pendingSince >= CONFIRM_MS) {
            state = 2; // sustained → voice confirmed, open gate
            holdUntil = now + HOLD_TIME;
            gainNode.gain.setTargetAtTime(1, ctx.currentTime, ATTACK);
          }
        } else { // open
          if (db > CLOSE_THRESHOLD) {
            holdUntil = now + HOLD_TIME;
          }
          if (now >= holdUntil) {
            state = 0;
            gainNode.gain.setTargetAtTime(0, ctx.currentTime, RELEASE);
          }
        }
        noiseGateRafRef.current = requestAnimationFrame(check);
      };
      check();

      const gatedTrack = dest.stream.getAudioTracks()[0];
      gatedTrack.enabled = !isMuted;

      // Replace in PeerConnection
      const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
      if (sender) await sender.replaceTrack(gatedTrack);

      noiseGateCtxRef.current = ctx;
      noiseGateGainRef.current = gainNode;
      noiseGateTrackRef.current = gatedTrack;
      setNoiseSuppression(true);
    } catch (err) {
      console.error('Failed to apply noise gate:', err);
    }
  }, [isMuted]);

  const removeNoiseGate = useCallback(async () => {
    const pc = peerRef.current;
    // Restore raw mic track directly to PeerConnection
    if (pc && localStreamRef.current) {
      const rawTrack = localStreamRef.current.getAudioTracks()[0];
      if (rawTrack) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) await sender.replaceTrack(rawTrack);
      }
    }
    if (noiseGateRafRef.current) { cancelAnimationFrame(noiseGateRafRef.current); noiseGateRafRef.current = 0; }
    if (noiseGateTrackRef.current) { noiseGateTrackRef.current.stop(); noiseGateTrackRef.current = null; }
    if (noiseGateCtxRef.current) { noiseGateCtxRef.current.close().catch(() => {}); noiseGateCtxRef.current = null; }
    noiseGateGainRef.current = null;
    setNoiseSuppression(false);
  }, []);

  const toggleNoiseSuppression = useCallback(async () => {
    console.log('[toggleNoiseSuppression] Current state:', noiseSuppression);
    try {
      if (noiseSuppression) {
        await removeNoiseGate();
        console.log('[toggleNoiseSuppression] Noise suppression OFF');
      } else {
        await applyNoiseGate();
        console.log('[toggleNoiseSuppression] Noise suppression ON');
      }
    } catch (e) {
      console.error('[toggleNoiseSuppression] Error:', e);
    }
  }, [noiseSuppression, applyNoiseGate, removeNoiseGate]);

  // Enumerate microphones
  const refreshMicrophones = useCallback(async () => {
    try {
      // First request media permissions
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Now enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      setMicrophones(audioInputs);
      return audioInputs;
    } catch (e) { 
      console.warn('Could not enumerate microphones:', e);
      return []; 
    }
  }, []);

  // Switch microphone
  const switchMicrophone = useCallback(async (deviceId: string) => {
    const pc = peerRef.current;
    if (!pc) return;
    setShowMicMenu(false);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) return;
      newTrack.enabled = !isMuted;

      // Remove noise gate if active (will re-apply after switch if needed)
      const wasGated = noiseSuppression;
      if (wasGated) await removeNoiseGate();

      // Replace in local stream
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(t => {
          localStreamRef.current!.removeTrack(t);
          t.stop();
        });
        localStreamRef.current.addTrack(newTrack);
      }
      // Replace in PeerConnection
      const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
      if (sender) await sender.replaceTrack(newTrack);
      setActiveMicId(deviceId);

      // Re-apply noise gate if it was active
      if (wasGated) await applyNoiseGate();
    } catch (err) {
      console.error('Switch mic failed:', err);
    }
  }, [isMuted, noiseSuppression, removeNoiseGate, applyNoiseGate]);

  // Enumerate cameras
  const refreshCameras = useCallback(async () => {
    try {
      // First request media permissions
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Now enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setCameras(videoInputs);
      return videoInputs;
    } catch (e) {
      console.warn('Could not enumerate cameras:', e);
      return [];
    }
  }, []);

  // Open camera menu (await enumeration, then show)
  const openCameraMenu = useCallback(async () => {
    if (showCameraMenu) {
      setShowCameraMenu(false);
      return;
    }
    const cams = await refreshCameras();
    if (cams.length > 0) {
      setShowCameraMenu(true);
    }
  }, [showCameraMenu, refreshCameras]);

  // Switch to a specific camera by deviceId
  const switchCamera = useCallback(async (deviceId: string) => {
    const pc = peerRef.current;
    if (!pc) return;
    setShowCameraMenu(false);
    const prevCameraId = activeCameraId;

    try {
      // Strategy: try to acquire new camera FIRST without stopping the old one.
      // If that fails (some devices can't have 2 cameras open), stop old then retry.
      let newStream: MediaStream | null = null;

      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
        });
      } catch (e1) {
        console.warn('Could not open new camera while old is active, releasing old first:', e1);
        // Stop old camera tracks, then retry
        const currentSender = findVideoSender(pc);
        if (currentSender?.track) currentSender.track.stop();
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(t => {
            localStreamRef.current!.removeTrack(t);
            t.stop();
          });
        }
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
        });
      }

      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) {
        console.error('No video track from selected camera');
        return;
      }

      // Now stop old tracks (if they weren't stopped already in the fallback path above)
      const currentSender = findVideoSender(pc);
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(t => {
          if (t !== newTrack) {
            localStreamRef.current!.removeTrack(t);
            t.stop();
          }
        });
      }
      if (currentSender?.track && currentSender.track !== newTrack) {
        currentSender.track.stop();
      }

      // Replace track on sender or add new one
      if (currentSender) {
        await currentSender.replaceTrack(newTrack);
        // If direction was recvonly, change to sendrecv
        const transceiver = pc.getTransceivers().find(t => t.sender === currentSender);
        if (transceiver && (transceiver.direction === 'recvonly' || transceiver.direction === 'inactive')) {
          transceiver.direction = 'sendrecv';
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const socket = getSocket();
          socket?.emit('renegotiate', {
            targetUserId: targetUserIdRef.current,
            offer: pc.localDescription,
          });
        }
      } else {
        pc.addTrack(newTrack, localStreamRef.current || newStream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const socket = getSocket();
        socket?.emit('renegotiate', {
          targetUserId: targetUserIdRef.current,
          offer: pc.localDescription,
        });
      }

      // Update local stream
      if (localStreamRef.current) {
        localStreamRef.current.addTrack(newTrack);
      } else {
        localStreamRef.current = new MediaStream([newTrack]);
      }

      setActiveCameraId(deviceId);
      setIsVideoOff(false);
      setCallType('video');
    } catch (err) {
      console.error('Switch camera failed:', err);
      // Try to restore previous camera so video isn't permanently lost
      try {
        let restoreStream: MediaStream | undefined;
        // Try the exact previous camera first
        if (prevCameraId) {
          try {
            restoreStream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: prevCameraId } },
            });
          } catch { /* previous camera also unavailable */ }
        }
        // Fall back to any camera
        if (!restoreStream) {
          try {
            restoreStream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch { /* no camera at all */ }
        }
        if (restoreStream) {
          const restoreTrack = restoreStream.getVideoTracks()[0];
          if (restoreTrack) {
            const sender = findVideoSender(pc);
            if (sender) {
              await sender.replaceTrack(restoreTrack);
              // Ensure direction allows sending + renegotiate
              const transceiver = pc.getTransceivers().find(t => t.sender === sender);
              if (transceiver && (transceiver.direction === 'recvonly' || transceiver.direction === 'inactive')) {
                transceiver.direction = 'sendrecv';
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                const socket = getSocket();
                socket?.emit('renegotiate', {
                  targetUserId: targetUserIdRef.current,
                  offer: pc.localDescription,
                });
              }
            }
            if (localStreamRef.current) {
              localStreamRef.current.addTrack(restoreTrack);
            } else {
              localStreamRef.current = restoreStream;
            }
            setIsVideoOff(false);
          }
        }
      } catch { /* nothing we can do */ }
    }
  }, [activeCameraId]);

  // Apply video quality constraints to active video sender
  const applyVideoQuality = useCallback(async (quality: 'auto' | '720p' | '480p' | '360p') => {
    const pc = peerRef.current;
    if (!pc) return;
    setVideoQuality(quality);
    setShowQualityMenu(false);

    const sender = findVideoSender(pc);
    if (!sender?.track) return;

    const constraints: Record<string, { width: { ideal: number }; height: { ideal: number }; frameRate?: { ideal: number } }> = {
      '720p': { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      '480p': { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
      '360p': { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 20 } },
      'auto': { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
    };

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: constraints[quality],
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (newTrack) {
        const oldTrack = sender.track;
        await sender.replaceTrack(newTrack);
        // Stop old track
        oldTrack.stop();
        // Update local stream
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(t => {
            t.stop();
            localStreamRef.current?.removeTrack(t);
          });
          localStreamRef.current.addTrack(newTrack);
        }
      }
    } catch (err) {
      console.warn('Could not apply video quality:', err);
    }
  }, []);

  // Toggle video: enable/disable video track, or get camera if none
  const toggleVideo = useCallback(async () => {
    const pc = peerRef.current;
    if (!pc) return;

    if (!isVideoOff) {
      // Turn off: disable video track on sender and revert to voice
      const sender = findVideoSender(pc);
      if (sender?.track) {
        sender.track.enabled = false;
      }
      setIsVideoOff(true);
      setCallType('voice');
      playCameraOffSound();
    } else {
      // Turn on: re-enable existing track or get new camera
      const sender = findVideoSender(pc);
      if (sender?.track) {
        sender.track.enabled = true;
        setIsVideoOff(false);
        playCameraOnSound();
      } else {
        try {
          const { stream: camStream, hasVideo } = await getMediaWithCameraFallback(true);
          if (!hasVideo) {
            console.warn('No camera available');
            return;
          }
          const videoTrack = camStream.getVideoTracks()[0];

          // Find a video sender (may have null track from transceiver)
          const existingSender = findVideoSender(pc);
          if (existingSender) {
            await existingSender.replaceTrack(videoTrack);
            // If direction was recvonly, change to sendrecv and renegotiate
            const transceiver = pc.getTransceivers().find(t => t.sender === existingSender);
            if (transceiver && (transceiver.direction === 'recvonly' || transceiver.direction === 'inactive')) {
              transceiver.direction = 'sendrecv';
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              const socket = getSocket();
              socket?.emit('renegotiate', {
                targetUserId: targetUserIdRef.current,
                offer: pc.localDescription,
              });
            }
          } else {
            pc.addTrack(videoTrack, localStreamRef.current || camStream);
            // Renegotiate since new track added
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const socket = getSocket();
            socket?.emit('renegotiate', {
              targetUserId: targetUserIdRef.current,
              offer: pc.localDescription,
            });
          }

          if (localStreamRef.current) {
            localStreamRef.current.addTrack(videoTrack);
          }

          setIsVideoOff(false);
          setCallType('video');
        } catch (err) {
          console.error('Could not start camera:', err);
        }
      }
    }
  }, [isVideoOff]);

  // Screen sharing
  const toggleScreenShare = useCallback(async () => {
    console.log('[toggleScreenShare] Starting, isScreenSharing:', isScreenSharing);
    const pc = peerRef.current;
    if (!pc) {
      console.error('[toggleScreenShare] No peer connection');
      return;
    }

    if (isScreenSharing) {
      // Stop screen share
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }

      const hadVideo = hadVideoBeforeScreenShareRef.current;

      if (hadVideo) {
        // Restore camera — request video only (no audio) to avoid interfering with existing mic
        let cameraRestored = false;
        try {
          const constraints: MediaStreamConstraints = activeCameraId
            ? { video: { deviceId: { exact: activeCameraId } } }
            : { video: true };
          const camStream = await navigator.mediaDevices.getUserMedia(constraints);
          const cameraTrack = camStream.getVideoTracks()[0];
          if (cameraTrack) {
            const sender = findVideoSender(pc);
            if (sender) {
              await sender.replaceTrack(cameraTrack);
            }
            if (localStreamRef.current) {
              localStreamRef.current.getVideoTracks().forEach(t => {
                localStreamRef.current!.removeTrack(t);
                t.stop();
              });
              localStreamRef.current.addTrack(cameraTrack);
            }
            cameraRestored = true;
          }
        } catch (err) {
          console.error('Error restoring camera:', err);
        }
        if (!cameraRestored) {
          // Null out sender and go recvonly
          const sender = findVideoSender(pc);
          if (sender) {
            await sender.replaceTrack(null);
            const transceiver = pc.getTransceivers().find(t => t.sender === sender);
            if (transceiver && transceiver.direction !== 'recvonly') {
              transceiver.direction = 'recvonly';
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                const socket = getSocket();
                socket?.emit('renegotiate', {
                  targetUserId: targetUserIdRef.current,
                  offer: pc.localDescription,
                });
              } catch (e) { console.error('Renegotiation after screen share stop failed:', e); }
            }
          }
          if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(t => {
              localStreamRef.current!.removeTrack(t);
              t.stop();
            });
          }
          setIsVideoOff(true);
        }
      } else {
        // Was voice call — don't restore camera, just null out the video sender
        const sender = findVideoSender(pc);
        if (sender) {
          await sender.replaceTrack(null);
          const transceiver = pc.getTransceivers().find(t => t.sender === sender);
          if (transceiver && transceiver.direction !== 'recvonly') {
            transceiver.direction = 'recvonly';
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              const socket = getSocket();
              socket?.emit('renegotiate', {
                targetUserId: targetUserIdRef.current,
                offer: pc.localDescription,
              });
            } catch (e) { console.error('Renegotiation after screen share stop failed:', e); }
          }
        }
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(t => {
            localStreamRef.current!.removeTrack(t);
            t.stop();
          });
        }
        setCallType('voice');
        setIsVideoOff(false);
      }

      setIsScreenSharing(false);
      playScreenShareOffSound();
    } else {
      // Start screen share — works for both audio and video calls
      hadVideoBeforeScreenShareRef.current = callType === 'video' && !isVideoOff;
      try {
        // Check if getDisplayMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          throw new Error('Screen sharing not supported - requires HTTPS');
        }

        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { 
            width: { ideal: 1920 }, 
            height: { ideal: 1080 },
            frameRate: { ideal: 60, max: 60 }
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          // System audio capture (Chrome 121+)
          systemAudio: 'include',
        } as any);
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        const audioTracks = screenStream.getAudioTracks();

        // For audio calls, we need to add video track
        if (callType === 'voice') {
          // Add screen video track to peer connection
          pc.addTrack(screenTrack, screenStream);
          
          // Also add screen audio if available
          for (const audioTrack of audioTracks) {
            pc.addTrack(audioTrack, screenStream);
          }
          
          // Upgrade call to video
          setCallType('video');
        } else {
          // For video calls, replace existing video track
          const sender = findVideoSender(pc);
          if (sender) {
            await sender.replaceTrack(screenTrack);
            const transceiver = pc.getTransceivers().find(t => t.sender === sender);
            if (transceiver && (transceiver.direction === 'recvonly' || transceiver.direction === 'inactive')) {
              transceiver.direction = 'sendrecv';
            }
          } else {
            // No video sender — add track
            pc.addTrack(screenTrack, localStreamRef.current || screenStream);
          }

          // Add system audio tracks if available
          for (const audioTrack of audioTracks) {
            pc.addTrack(audioTrack, screenStream);
          }
        }

        // Renegotiate
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const socket = getSocket();
        socket?.emit('renegotiate', {
          targetUserId: targetUserIdRef.current,
          offer: pc.localDescription,
        });

        screenTrack.onended = async () => {
          setIsScreenSharing(false);
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
          }

          const hadVideo = hadVideoBeforeScreenShareRef.current;
          const snd = peerRef.current ? findVideoSender(peerRef.current) : undefined;

          if (hadVideo) {
            // Restore camera — video only, no audio
            let cameraRestored = false;
            try {
              const constraints: MediaStreamConstraints = activeCameraId
                ? { video: { deviceId: { exact: activeCameraId } } }
                : { video: true };
              const camStream = await navigator.mediaDevices.getUserMedia(constraints);
              const camTrack = camStream.getVideoTracks()[0];
              if (camTrack) {
                if (snd) await snd.replaceTrack(camTrack);
                if (localStreamRef.current) {
                  localStreamRef.current.getVideoTracks().forEach(t => {
                    localStreamRef.current!.removeTrack(t);
                    t.stop();
                  });
                  localStreamRef.current.addTrack(camTrack);
                }
                cameraRestored = true;
              }
            } catch (e) {
              console.error('Error restoring camera:', e);
            }
            if (!cameraRestored && snd) {
              await snd.replaceTrack(null);
              const currentPc = peerRef.current;
              if (currentPc) {
                const transceiver = currentPc.getTransceivers().find(t => t.sender === snd);
                if (transceiver && transceiver.direction !== 'recvonly') {
                  transceiver.direction = 'recvonly';
                  try {
                    const offer = await currentPc.createOffer();
                    await currentPc.setLocalDescription(offer);
                    const socket = getSocket();
                    socket?.emit('renegotiate', {
                      targetUserId: targetUserIdRef.current,
                      offer: currentPc.localDescription,
                    });
                  } catch (e) { console.error('Renegotiation after screen share onended failed:', e); }
                }
              }
              if (localStreamRef.current) {
                localStreamRef.current.getVideoTracks().forEach(t => {
                  localStreamRef.current!.removeTrack(t);
                  t.stop();
                });
              }
            }
          } else {
            // Was voice call — just null out video sender
            if (snd) {
              await snd.replaceTrack(null);
              const currentPc = peerRef.current;
              if (currentPc) {
                const transceiver = currentPc.getTransceivers().find(t => t.sender === snd);
                if (transceiver && transceiver.direction !== 'recvonly') {
                  transceiver.direction = 'recvonly';
                  try {
                    const offer = await currentPc.createOffer();
                    await currentPc.setLocalDescription(offer);
                    const socket = getSocket();
                    socket?.emit('renegotiate', {
                      targetUserId: targetUserIdRef.current,
                      offer: currentPc.localDescription,
                    });
                  } catch (e) { console.error('Renegotiation after screen share onended failed:', e); }
                }
              }
            }
            if (localStreamRef.current) {
              localStreamRef.current.getVideoTracks().forEach(t => {
                localStreamRef.current!.removeTrack(t);
                t.stop();
              });
            }
            setCallType('voice');
          }
        };

        setIsScreenSharing(true);
        playScreenShareOnSound();
        setCallType('video');
      } catch (err) {
        console.error('Error starting screen share:', err);
      }
    }
  }, [isScreenSharing, activeCameraId, callType, isVideoOff]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    if (!videoContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await videoContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.error('Fullscreen error:', e);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Socket event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onCallAnswered = async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
      if (!peerRef.current || data.from !== targetUserIdRef.current) return;
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      stopCallRingtone();
      console.log('[onCallAnswered] Setting remote description (answer)');
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      console.log('[onCallAnswered] Transceivers after answer:',
        peerRef.current.getTransceivers().map(t => ({
          mid: t.mid,
          direction: t.direction,
          currentDirection: t.currentDirection,
          senderTrack: t.sender?.track?.kind ?? null,
          receiverTrack: t.receiver?.track?.kind ?? null,
        })));
      for (const candidate of iceCandidateBufferRef.current) {
        peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
      }
      iceCandidateBufferRef.current = [];
      setCallState('connected');
      playCallConnect();
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    };

    const onIceCandidate = (data: { from: string; candidate: RTCIceCandidateInit }) => {
      if (peerRef.current && peerRef.current.remoteDescription) {
        peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.error);
      } else {
        iceCandidateBufferRef.current.push(data.candidate);
      }
    };

    const onCallEnded = (data: { from: string }) => {
      if (callEndedRef.current) return;
      if (data.from !== targetUserIdRef.current) return;
      callEndedRef.current = true;
      stopCallRingtone();
      playCallDisconnect();
      setCallState('ended');
      cleanup();
      scheduleClose();
    };

    const onCallDeclined = (data: { from: string }) => {
      if (callEndedRef.current) return;
      if (data.from !== targetUserIdRef.current) return;
      callEndedRef.current = true;
      stopCallRingtone();
      setCallState('ended');
      cleanup();
      scheduleClose();
    };

    const onCallUnavailable = () => {
      if (callEndedRef.current) return;
      callEndedRef.current = true;
      stopCallRingtone();
      setCallState('ended');
      cleanup();
      scheduleClose();
    };

    // Renegotiation (e.g. when remote adds screen share to audio-only call)
    const onRenegotiate = async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
      if (!peerRef.current || data.from !== targetUserIdRef.current) return;
      try {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit('renegotiate_answer', {
          targetUserId: targetUserIdRef.current,
          answer: peerRef.current.localDescription,
        });
      } catch (err) {
        console.error('Renegotiation error:', err);
      }
    };

    const onRenegotiateAnswer = async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
      if (!peerRef.current || data.from !== targetUserIdRef.current) return;
      try {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (err) {
        console.error('Renegotiation answer error:', err);
      }
    };

    socket.on('call_answered', onCallAnswered);
    socket.on('ice_candidate', onIceCandidate);
    socket.on('call_ended', onCallEnded);
    socket.on('call_declined', onCallDeclined);
    socket.on('call_unavailable', onCallUnavailable);
    socket.on('renegotiate', onRenegotiate);
    socket.on('renegotiate_answer', onRenegotiateAnswer);

    return () => {
      socket.off('call_answered', onCallAnswered);
      socket.off('ice_candidate', onIceCandidate);
      socket.off('call_ended', onCallEnded);
      socket.off('call_declined', onCallDeclined);
      socket.off('call_unavailable', onCallUnavailable);
      socket.off('renegotiate', onRenegotiate);
      socket.off('renegotiate_answer', onRenegotiateAnswer);
    };
  }, [cleanup, scheduleClose]);

  // Start call on mount (outgoing)
  useEffect(() => {
    if (isOpen && !incoming && targetUser && callState === 'idle') {
      startCall();
    }
    if (isOpen && incoming && callState === 'idle') {
      targetUserIdRef.current = incoming.from;
      setCallState('incoming');
      setCallType(incoming.callType);
      playCallRingtone();
    }
  }, [isOpen, incoming, targetUser, callState, startCall]);

  // Sync local video ref with stream (only when srcObject actually changes)
  useEffect(() => {
    if (!localVideoRef.current) return;
    const desired = isScreenSharing && screenStreamRef.current
      ? screenStreamRef.current
      : localStreamRef.current;
    if (desired && localVideoRef.current.srcObject !== desired) {
      localVideoRef.current.srcObject = desired;
    }
  });

  // Sync remote video ref with remote stream (only when srcObject actually changes)
  useEffect(() => {
    if (!remoteVideoRef.current) return;
    if (remoteStreamRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCallRingtone();
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      cleanup();
    };
  }, [cleanup]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const displayName = incoming
    ? incoming.callerInfo?.displayName || incoming.callerInfo?.username || '...'
    : targetUser?.displayName || targetUser?.username || '...';

  // Get avatar with full URL
  const rawAvatar = incoming ? incoming.callerInfo?.avatar : targetUser?.avatar;
  const displayAvatar = rawAvatar && !rawAvatar.startsWith('http') ? `${API_URL}${rawAvatar}` : rawAvatar;

  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (!isOpen) return null;

  const showVideoArea = callState === 'connected' && (hasRemoteVideo || (callType === 'video' && (!isVideoOff || isScreenSharing)));
  const hasLocalVideo = !!(
    localStreamRef.current?.getVideoTracks().some(t => t.enabled) || isScreenSharing
  );

  return (
    <>
    <AnimatePresence>
      <audio key="remote-audio" ref={remoteAudioRef} autoPlay playsInline />

      {/* === MINIMIZED VIEW === */}
      {isMinimized && callState === 'connected' ? (
        <motion.div
          key="call-minimized"
          initial={{ opacity: 0, y: 50, scale: 0.8 }}
          animate={{
            opacity: 1,
            y: widgetPosition?.y ?? 'auto',
            x: widgetPosition?.x ?? 'auto',
            scale: 1,
            bottom: widgetPosition ? 'auto' : '120px',
            right: widgetPosition ? 'auto' : '24px',
          }}
          exit={{ opacity: 0, y: 50, scale: 0.8 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          style={{
            position: 'fixed',
            left: widgetPosition ? `${widgetPosition.x}px` : undefined,
            top: widgetPosition ? `${widgetPosition.y}px` : undefined,
            bottom: widgetPosition ? undefined : '120px',
            right: widgetPosition ? undefined : '24px',
          }}
          className="z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl bg-nexo-500/95 backdrop-blur-xl shadow-lg border border-white/20 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragStart}
          onClick={handleWidgetClick}
        >
          {/* Avatar */}
          <div className="flex-shrink-0">
            {displayAvatar ? (
              <img src={displayAvatar} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-white/40" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-nexo-500 flex items-center justify-center text-white font-bold text-sm">
                {initials}
              </div>
            )}
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-nexo-500" />
          </div>
          
          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white font-semibold truncate max-w-[140px] drop-shadow-lg">{displayName}</p>
            <p className="text-xs text-white/90 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full" />
              {formatDuration(duration)}
            </p>
          </div>
          
          {/* Quick actions */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={toggleMic}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                isMuted 
                  ? 'bg-red-500/90 text-white hover:bg-red-600' 
                  : 'bg-white/25 text-white hover:bg-white/35'
              }`}
              title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            >
              {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            <button
              onClick={() => setIsMinimized(false)}
              className="w-8 h-8 rounded-full bg-white/25 hover:bg-white/35 flex items-center justify-center text-white transition-all"
              title="Развернуть"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
              </svg>
            </button>
            <button
              onClick={endCallSafe}
              className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all"
              title="Завершить"
            >
              <PhoneOff size={14} />
            </button>
          </div>
        </motion.div>
      ) : (

      /* === FULL VIEW === */
      <motion.div
        key="call-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label="Call"
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
        onClick={() => { setShowCameraMenu(false); setShowVolumeSlider(false); setShowMicMenu(false); }}
      >
        {/* Solid background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className={`absolute inset-0 transition-all duration-1000 ${
            callState === 'connected'
              ? 'bg-[#ACBD65]'
              : callState === 'ended'
                ? 'bg-[#568FD6]'
                : 'bg-[#568FD6]'
          }`} />
        </div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`relative w-full mx-4 rounded-[2.5rem] overflow-hidden border border-white/[0.08] shadow-lg ${showVideoArea ? 'max-w-5xl' : 'max-w-md'
            }`}
        >
          {/* Mic selector popup */}
          {showMicMenu && microphones.length > 0 && (
            <>
              <div className="fixed inset-0 z-[200]" onClick={() => setShowMicMenu(false)} />
              <div className="fixed z-[201] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] rounded-xl bg-zinc-800 border border-zinc-600 py-2">
                <div className="px-3 py-1.5 text-xs text-zinc-400 uppercase tracking-wider border-b border-zinc-700 mb-1">{t('selectMicrophone')}</div>
                {microphones.map((mic, i) => (
                  <button
                    key={mic.deviceId}
                    onClick={() => switchMicrophone(mic.deviceId)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${activeMicId === mic.deviceId
                        ? 'text-nexo-400 bg-nexo-500/20 font-medium'
                        : 'text-zinc-200 hover:bg-zinc-700'
                      }`}
                  >
                    {mic.label || `${t('microphone')} ${i + 1}`}
                  </button>
                ))}
              </div>
            </>
          )}
          {/* Camera selector popup - rendered outside overflow-hidden container */}
          {showCameraMenu && cameras.length > 0 && (
            <>
              {/* Backdrop to close on click outside */}
              <div className="fixed inset-0 z-[200]" onClick={() => setShowCameraMenu(false)} />
              <div className="fixed z-[201] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] rounded-xl bg-zinc-800 border border-zinc-600 py-2">
                <div className="px-3 py-1.5 text-xs text-zinc-400 uppercase tracking-wider border-b border-zinc-700 mb-1">{t('switchCamera')}</div>
                {cameras.map((cam, i) => (
                  <button
                    key={cam.deviceId}
                    onClick={() => switchCamera(cam.deviceId)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${activeCameraId === cam.deviceId
                        ? 'text-nexo-400 bg-nexo-500/20 font-medium'
                        : 'text-zinc-200 hover:bg-zinc-700'
                      }`}
                  >
                    {cam.label || `Camera ${i + 1}`}
                  </button>
                ))}
              </div>
            </>
          )}
          {/* Volume slider popup */}
          {showVolumeSlider && (
            <>
              <div className="fixed inset-0 z-[200]" onClick={() => setShowVolumeSlider(false)} />
              <div className="fixed z-[201] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] rounded-xl bg-zinc-800 border border-zinc-600 p-4" onClick={(e) => e.stopPropagation()}>
                <div className="text-xs text-zinc-400 uppercase tracking-wider mb-3">{t('volume')}</div>
                <div className="flex items-center gap-3">
                  <Volume2 size={16} className="text-zinc-400 shrink-0" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={remoteVolume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-zinc-600 accent-nexo-500 cursor-pointer"
                  />
                  <span className="text-xs text-zinc-300 w-8 text-right">{Math.round(remoteVolume * 100)}%</span>
                </div>
              </div>
            </>
          )}
          {/* === Video layout (connected, has video) === */}
          {showVideoArea ? (
            <div
              ref={videoContainerRef}
              className="relative bg-black w-full"
              style={{ aspectRatio: '16 / 9' }}
            >
              {/* Main video (remote by default, local when swapped) */}
              {!swapVideo ? (
                <>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-contain bg-black"
                    onContextMenu={(e) => { e.preventDefault(); setShowVolumeSlider(true); }}
                  />
                  {!hasRemoteVideo && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <VideoOff size={48} className="text-zinc-500 mb-2" />
                      <span className="text-sm text-zinc-500">{displayName}</span>
                    </div>
                  )}
                </>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                />
              )}

              {/* PIP video (local by default, remote when swapped) */}
              {!swapVideo ? (
                hasLocalVideo && (
                  <div className="absolute bottom-3 right-3 w-48 rounded-xl overflow-hidden border border-white/20 bg-black z-10"
                    style={{ aspectRatio: '16 / 9' }}
                  >
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-contain bg-black"
                    />
                  </div>
                )
              ) : (
                hasRemoteVideo && (
                  <div className="absolute bottom-3 right-3 w-48 rounded-xl overflow-hidden border border-white/20 bg-black z-10"
                    style={{ aspectRatio: '16 / 9' }}
                  >
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-contain bg-black"
                      onContextMenu={(e) => { e.preventDefault(); setShowVolumeSlider(true); }}
                    />
                  </div>
                )
              )}

              {/* Swap button */}
              <button
                onClick={() => setSwapVideo(!swapVideo)}
                className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/50 z-10 flex items-center gap-2 text-white/80 hover:text-white transition-colors"
                title="Поменять местами видео"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16"/>
                </svg>
                <span className="text-xs font-medium">Поменять местами</span>
              </button>

              {/* Floating reactions */}
              <FloatingReactions reactions={sentReactions} />

              {/* Duration badge */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-black/50 z-10">
                <span className="text-sm text-white font-mono">{formatDuration(duration)}</span>
              </div>

              {/* Top-right buttons: minimize + fullscreen */}
              <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                  title={t('minimize')}
                >
                  <Minimize2 size={16} />
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                >
                  {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                </button>
              </div>
            </div>
          ) : (
            /* === Voice / calling / incoming layout — Telegram CallScreen === */
            <div className="relative flex flex-col items-center justify-between min-h-[480px]">
              <TelegramCallScreen
                callState={
                  callState === 'calling' ? 'requesting' :
                  callState === 'incoming' ? 'ringing' :
                  callState === 'connected' ? 'active' :
                  callState === 'ended' ? 'terminated' :
                  'requesting'
                }
                name={displayName}
                avatarUrl={displayAvatar}
                isMuted={isMuted}
                isVideoEnabled={!isVideoOff && initialCallType === 'video'}
                isSpeakerEnabled={true}
                duration={duration}
                endReason={callState === 'ended' ? (t('callEnded') as string) : undefined}
                onToggleMute={toggleMic}
                onToggleVideo={toggleVideo}
                onToggleSpeaker={toggleMic}
                onEndCall={endCallSafe}
                onFlipCamera={undefined}
                localVideo={hasLocalVideo && localVideoRef.current?.srcObject instanceof MediaStream ? localVideoRef.current.srcObject : null}
                remoteVideo={remoteVideoRef.current?.srcObject instanceof MediaStream ? remoteVideoRef.current.srcObject : null}
                className="w-full h-full"
              />

              {/* Extra controls overlay for connected calls */}
              {callState === 'connected' && (
                <div className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-4">
                  {/* Screen share */}
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={toggleScreenShare}
                      className={`w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all duration-200 ${
                        isScreenSharing ? 'bg-[var(--color-accent)] text-white' : 'bg-white/[0.15] text-white'
                      }`}
                    >
                      {isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
                    </motion.button>

                    {/* Noise suppression */}
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={toggleNoiseSuppression}
                      className={`w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all duration-200 ${
                        noiseSuppression ? 'bg-emerald-500/30 text-emerald-400' : 'bg-white/[0.15] text-white'
                      }`}
                    >
                      {noiseSuppression ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
                    </motion.button>

                    {/* Reactions */}
                    <div className="relative">
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => setShowReactions(!showReactions)}
                        className="w-[44px] h-[44px] rounded-full bg-white/[0.15] text-white flex items-center justify-center"
                      >
                        <Smile size={18} />
                      </motion.button>
                      <CallReactions
                        isActive={showReactions}
                        onSendReaction={handleSendReaction}
                        onClose={() => setShowReactions(false)}
                      />
                    </div>

                    {/* Video Share */}
                    {initialCallType === 'video' && (
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => setShowVideoShare(true)}
                        className="w-[44px] h-[44px] rounded-full bg-white/[0.15] text-white flex items-center justify-center"
                      >
                        <Film size={18} />
                      </motion.button>
                    )}

                    {/* Quality Selector */}
                    <div className="relative">
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => setShowQualityMenu(!showQualityMenu)}
                        className="w-[44px] h-[44px] rounded-full bg-white/[0.15] text-white flex items-center justify-center text-[10px] font-bold"
                        title="Качество видео"
                      >
                        {videoQuality === 'auto' ? 'HD' : videoQuality.replace('p', '')}
                      </motion.button>
                      <AnimatePresence>
                        {showQualityMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.9 }}
                            className="absolute bottom-full mb-2 right-0 bg-[#141418] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl min-w-[140px]"
                          >
                            <div className="px-3 py-2 border-b border-white/[0.06]">
                              <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Качество</span>
                            </div>
                            {(['auto', '720p', '480p', '360p'] as const).map((q) => (
                              <button
                                key={q}
                                onClick={() => applyVideoQuality(q)}
                                className={`w-full px-3 py-2 text-left text-[12px] transition-colors flex items-center justify-between ${
                                  videoQuality === q
                                    ? 'bg-nexo-500/15 text-nexo-400'
                                    : 'text-white/60 hover:bg-white/[0.05] hover:text-white/80'
                                }`}
                              >
                                <span>{q === 'auto' ? 'Авто (макс)' : q}</span>
                                {videoQuality === q && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-nexo-400" />
                                )}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Minimize */}
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={() => setIsMinimized(true)}
                      className="w-[44px] h-[44px] rounded-full bg-white/[0.15] text-white flex items-center justify-center"
                    >
                      <Minimize2 size={18} />
                    </motion.button>
                  </div>

                  {/* Floating reactions */}
                  <FloatingReactions reactions={sentReactions} />
                </div>
              )}

              {/* Incoming: extra accept/decline buttons handled by TelegramCallScreen */}

              {/* Hidden remote audio element */}
              <audio ref={remoteAudioRef} autoPlay playsInline />
            </div>
          )}
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>

    {/* Video Share Modal */}
    <VideoShareModal
      isOpen={showVideoShare}
      onClose={() => setShowVideoShare(false)}
      onShare={(url, type) => {
        setSharedVideoUrl(url);
        setIsVideoShareActive(true);
        const socket = getSocket();
        if (socket) {
          socket.emit('video_share_start', {
            chatId: targetUserIdRef.current,
            videoUrl: url,
            type,
          });
        }
      }}
      sharedVideoUrl={sharedVideoUrl}
      isSharing={isVideoShareActive}
      remoteVideoUrl={remoteVideoShareUrl}
      currentTime={videoShareTime}
      isPlaying={videoSharePlaying}
      onTimeUpdate={(time) => {
        const socket = getSocket();
        if (socket) {
          socket.emit('video_share_sync', {
            chatId: targetUserIdRef.current,
            currentTime: time,
            isPlaying: videoSharePlaying,
          });
        }
      }}
      onPlayPause={(playing) => {
        setVideoSharePlaying(playing);
        const socket = getSocket();
        if (socket) {
          socket.emit('video_share_sync', {
            chatId: targetUserIdRef.current,
            currentTime: videoShareTime,
            isPlaying: playing,
          });
        }
      }}
      isMine={isVideoShareActive}
    />

    {/* Watch Party Modal */}
    <AnimatePresence>
      {showWatchParty && targetUser && (
        <WatchPartyModal
          callId={targetUser.id}
          isHost={true}
          onClose={() => setShowWatchParty(false)}
        />
      )}
    </AnimatePresence>
    </>
  );
}
