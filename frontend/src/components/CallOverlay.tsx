import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneIcon as Phone,
  PhoneOffIcon as PhoneOff,
  MicIcon as Mic,
  MicOffIcon as MicOff,
  VideoIcon as Video,
  VideoOffIcon as VideoOff,
  MonitorIcon as Monitor,
  MaximizeIcon as Maximize2,
  MinimizeIcon as Minimize2,
  BluetoothIcon as Bluetooth,
  CopyIcon as Copy,
  CheckCircleIcon as Check,
  ShieldCheckIcon as ShieldCheck,
  ShieldIcon as Shield,
  CloseIcon as X,
} from '../lib/appleIcons';
import { MonitorOff, Fingerprint } from 'lucide-react';
import { getSocket, wsRequest } from '../lib/socket';
import type { UserBasic } from '../lib/types';
import { getSessionInfo } from '../lib/e2e';
import { playRingtone, playSoundFile } from '../lib/sounds';

interface CallOverlayProps {
  open: boolean;
  type: 'voice' | 'video';
  target?: UserBasic | null;
  chatId?: string;
  incoming?: boolean;
  initialOffer?: RTCSessionDescriptionInit | null;
  onClose: () => void;
  onIncomingRejected?: () => void;
}

type CallState = 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed';

export function CallOverlay({ open, type, target, chatId, incoming, initialOffer, onClose, onIncomingRejected }: CallOverlayProps) {
  const [callState, setCallState] = useState<CallState>('connecting');
  const [duration, setDuration] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(type === 'video');
  const [screenShare, setScreenShare] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [audioOutput, setAudioOutput] = useState<'speaker' | 'earpiece'>('speaker');
  const [copySuccess, setCopySuccess] = useState(false);
  const [showE2EInfo, setShowE2EInfo] = useState(false);
  const [e2eFingerprint, setE2eFingerprint] = useState<string | null>(null);
  const [e2eCopySuccess, setE2eCopySuccess] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callListenersRef = useRef<{ event: string; handler: (data: any) => void }[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const e2eCopyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const iceConfigRef = useRef<RTCConfiguration>({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
    iceCandidatePoolSize: 2,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  });

  useEffect(() => {
    if (chatId) {
      const info = getSessionInfo(chatId);
      if (info) {
        setE2eFingerprint(info.keyFingerprint);
      }
    }
  }, [chatId]);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    if (e2eCopyTimerRef.current) clearTimeout(e2eCopyTimerRef.current);
  }, []);

  const initLocalStream = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: videoOn ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current && videoOn) {
        localVideoRef.current.srcObject = stream;
      }

      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const gain = audioContextRef.current.createGain();
      gain.gain.value = 1.0;
      source.connect(gain);

      return stream;
    } catch (err) {
      console.error('[Call] Failed to get media:', err);
      setCallState('failed');
      return null;
    }
  }, [videoOn]);

  const createPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection(iceConfigRef.current);
    peerRef.current = pc;

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsRequest('call:ice-candidate', {
          candidate: event.candidate.toJSON(),
          targetUserId: target?.id,
          chatId,
        }).catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        setCallState('connected');
        if (ringtoneRef.current) {
          try {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
          } catch {}
          ringtoneRef.current = null;
        }
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        setCallState('ended');
        cleanupCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    return pc;
  }, [target, chatId]);

  const cleanupCall = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Stop ringtone (deep Nexo call sound)
    if (ringtoneRef.current) {
      try {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      } catch {}
      ringtoneRef.current = null;
    }

    const socket = getSocket();
    if (socket) {
      for (const { event, handler } of callListenersRef.current) {
        socket.off(event, handler);
      }
      callListenersRef.current = [];
      socket.emit('call:end', { targetUserId: target?.id, chatId });
    }
  }, [target, chatId]);

  const attachCallListeners = useCallback((onAnswer: (data: any) => void, onIceCandidate: (data: any) => void, onEnded: () => void) => {
    const socket = getSocket();
    if (!socket) return;
    callListenersRef.current = [
      { event: 'call:answer', handler: onAnswer },
      { event: 'call:ice-candidate', handler: onIceCandidate },
      { event: 'call:ended', handler: onEnded },
    ];
    socket.on('call:answer', onAnswer);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:ended', onEnded);
  }, []);

  const startCall = useCallback(async () => {
    const stream = await initLocalStream();
    if (!stream) return;

    const pc = createPeerConnection(stream);
    setCallState('ringing');
    ringtoneRef.current = playSoundFile('/sounds/call_sound.mp3', true);
    playRingtone();

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: videoOn,
      });
      await pc.setLocalDescription(offer);

      await wsRequest('call:offer', {
        offer: pc.localDescription,
        targetUserId: target?.id,
        chatId,
        callType: type,
      });

      attachCallListeners(
        async (data: any) => {
          if (data.answer && peerRef.current) {
            await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          }
        },
        async (data: any) => {
          if (data.candidate && peerRef.current) {
            try {
              await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch {}
          }
        },
        () => {
          cleanupCall();
          setCallState('ended');
        }
      );
    } catch (err) {
      console.error('[Call] Failed to create offer:', err);
      setCallState('failed');
    }
  }, [initLocalStream, createPeerConnection, target, chatId, type, videoOn, attachCallListeners, cleanupCall]);

  const acceptIncomingCall = useCallback(async () => {
    if (!initialOffer) {
      setCallState('failed');
      return;
    }
    const stream = await initLocalStream();
    if (!stream) return;

    const pc = createPeerConnection(stream);
    setCallState('ringing');

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(initialOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await wsRequest('call:answer', {
        answer: pc.localDescription,
        targetUserId: target?.id,
        chatId,
      });

      attachCallListeners(
        async () => {},
        async (data: any) => {
          if (data.candidate && peerRef.current) {
            try {
              await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch {}
          }
        },
        () => {
          cleanupCall();
          setCallState('ended');
        }
      );
    } catch (err) {
      console.error('[Call] Failed to answer incoming call:', err);
      setCallState('failed');
    }
  }, [initialOffer, initLocalStream, createPeerConnection, target, chatId, attachCallListeners, cleanupCall]);

  const rejectIncomingCall = useCallback(() => {
    const socket = getSocket();
    if (socket) {
      socket.emit('call:end', { targetUserId: target?.id, chatId });
    }
    cleanupCall();
    onIncomingRejected?.();
    onClose();
  }, [target, chatId, cleanupCall, onIncomingRejected, onClose]);

  const endCall = useCallback(() => {
    cleanupCall();
    onClose();
  }, [cleanupCall, onClose]);

  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Keep the latest callbacks in refs so this effect only reacts to
  // open/incoming changes. Re-running on startCall change would restart the
  // call (e.g. toggling video mid-call re-fires startCall after cleanup).
  const startCallRef = useRef(startCall);
  const cleanupCallRef = useRef(cleanupCall);
  useEffect(() => {
    startCallRef.current = startCall;
    cleanupCallRef.current = cleanupCall;
  });

  useEffect(() => {
    if (open) {
      if (incoming) {
        setCallState('ringing');
        ringtoneRef.current = playSoundFile('/sounds/call_sound.mp3', true);
        playRingtone();
      } else {
        startCallRef.current();
      }
    }
    return () => {
      cleanupCallRef.current();
    };
  }, [open, incoming]);

  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
      setMicOn(v => !v);
    }
  }, []);

  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current) return;

    if (videoOn) {
      localStreamRef.current.getVideoTracks().forEach(t => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
      });
      setVideoOn(false);
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        });
        // The call may have been cleaned up while awaiting permission.
        const stream = localStreamRef.current;
        const pc = peerRef.current;
        if (!stream || !pc) {
          videoStream.getTracks().forEach(t => t.stop());
          return;
        }
        videoStream.getVideoTracks().forEach(track => {
          stream.addTrack(track);
          pc.addTrack(track, stream);
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setVideoOn(true);
      } catch {}
    }
  }, [videoOn]);

  const toggleScreenShare = useCallback(async () => {
    if (screenShare) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      setScreenShare(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: true,
      });

      screenStreamRef.current = stream;

      stream.getVideoTracks().forEach(track => {
        if (localStreamRef.current) {
          const oldVideo = localStreamRef.current.getVideoTracks()[0];
          if (oldVideo) {
            localStreamRef.current.removeTrack(oldVideo);
            oldVideo.stop();
          }
          localStreamRef.current.addTrack(track);
          const senders = peerRef.current?.getSenders();
          const sender = senders?.find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(track).catch(() => {});
          }
        }
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }
      });

      stream.addEventListener('inactive', () => {
        setScreenShare(false);
        if (peerRef.current && localStreamRef.current) {
          navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
            .then(videoStream => {
              const newTrack = videoStream.getVideoTracks()[0];
              if (newTrack && localStreamRef.current) {
                localStreamRef.current.addTrack(newTrack);
                const sender = peerRef.current?.getSenders().find(s => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(newTrack);
              }
            })
            .catch(() => {});
        }
      });
      setScreenShare(true);
    } catch (err) {
      console.error('[Call] Screen share failed:', err);
    }
  }, [screenShare]);

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getStateText = () => {
    switch (callState) {
      case 'connecting': return 'Подключение...';
      case 'ringing': return incoming ? 'Входящий звонок...' : 'Звонок...';
      case 'connected': return formatDuration(duration);
      case 'ended': return 'Разговор завершён';
      case 'failed': return 'Не удалось подключиться';
    }
  };

  const callId = chatId || `p2p_${target?.id || Date.now()}`;

  const copyCallId = () => {
    navigator.clipboard.writeText(callId)
      .then(() => {
        setCopySuccess(true);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(() => {});
  };

  const copyE2EFingerprint = () => {
    if (e2eFingerprint) {
      navigator.clipboard.writeText(e2eFingerprint)
        .then(() => {
          setE2eCopySuccess(true);
          if (e2eCopyTimerRef.current) clearTimeout(e2eCopyTimerRef.current);
          e2eCopyTimerRef.current = setTimeout(() => setE2eCopySuccess(false), 2000);
        })
        .catch(() => {});
    }
  };

  const toggleAudioOutput = () => {
    setAudioOutput(prev => prev === 'speaker' ? 'earpiece' : 'speaker');
    if (remoteVideoRef.current) {
      remoteVideoRef.current.setSinkId?.(audioOutput === 'speaker' ? '' : 'default').catch(() => {});
    }
  };

  if (!open) return null;

  const fingerprintPairs = (e2eFingerprint || '').match(/.{1,8}/g) || [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-[90] ${isMinimized ? '' : 'bg-black/80 backdrop-blur-xl'}`}
        >
          {isMinimized ? (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="absolute bottom-4 left-4 right-4 max-w-md mx-auto"
            >
              <div className="glass-strong rounded-2xl p-3 flex items-center gap-3">
                {e2eFingerprint && (
                  <div className="w-2 h-2 rounded-full bg-green-400 absolute top-2 right-2" title="E2E защищён" />
                )}
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Phone size={16} className="text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/80 truncate">
                    {target?.displayName || target?.username || 'Звонок'}
                  </p>
                  <p className="text-[10px] text-green-400/60">{type === 'video' ? 'Видео' : 'Голос'} · {getStateText()}</p>
                </div>
                <button
                  onClick={() => setIsMinimized(false)}
                  className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
                >
                  <Maximize2 size={14} className="text-white/50" />
                </button>
                <button
                  onClick={endCall}
                  className="p-2 rounded-xl bg-red-500/80 hover:bg-red-500 transition-colors"
                >
                  <PhoneOff size={14} className="text-white" />
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
                >
                  <Minimize2 size={16} className="text-white/50" />
                </button>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white/90">
                    {target?.displayName || target?.username || 'Звонок'}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${
                    callState === 'connected' ? 'text-green-400/70' :
                    callState === 'ringing' ? 'text-blue-400/70' :
                    callState === 'failed' ? 'text-red-400/70' : 'text-white/40'
                  }`}>
                    {getStateText()}
                    {e2eFingerprint && callState === 'connected' && (
                      <span className="ml-2 text-green-400/50">· E2E</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={endCall}
                  className="p-2 rounded-xl bg-red-500/80 hover:bg-red-500 transition-colors"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>

              <div className="flex-1 flex items-center justify-center p-4 relative">
                {type === 'video' ? (
                  <div className="relative w-full h-full max-w-4xl mx-auto">
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover rounded-3xl bg-black/40"
                    />

                    {videoOn && (
                      <div className={`absolute ${isPip ? 'inset-0 z-10' : 'top-4 right-4 w-36 h-64'}`}>
                        <video
                          ref={localVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className={`w-full h-full object-cover rounded-2xl bg-black/60 border border-white/[0.1] ${isPip ? '' : 'shadow-2xl'}`}
                        />
                        <button
                          onClick={() => setIsPip(!isPip)}
                          className={`absolute ${isPip ? 'top-4 right-4' : 'top-2 right-2'} p-1 rounded-lg bg-black/40 hover:bg-black/60 transition-colors`}
                        >
                          {isPip ? <Minimize2 size={12} className="text-white/70" /> : <Maximize2 size={12} className="text-white/70" />}
                        </button>
                      </div>
                    )}

                    {screenShare && (
                      <div className="absolute bottom-4 right-4 w-36 h-24">
                        <video
                          ref={screenVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover rounded-xl bg-black/60 border border-white/[0.1]"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/20 flex items-center justify-center">
                      <Phone size={36} className="text-green-400/60" />
                    </div>
                    <h2 className="text-lg font-semibold text-white/90">
                      {target?.displayName || target?.username || 'Звонок'}
                    </h2>
                    {callState === 'ringing' && (
                      <div className="flex items-center justify-center gap-1 mt-3">
                        {[0, 1, 2].map(i => (
                          <motion.div
                            key={i}
                            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.4 }}
                            className="w-2 h-2 rounded-full bg-green-400/60"
                          />
                        ))}
                      </div>
                    )}

                    {incoming && callState === 'ringing' && (
                      <div className="flex items-center justify-center gap-4 mt-6">
                        <button
                          onClick={rejectIncomingCall}
                          className="flex items-center gap-2 px-5 py-3 rounded-full bg-red-500 hover:bg-red-600 transition-all shadow-lg shadow-red-500/30"
                        >
                          <PhoneOff size={18} className="text-white" />
                          <span className="text-sm font-medium text-white">Отклонить</span>
                        </button>
                        <button
                          onClick={acceptIncomingCall}
                          className="flex items-center gap-2 px-5 py-3 rounded-full bg-green-500 hover:bg-green-600 transition-all shadow-lg shadow-green-500/30"
                        >
                          <Phone size={18} className="text-white" />
                          <span className="text-sm font-medium text-white">Принять</span>
                        </button>
                      </div>
                    )}

                    {e2eFingerprint && callState === 'connected' && (
                      <div className="mt-4">
                        <button
                          onClick={() => setShowE2EInfo(!showE2EInfo)}
                          className="flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px]"
                        >
                          <ShieldCheck size={11} />
                          E2E защищён
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* E2E Info Panel */}
              <AnimatePresence>
                {showE2EInfo && e2eFingerprint && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mx-4 mb-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <div className="flex items-center gap-2 mb-2">
                        <Fingerprint size={12} className="text-green-400" />
                        <span className="text-[10px] text-white/50">Отпечаток ключа звонка</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 mb-2">
                        {fingerprintPairs.slice(0, 16).map((pair, i) => (
                          <span key={i} className={`text-[9px] font-mono ${i % 2 === 0 ? 'text-white/60' : 'text-white/40'}`}>
                            {pair}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={copyE2EFingerprint}
                        className="flex items-center gap-1 text-[10px] text-blue-400/60 hover:text-blue-400 transition-colors"
                      >
                        {e2eCopySuccess ? <><Check size={10} /> Скопировано</> : <><Copy size={10} /> Копировать</>}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-center gap-3 px-4 pb-8 pt-3">
                <button
                  onClick={toggleMic}
                  className={`p-4 rounded-full transition-all ${
                    micOn ? 'bg-white/[0.08] hover:bg-white/[0.12]' : 'bg-red-500/80 hover:bg-red-500'
                  }`}
                >
                  {micOn ? <Mic size={20} className="text-white/80" /> : <MicOff size={20} className="text-white" />}
                </button>

                {type === 'video' && (
                  <button
                    onClick={toggleVideo}
                    className={`p-4 rounded-full transition-all ${
                      videoOn ? 'bg-white/[0.08] hover:bg-white/[0.12]' : 'bg-red-500/80 hover:bg-red-500'
                    }`}
                  >
                    {videoOn ? <Video size={20} className="text-white/80" /> : <VideoOff size={20} className="text-white" />}
                  </button>
                )}

                <button
                  onClick={toggleScreenShare}
                  className={`p-4 rounded-full transition-all ${
                    screenShare ? 'bg-blue-500/80 hover:bg-blue-500' : 'bg-white/[0.08] hover:bg-white/[0.12]'
                  }`}
                >
                  {screenShare ? <MonitorOff size={20} className="text-white" /> : <Monitor size={20} className="text-white/80" />}
                </button>

                <button
                  onClick={toggleAudioOutput}
                  className="p-4 rounded-full bg-white/[0.08] hover:bg-white/[0.12] transition-all"
                >
                  <Bluetooth size={20} className="text-white/60" />
                </button>

                <button
                  onClick={copyCallId}
                  className="p-4 rounded-full bg-white/[0.08] hover:bg-white/[0.12] transition-all"
                >
                  {copySuccess ? <Check size={20} className="text-green-400" /> : <Copy size={20} className="text-white/60" />}
                </button>

                {e2eFingerprint && (
                  <button
                    onClick={() => setShowE2EInfo(!showE2EInfo)}
                    className={`p-4 rounded-full transition-all ${
                      showE2EInfo ? 'bg-green-500/30' : 'bg-white/[0.08] hover:bg-white/[0.12]'
                    }`}
                    title="E2E шифрование"
                  >
                    {showE2EInfo ? <ShieldCheck size={20} className="text-green-400" /> : <Shield size={20} className="text-white/60" />}
                  </button>
                )}

                <button
                  onClick={endCall}
                  className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-all shadow-lg shadow-red-500/30"
                >
                  <PhoneOff size={24} className="text-white" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
