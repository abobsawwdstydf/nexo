import React from 'react';
import {
  Heart, ThumbsUp, Bookmark, Bell, Search, Menu, Settings, Check,
  Share, Copy, Send, X, Lock, Eye, Play, Volume2, Loader2, Star,
  ToggleLeft, Circle, CheckSquare, Maximize2, ZoomIn, ZoomOut,
  ArrowDown, Activity, HelpCircle, AlertCircle, UserPlus, UserMinus,
  Video, Mic, Download, Folder, Mail, Github, Twitter,
  Calendar, Infinity, Home, Archive, Trash2, Pencil, Clock,
} from 'lucide-react';

// ==================== ANIMATED ICON COMPONENTS ====================
// Each wraps a Lucide icon with CSS hover animation

interface AnimatedIconProps {
  size?: number;
  className?: string;
}

const withHoverAnimation = (Icon: React.FC<any>) => {
  const Wrapped: React.FC<AnimatedIconProps> = ({ size = 24, className }) => (
    <span className="inline-flex transition-transform duration-200 hover:scale-110">
      <Icon size={size} className={className} />
    </span>
  );
  Wrapped.displayName = `Animated${Icon.displayName || 'Icon'}`;
  return Wrapped;
};

export const AnimatedHeart = withHoverAnimation(Heart);
export const AnimatedLike = withHoverAnimation(ThumbsUp);
export const AnimatedBookmark = withHoverAnimation(Bookmark);
export const AnimatedNotification = withHoverAnimation(Bell);
export const AnimatedSearch = withHoverAnimation(Search);
export const AnimatedMenu = withHoverAnimation(Menu);
export const AnimatedSettings = withHoverAnimation(Settings);
export const AnimatedCheckmark = withHoverAnimation(Check);
export const AnimatedShare = withHoverAnimation(Share);
export const AnimatedCopy = withHoverAnimation(Copy);
export const AnimatedSend = withHoverAnimation(Send);
export const AnimatedClose = withHoverAnimation(X);
export const AnimatedLock = withHoverAnimation(Lock);
export const AnimatedEye = withHoverAnimation(Eye);
export const AnimatedPlayPause = withHoverAnimation(Play);
export const AnimatedVolume = withHoverAnimation(Volume2);
export const AnimatedLoading = withHoverAnimation(Loader2);
export const AnimatedStar = withHoverAnimation(Star);
export const AnimatedToggle = withHoverAnimation(ToggleLeft);
export const AnimatedRadioButton = withHoverAnimation(Circle);
export const AnimatedCheckBox = withHoverAnimation(CheckSquare);
export const AnimatedMaximize = withHoverAnimation(Maximize2);
export const AnimatedZoomIn = withHoverAnimation(ZoomIn);
export const AnimatedZoomOut = withHoverAnimation(ZoomOut);
export const AnimatedScrollDown = withHoverAnimation(ArrowDown);
export const AnimatedActivity = withHoverAnimation(Activity);
export const AnimatedHelp = withHoverAnimation(HelpCircle);
export const AnimatedInfo = withHoverAnimation(AlertCircle);
export const AnimatedError = withHoverAnimation(AlertCircle);
export const AnimatedThumbUp = withHoverAnimation(ThumbsUp);
export const AnimatedTrash = withHoverAnimation(Trash2);
export const AnimatedEdit = withHoverAnimation(Pencil);
export const AnimatedDownload = withHoverAnimation(Download);
export const AnimatedMail = withHoverAnimation(Mail);
export const AnimatedGithub = withHoverAnimation(Github);
export const AnimatedTwitter = withHoverAnimation(Twitter);
export const AnimatedVideo = withHoverAnimation(Video);
export const AnimatedMicrophone = withHoverAnimation(Mic);
export const AnimatedCalendar = withHoverAnimation(Calendar);
export const AnimatedClock = withHoverAnimation(Clock);
export const AnimatedInfinity = withHoverAnimation(Infinity);
export const AnimatedHome = withHoverAnimation(Home);
export const AnimatedArchive = withHoverAnimation(Archive);

// Modern Icons re-exports as simple animated wrappers (no external deps)
export const SvgAniSpinner: React.FC<AnimatedIconProps> = ({ size = 24, className }) => (
  <span className="inline-flex animate-spin">
    <Loader2 size={size} className={className} />
  </span>
);
export const SvgAniHeart: React.FC<AnimatedIconProps> = ({ size = 24, className }) => (
  <span className="inline-flex animate-pulse">
    <Heart size={size} className={className} />
  </span>
);
export const SvgAniPulse: React.FC<AnimatedIconProps> = ({ size = 24, className }) => (
  <span className="inline-flex animate-ping">
    <Activity size={size} className={className} />
  </span>
);
export const SvgAniGear: React.FC<AnimatedIconProps> = ({ size = 24, className }) => (
  <span className="inline-flex animate-spin" style={{ animationDuration: '3s' }}>
    <Settings size={size} className={className} />
  </span>
);
export const SvgAniBounce: React.FC<AnimatedIconProps> = ({ size = 24, className }) => (
  <span className="inline-flex animate-bounce">
    <Activity size={size} className={className} />
  </span>
);
export const SvgAniDots: React.FC<AnimatedIconProps> = ({ size = 24, className }) => (
  <span className="inline-flex">
    {[0, 1, 2].map((i) => (
      <span key={i} className="inline-block w-1 h-1 rounded-full bg-current mx-0.5 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
    ))}
  </span>
);
export const SvgAniPing: React.FC<AnimatedIconProps> = ({ size = 24, className }) => (
  <span className="relative inline-flex">
    <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-75 animate-ping" />
    <Circle size={size} className={`relative ${className}`} />
  </span>
);
