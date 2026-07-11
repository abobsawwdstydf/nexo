import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, X, Search, Users, Lock, Crown, Info } from 'lucide-react';
import { api } from '../lib/api';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import Avatar from './Avatar';
import ChannelProfile from './ChannelProfile';
import VerifiedBadge from './VerifiedBadge';
import type { Chat } from '../lib/types';

interface ChannelCirclesProps {
  onChannelClick?: (channelId: string) => void;
}

/**
 * ChannelCircles - компонент для отображения каналов в виде окружков (Stories-like)
 * Показывает подписанные каналы + возможность поиска новых
 */
export default function ChannelCircles({ onChannelClick }: ChannelCirclesProps) {
  const { chats, setActiveChat } = useChatStore();
  const { user } = useAuthStore();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Chat[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  // Фильтруем только каналы из чатов
  const channels = chats.filter(chat => chat.type === 'channel');

  // Поиск каналов
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.searchChannels(searchQuery);
        setSearchResults(results);
      } catch (e) {
        console.error('Channel search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleChannelClick = (channelId: string) => {
    if (onChannelClick) {
      onChannelClick(channelId);
    } else {
      setActiveChat(channelId);
    }
  };

  const handleJoinChannel = async (channel: Chat) => {
    try {
      const joined = await api.joinChannel(channel.username!);
      useChatStore.getState().addChat(joined);
      setSearchQuery('');
      setShowSearch(false);
      handleChannelClick(joined.id);
    } catch (e) {
      console.error('Failed to join channel:', e);
    }
  };

  const handleOpenProfile = (channelId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSelectedChannelId(channelId);
  };

  const handleLongPressStart = (channelId: string) => {
    const timer = setTimeout(() => {
      handleOpenProfile(channelId);
    }, 500); // 500ms для долгого нажатия
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  return (
    <>
      <div className="px-4 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {/* Кнопка поиска каналов */}
          <button
            onClick={() => setShowSearch(true)}
            className="flex flex-col items-center gap-1 flex-shrink-0 group"
          >
            <div className="w-14 h-14 rounded-full glass-btn group-hover:scale-105 transition-transform relative">
              <Plus size={16} className="text-nexo-400" />
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-nexo-500 flex items-center justify-center">
                <Search size={10} className="text-white" />
              </div>
            </div>
            <span className="text-[10px] text-zinc-500 truncate w-14 text-center">Найти</span>
          </button>

          {/* Окружки каналов */}
          {channels.map((channel) => {
            const hasUnread = (channel.unreadCount || 0) > 0;
            const isPremium = channel.subscriptionPrice && channel.subscriptionPrice > 0;
            const isPrivate = false;
            
            return (
              <div
                key={channel.id}
                className="flex flex-col items-center gap-1 flex-shrink-0 group relative"
              >
                <div className="relative">
                  <button
                    onClick={() => handleChannelClick(channel.id)}
                    onContextMenu={(e) => handleOpenProfile(channel.id, e)}
                    onTouchStart={() => handleLongPressStart(channel.id)}
                    onTouchEnd={handleLongPressEnd}
                    onTouchCancel={handleLongPressEnd}
                    className="w-14 h-14 rounded-[16px] p-[2px] transition-transform group-hover:scale-105 relative"
                    style={{
                      background: hasUnread
                        ? 'linear-gradient(135deg, rgb(139, 92, 246), rgb(168, 85, 247), rgb(236, 72, 153))'
                        : '#3f3f46'
                    }}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#0a0a0f] relative">
                      <Avatar
                        src={channel.avatar}
                        name={channel.name || channel.username || 'C'}
                        size="lg"
                        className="w-full h-full"
                        isVerified={channel.isVerified}
                        verifiedBadgeUrl={channel.verifiedBadgeUrl}
                        verifiedBadgeType={channel.verifiedBadgeType}
                      />
                      
                      {/* Индикаторы */}
                      {isPremium && (
                        <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center border border-[#0a0a0f]">
                          <Crown size={8} className="text-white" />
                        </div>
                      )}
                      {isPrivate && !isPremium && (
                        <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center border border-[#0a0a0f]">
                          <Lock size={8} className="text-white" />
                        </div>
                      )}
                    </div>
                    
                    {/* Счётчик непрочитанных */}
                    {hasUnread && (
                      <div className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-nexo-500 flex items-center justify-center border border-[#0a0a0f] shadow-lg">
                        <span className="text-[9px] font-bold text-white">
                          {channel.unreadCount! > 99 ? '99+' : channel.unreadCount}
                        </span>
                      </div>
                    )}
                  </button>
                  
                  {/* Кнопка информации (показывается при hover) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenProfile(channel.id);
                    }}
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-nexo-500 hover:bg-nexo-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg border border-[#0a0a0f]"
                    title="Информация о канале"
                  >
                    <Info size={10} className="text-white" />
                  </button>
                </div>
                
                <span className="text-[10px] text-zinc-400 truncate w-14 text-center">
                  {(channel.name || channel.username || 'Канал').split(' ')[0]}
                </span>
                
                {/* Tooltip при hover */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 rounded-lg bg-zinc-800 border border-white/10 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-xl">
                  {channel.name || channel.username}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Модал поиска каналов */}
      <AnimatePresence>
        {showSearch && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setShowSearch(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[480px] sm:max-w-[calc(100%-24px)] sm:h-auto sm:max-h-[600px] bg-surface-secondary/95 backdrop-blur-3xl shadow-2xl border-0 sm:border sm:border-white/5 rounded-none sm:rounded-[2rem] z-50 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <h2 className="text-lg font-bold text-white">Найти каналы</h2>
                <button
                  onClick={() => setShowSearch(false)}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Поиск */}
              <div className="p-4 border-b border-white/5">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Название или @username канала"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 glass-input focus:ring-1 focus:ring-nexo-500/30 transition-all"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-nexo-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {/* Результаты */}
              <div className="flex-1 overflow-y-auto">
                {searchQuery.trim() === '' ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-3">
                    <div className="w-16 h-16 rounded-full glass-subtle flex items-center justify-center">
                      <Search size={24} className="opacity-50" />
                    </div>
                    <p className="text-sm">Введите название или @username канала</p>
                  </div>
                ) : searchResults.length === 0 && !isSearching ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-3">
                    <div className="w-16 h-16 rounded-full glass-subtle flex items-center justify-center">
                      <Search size={24} className="opacity-50" />
                    </div>
                    <p className="text-sm">Каналы не найдены</p>
                  </div>
                ) : (
                  <div className="py-2">
                    {searchResults.map((channel) => {
                      const isJoined = channels.some(c => c.id === channel.id);
                      const isPremium = channel.subscriptionPrice && channel.subscriptionPrice > 0;
                      const subscriberCount = channel.members?.length || 0;
                      
                      return (
                        <motion.button
                          key={channel.id}
                          onClick={() => isJoined ? handleChannelClick(channel.id) : handleJoinChannel(channel)}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 transition-colors"
                        >
                          <div className="relative flex-shrink-0">
                            <Avatar
                              src={channel.avatar}
                              name={channel.name || channel.username || 'C'}
                              size="md"
                              isVerified={channel.isVerified}
                              verifiedBadgeUrl={channel.verifiedBadgeUrl}
                              verifiedBadgeType={channel.verifiedBadgeType}
                            />
                            {isPremium && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center border-2 border-surface-secondary">
                                <Crown size={10} className="text-white" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{channel.name}</p>
                              {channel.isVerified && (
                                <span className="flex-shrink-0 inline-flex items-center justify-center">
                                  <VerifiedBadge
                                    size="sm"
                                    verifiedBadgeUrl={channel.verifiedBadgeUrl}
                                    verifiedBadgeType={channel.verifiedBadgeType}
                                  />
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-zinc-500">@{channel.username}</p>
                              <span className="text-xs text-zinc-600">•</span>
                              <div className="flex items-center gap-1 text-xs text-zinc-500">
                                <Users size={10} />
                                {subscriberCount}
                              </div>
                            </div>
                            {channel.description && (
                              <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{channel.description}</p>
                            )}
                          </div>
                          
                          {isJoined ? (
                            <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-nexo-500/20 text-nexo-400 text-xs font-medium flex-shrink-0">
                              <Check size={12} />
                              Подписан
                            </div>
                          ) : (
                            <div className="px-3 py-1.5 rounded-lg bg-nexo-500 hover:bg-nexo-600 text-white text-xs font-medium transition-colors flex-shrink-0">
                              Подписаться
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Профиль канала */}
      <AnimatePresence>
        {selectedChannelId && (
          <ChannelProfile
            channelId={selectedChannelId}
            onClose={() => setSelectedChannelId(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
