import { useState, useRef, useCallback, useEffect, memo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  MoreVertical,
  MessageSquare,
  Phone,
  Video,
  Star,
  Camera,
  Info,
} from 'lucide-react';
import { normalizeMediaUrl } from '../../lib/mediaUrl';

type TabId = 'media' | 'files' | 'links' | 'music' | 'gifts' | 'tags' | string;

interface InfoSection {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
}

interface PeerInfoTab {
  id: TabId;
  label: string;
  count?: number;
}

interface TelegramPeerInfoProps {
  name: string;
  username?: string;
  avatarUrl?: string | null;
  bio?: string;
  status?: string;
  isOnline?: boolean;
  isPremium?: boolean;
  isVerified?: boolean;
  isSelf?: boolean;
  isChannel?: boolean;
  isGroup?: boolean;
  subscriberCount?: number;
  sections?: InfoSection[];
  tabs?: PeerInfoTab[];
  onBack?: () => void;
  onMessage?: () => void;
  onCall?: () => void;
  onVideoCall?: () => void;
  onMore?: () => void;
  onEdit?: () => void;
  onAvatarClick?: () => void;
  onTabSelect?: (tabId: TabId) => void;
  children?: ReactNode;
  className?: string;
}

function TelegramPeerInfo({
  name,
  username,
  avatarUrl,
  bio,
  status,
  isOnline = false,
  isPremium = false,
  isVerified = false,
  isSelf = false,
  isChannel = false,
  isGroup = false,
  subscriberCount,
  sections = [],
  tabs = [],
  onBack,
  onMessage,
  onCall,
  onVideoCall,
  onMore,
  onEdit,
  onAvatarClick,
  onTabSelect,
  children,
  className = '',
}: TelegramPeerInfoProps) {
  const [activeTab, setActiveTab] = useState<TabId>(tabs[0]?.id || 'media');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTabSelect = useCallback(
    (tabId: TabId) => {
      setActiveTab(tabId);
      onTabSelect?.(tabId);
    },
    [onTabSelect]
  );

  const subtitle = isChannel
    ? `${subscriberCount?.toLocaleString() || 0} подписчиков`
    : isGroup
      ? `${subscriberCount?.toLocaleString() || 0} участников`
      : '';

  return (
    <div className={`flex flex-col h-full bg-[#0e1621] ${className}`}>
      {/* ===== HEADER — Telegram style ===== */}
      <div className="flex-shrink-0 relative">
        <div className="flex items-center gap-1 px-1 py-[7px]">
          {/* Back button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="flex items-center gap-0.5 pl-1.5 pr-2 py-1.5 rounded-full hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors -ml-1"
          >
            <ChevronLeft size={24} className="text-[#6ab2f2]" strokeWidth={2.5} />
            {onMessage && (
              <span className="text-[16px] text-[#6ab2f2] font-normal">Назад</span>
            )}
          </motion.button>

          <div className="flex-1 min-w-0 px-1">
            <h1 className="text-[17px] font-semibold text-white truncate leading-tight">
              {name}
            </h1>
            {subtitle && (
              <p className="text-[13px] text-[#6ab2f2]/70 truncate leading-tight mt-[-1px]">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-0">
            {onMore && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onMore}
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors"
              >
                <MoreVertical size={22} className="text-[#6ab2f2]" />
              </motion.button>
            )}
          </div>
        </div>
        {/* Bottom separator */}
        <div className="h-px bg-[#101921]" />
      </div>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* ===== AVATAR SECTION ===== */}
        <div className="flex flex-col items-center pt-6 pb-3 px-6 relative">
          {/* Subtle glow behind avatar */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] bg-[#6ab2f2]/5 rounded-full blur-[60px] pointer-events-none" />

          {/* Avatar */}
          <motion.div
            whileTap={{ scale: 0.97 }}
            onClick={onAvatarClick}
            className="relative cursor-pointer"
          >
            {/* Premium glow ring */}
            {isPremium && (
              <div className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-yellow-600 opacity-70 blur-[2px] animate-[spin_6s_linear_infinite]" />
            )}

            <div className={`relative w-[120px] h-[120px] rounded-full overflow-hidden ${isPremium ? 'ring-[3px] ring-yellow-400/60' : 'ring-[2px] ring-[#6ab2f2]/20'}`}>
              {avatarUrl ? (
                <img
                  src={normalizeMediaUrl(avatarUrl)}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#6ab2f2]/30 to-[#6ab2f2]/10 flex items-center justify-center">
                  <span className="text-[42px] font-bold text-white/80">
                    {name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Online indicator */}
            {isOnline && !isChannel && !isGroup && (
              <div className="absolute bottom-1 right-1 w-[22px] h-[22px] rounded-full bg-[#0e1621] flex items-center justify-center">
                <div className="w-[16px] h-[16px] rounded-full bg-[#4dcd5e]" />
              </div>
            )}

            {/* Camera button for self */}
            {isSelf && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#6ab2f2] flex items-center justify-center shadow-lg shadow-[#6ab2f2]/30 border-[3px] border-[#0e1621]"
              >
                <Camera size={16} className="text-white" />
              </motion.button>
            )}
          </motion.div>

          {/* Name */}
          <div className="flex items-center gap-1.5 mt-4">
            <h2 className="text-[22px] font-bold text-white text-center leading-tight">
              {name}
            </h2>
            {isVerified && (
              <div className="w-5 h-5 rounded-full bg-[#6ab2f2] flex items-center justify-center flex-shrink-0">
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
            {isPremium && (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                <Star size={11} className="text-white fill-white" />
              </div>
            )}
          </div>

          {/* Username */}
          {username && (
            <p className="text-[15px] text-[#6ab2f2] mt-0.5">@{username}</p>
          )}

          {/* Status */}
          <p className={`text-[14px] mt-1 ${isOnline ? 'text-[#6ab2f2]/70' : 'text-[#6d7f8e]'}`}>
            {isOnline
              ? 'в сети'
              : isGroup
                ? `${subscriberCount?.toLocaleString() || 0} участников`
                : isChannel
                  ? `${subscriberCount?.toLocaleString() || 0} подписчиков`
                  : status || 'давно был(а) в сети'}
          </p>

          {/* Action buttons — Telegram style pill buttons */}
          <div className="flex items-center gap-2.5 mt-5 w-full justify-center">
            {onMessage && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onMessage}
                className="flex items-center gap-2 px-5 py-[9px] rounded-full bg-[#6ab2f2] hover:bg-[#5a9be0] active:bg-[#4d8acc] transition-colors shadow-lg shadow-[#6ab2f2]/20"
              >
                <MessageSquare size={17} className="text-white" strokeWidth={2} />
                <span className="text-[14px] font-medium text-white">Написать</span>
              </motion.button>
            )}
            {onCall && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onCall}
                className="flex items-center gap-2 px-5 py-[9px] rounded-full bg-[#182533] hover:bg-[#1e2d3d] active:bg-[#243545] border border-[#1e2d3d] transition-colors"
              >
                <Phone size={17} className="text-[#6ab2f2]" strokeWidth={2} />
                <span className="text-[14px] font-medium text-[#6ab2f2]">Звонок</span>
              </motion.button>
            )}
            {onVideoCall && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onVideoCall}
                className="flex items-center gap-2 px-5 py-[9px] rounded-full bg-[#182533] hover:bg-[#1e2d3d] active:bg-[#243545] border border-[#1e2d3d] transition-colors"
              >
                <Video size={17} className="text-[#6ab2f2]" strokeWidth={2} />
                <span className="text-[14px] font-medium text-[#6ab2f2]">Видео</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* ===== INFO SECTIONS — Telegram style ===== */}
        {sections.length > 0 && (
          <div className="mx-4 mb-3 rounded-2xl bg-[#17212b] overflow-hidden">
            {sections.map((section, i) => (
              <button
                key={i}
                onClick={section.onClick}
                className={`w-full flex items-start gap-3.5 px-4 py-[11px] text-left hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors ${
                  i < sections.length - 1 ? 'border-b border-[#101921]' : ''
                }`}
              >
                <span className="text-[#6d7f8e] mt-[2px] flex-shrink-0">{section.icon}</span>
                <div className="min-w-0">
                  <p className="text-[13px] text-[#6d7f8e] leading-tight">{section.label}</p>
                  <p className="text-[15px] text-white mt-0.5 break-words leading-snug">{section.value}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ===== TABS — Telegram style ===== */}
        {tabs.length > 0 && (
          <div className="border-b border-[#101921]">
            <div className="flex items-center overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabSelect(tab.id)}
                    className={`relative flex items-center gap-1.5 px-4 py-[11px] whitespace-nowrap transition-colors ${
                      isActive ? 'text-[#6ab2f2]' : 'text-[#6d7f8e]'
                    }`}
                  >
                    <span className={`text-[14px] font-medium ${isActive ? 'text-[#6ab2f2]' : 'text-[#6d7f8e]'}`}>
                      {tab.label}
                    </span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className="text-[12px] text-[#6d7f8e]/60 ml-0.5">({tab.count})</span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="peerInfoTabLine"
                        className="absolute bottom-0 left-3 right-3 h-[2.5px] bg-[#6ab2f2] rounded-full"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== TAB CONTENT ===== */}
        <div className="min-h-[200px]">
          {children}
        </div>
      </div>
    </div>
  );
}

export default memo(TelegramPeerInfo);
