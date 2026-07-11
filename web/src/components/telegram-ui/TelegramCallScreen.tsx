import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  UserPlus,
} from 'lucide-react';
import { normalizeMediaUrl } from '../../lib/mediaUrl';

type CallState = 'requesting' | 'ringing' | 'connecting' | 'active' | 'terminated';

interface TelegramCallScreenProps {
  callState: CallState;
  name: string;
  avatarUrl?: string | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerEnabled: boolean;
  duration: number;
  endReason?: string;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
  onFlipCamera?: () => void;
  onAddParticipant?: () => void;
  localVideo?: MediaStream | null;
  remoteVideo?: MediaStream | null;
  className?: string;
}

const GRADIENT_STATES = {
  requesting: ['#568FD6', '#626ED5', '#A667D5', '#7664DA'],
  active: ['#ACBD65', '#459F8D', '#53A4D1', '#3E917A'],
  badSignal: ['#C0508D', '#F09536', '#CE5081', '#FC7C4C'],
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function TelegramCallScreen({
  callState,
  name,
  avatarUrl,
  isMuted,
  isVideoEnabled,
  isSpeakerEnabled,
  duration,
  endReason,
  onToggleMute,
  onToggleVideo,
  onToggleSpeaker,
  onEndCall,
  onFlipCamera,
  onAddParticipant,
  localVideo,
  remoteVideo,
  className = '',
}: TelegramCallScreenProps) {
  const [phase, setPhase] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Animated gradient phase
  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((p) => (p + 0.5) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Attach remote video stream
  useEffect(() => {
    if (videoRef.current && remoteVideo) {
      videoRef.current.srcObject = remoteVideo;
    }
  }, [remoteVideo]);

  // Attach local video stream
  useEffect(() => {
    if (localVideoRef.current && localVideo) {
      localVideoRef.current.srcObject = localVideo;
    }
  }, [localVideo]);

  const gradientColors =
    callState === 'active'
      ? GRADIENT_STATES.active
      : callState === 'terminated'
        ? GRADIENT_STATES.requesting
        : GRADIENT_STATES.requesting;

  const gradientAngle = 135 + phase * 0.3;

  const statusText =
    callState === 'requesting'
      ? 'Вызов...'
      : callState === 'ringing'
        ? 'Звонит...'
        : callState === 'connecting'
          ? 'Подключение...'
          : callState === 'active'
            ? formatDuration(duration)
            : endReason || 'Завершён';

  const isActive = callState === 'active';
  const isTerminated = callState === 'terminated';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`relative w-full h-full overflow-hidden ${className}`}
    >
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 transition-all duration-1000"
        style={{
          background: `linear-gradient(${gradientAngle}deg, ${gradientColors[0]}, ${gradientColors[1]}, ${gradientColors[2]}, ${gradientColors[3]})`,
        }}
      />

      {/* Animated blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full bg-white/[0.08] blur-[80px]"
          animate={{
            x: [0, 50, -30, 0],
            y: [0, -40, 20, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            top: '20%',
            left: '30%',
          }}
        />
        <motion.div
          className="absolute w-[250px] h-[250px] rounded-full bg-white/[0.06] blur-[60px]"
          animate={{
            x: [0, -40, 30, 0],
            y: [0, 30, -50, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            top: '40%',
            right: '20%',
          }}
        />
      </div>

      {/* Remote video (background) */}
      {remoteVideo && isActive && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover rounded-[28px]"
        />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-between h-full px-6 pt-14 pb-12">
        {/* Top section: Back + Conference button */}
        <div className="flex items-center justify-between w-full">
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/[0.1] backdrop-blur-sm"
          >
            <ChevronLeft size={18} className="text-white" />
            <span className="text-white text-[15px] font-medium">Назад</span>
          </motion.button>

          {isActive && onAddParticipant && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onAddParticipant}
              className="w-10 h-10 rounded-full bg-white/[0.15] flex items-center justify-center backdrop-blur-sm"
            >
              <UserPlus size={18} className="text-white" />
            </motion.button>
          )}
        </div>

        {/* Center: Avatar + Name + Status */}
        <div className="flex flex-col items-center gap-6">
          {/* Avatar with blob animation */}
          <div className="relative">
            {/* Blob rings */}
            <motion.div
              className="absolute -inset-5 rounded-full bg-white/[0.1]"
              animate={
                isActive
                  ? {
                      scale: [1, 1.05, 1],
                      opacity: [0.15, 0.25, 0.15],
                    }
                  : {}
              }
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="absolute -inset-10 rounded-full bg-white/[0.05]"
              animate={
                isActive
                  ? {
                      scale: [1, 1.08, 1],
                      opacity: [0.08, 0.15, 0.08],
                    }
                  : {}
              }
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 0.3,
              }}
            />

            {/* Avatar */}
            <motion.div
              className="relative w-[136px] h-[136px] rounded-full overflow-hidden"
              animate={
                isActive
                  ? {
                      scale: [1, 1.03, 1],
                    }
                  : {}
              }
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              {avatarUrl ? (
                <img
                  src={normalizeMediaUrl(avatarUrl)}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/20 flex items-center justify-center">
                  <span className="text-5xl font-bold text-white">
                    {name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </motion.div>
          </div>

          {/* Name */}
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[28px] font-bold text-white text-center leading-tight"
          >
            {name}
          </motion.h2>

          {/* Status */}
          <motion.div
            key={statusText}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <span className="text-[16px] text-white/70 font-medium tabular-nums">
              {statusText}
            </span>
            {(callState === 'requesting' || callState === 'ringing' || callState === 'connecting') && (
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="text-white/70"
              >
                •••
              </motion.span>
            )}
          </motion.div>
        </div>

        {/* Bottom: Controls */}
        {!isTerminated && (
          <div className="flex flex-col items-center gap-6 w-full">
            {/* Notices */}
            <AnimatePresence>
              {isMuted && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.15] backdrop-blur-sm"
                >
                  <MicOff size={14} className="text-white/80" />
                  <span className="text-[13px] text-white/80 font-medium">
                    Мicrophone выключен
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Button group */}
            <div className="flex items-center justify-center gap-4">
              {/* Audio output */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={onToggleSpeaker}
                className={`w-[56px] h-[56px] rounded-full flex items-center justify-center transition-all duration-200 ${
                  isSpeakerEnabled
                    ? 'bg-white text-black'
                    : 'bg-white/[0.15] text-white backdrop-blur-sm'
                }`}
              >
                {isSpeakerEnabled ? (
                  <Volume2 size={22} />
                ) : (
                  <VolumeX size={22} />
                )}
              </motion.button>

              {/* Video */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={onToggleVideo}
                className={`w-[56px] h-[56px] rounded-full flex items-center justify-center transition-all duration-200 ${
                  isVideoEnabled
                    ? 'bg-white text-black'
                    : 'bg-white/[0.15] text-white backdrop-blur-sm'
                }`}
              >
                {isVideoEnabled ? <Video size={22} /> : <VideoOff size={22} />}
              </motion.button>

              {/* Flip camera */}
              {isVideoEnabled && onFlipCamera && (
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={onFlipCamera}
                  className="w-[56px] h-[56px] rounded-full bg-white/[0.15] text-white flex items-center justify-center backdrop-blur-sm"
                >
                  <RotateCcw size={22} />
                </motion.button>
              )}

              {/* Microphone */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={onToggleMute}
                className={`w-[56px] h-[56px] rounded-full flex items-center justify-center transition-all duration-200 ${
                  isMuted
                    ? 'bg-white text-black'
                    : 'bg-white/[0.15] text-white backdrop-blur-sm'
                }`}
              >
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </motion.button>

              {/* End call */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={onEndCall}
                className="w-[56px] h-[56px] rounded-full bg-[#FF3B30] text-white flex items-center justify-center shadow-lg shadow-red-500/30"
              >
                <PhoneOff size={22} />
              </motion.button>
            </div>
          </div>
        )}
      </div>

      {/* Local video (PiP) */}
      {localVideo && isVideoEnabled && (
        <motion.div
          drag
          dragConstraints={{
            top: -300,
            left: -200,
            right: 200,
            bottom: 400,
          }}
          dragElastic={0.1}
          className="absolute bottom-40 right-4 w-[140px] h-[190px] rounded-[18px] overflow-hidden border-2 border-white/20 shadow-2xl z-20"
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </motion.div>
      )}
    </motion.div>
  );
}

function ChevronLeft({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default memo(TelegramCallScreen);
