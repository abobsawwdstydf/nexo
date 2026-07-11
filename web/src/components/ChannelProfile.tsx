import { useState, useEffect } from 'react';
import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Link as LinkIcon, Copy, BarChart3, Calendar } from 'lucide-react';
import { api } from '../lib/api';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import Avatar from './Avatar';
import { useToastStore } from '../stores/toastStore';

interface ChannelProfileProps {
  channelId: string;
  onClose: () => void;
}

export default function ChannelProfile({ channelId, onClose }: ChannelProfileProps) {
  const { updateChat } = useChatStore();
  const { user } = useAuthStore();
  const { success, error: showError } = useToastStore();
  const [channel, setChannel] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [channelId]);

  const loadData = async () => {
    if (!channelId) {
      console.error('ChannelProfile: channelId is required');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const chat = await api.getChat(channelId);
      
      if (!chat) {
        console.error('ChannelProfile: chat not found');
        setIsLoading(false);
        return;
      }
      
      setChannel(chat);
      
      // Try to load analytics (only for admins)
      try {
        const data = await api.getChannelAnalytics(channelId);
        setAnalytics(data);
      } catch (e) {
        // Analytics only for admins - это нормально
        console.log('Analytics not available (not admin or error)');
      }
    } catch (e) {
      console.error('Failed to load channel:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (channel?.username) {
      const link = `${window.location.origin}/?channel=${channel.username}`;
      navigator.clipboard.writeText(link);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatarUploading(true);
      const updatedChat = await api.uploadGroupAvatar(channelId, file);
      setChannel(updatedChat);
      updateChat(updatedChat);
    } catch (e) {
      console.error(e);
      showError('Ошибка загрузки аватара');
    } finally {
      setAvatarUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const isAdmin = channel?.members?.some((m: any) => m.user.id === user?.id && m.role === 'admin');

  if (isLoading) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          className="fixed right-3 top-3 bottom-3 w-[380px] max-w-[calc(100%-24px)] bg-surface-secondary/90 backdrop-blur-3xl shadow-2xl border border-white/5 rounded-[2rem] z-50 flex items-center justify-center"
        >
          <div className="w-8 h-8 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
        </motion.div>
      </>
    );
  }

  if (!channel) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          className="fixed inset-0 sm:inset-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[380px] sm:max-w-[calc(100%-24px)] bg-surface-secondary/90 backdrop-blur-3xl shadow-2xl border-0 sm:border sm:border-white/5 rounded-none sm:rounded-[2rem] z-50 flex flex-col items-center justify-center p-6"
        >
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <X size={32} className="text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Канал не найден</h3>
            <p className="text-sm text-zinc-400 mb-6">Возможно, канал был удалён или у вас нет доступа</p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-colors"
            >
              Закрыть
            </button>
          </div>
        </motion.div>
      </>
    );
  }

  const initials = (channel.name || channel.username || 'C')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const subscriberCount = channel.members?.length || 0;
  const isAdminViewer = isAdmin;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 50 }}
        className="fixed inset-0 sm:inset-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[380px] sm:max-w-[calc(100%-24px)] bg-surface-secondary/90 backdrop-blur-3xl shadow-2xl border-0 sm:border sm:border-white/5 rounded-none sm:rounded-[2rem] z-50 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-lg font-bold text-white">Информация о канале</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Avatar and Name */}
          <div className="flex flex-col items-center py-8 px-6">
            <div className="relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-nexo-500/20 rounded-full blur-[40px] pointer-events-none" />
              <div className="relative z-10 p-1.5 rounded-full bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/10 shadow-2xl group">
                {channel.avatar ? (
                    <img src={channel.avatar} alt="" className="w-32 h-32 rounded-full object-cover shadow-inner" />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center text-white font-bold text-4xl shadow-inner">
                    {initials}
                  </div>
                )}
                
                {/* Avatar upload button for admins */}
                {isAdmin && (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarUploading}
                      className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity disabled:cursor-not-allowed"
                    >
                      {avatarUploading ? (
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                          </svg>
                          <span className="text-xs text-white font-medium">Изменить</span>
                        </div>
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </>
                )}
              </div>
            </div>

            <h3 className="mt-5 text-2xl font-bold text-white text-center">{channel.name}</h3>
            {channel.username && (
              <p className="text-sm text-zinc-400 mt-1">@{channel.username}</p>
            )}
            {channel.description && (
              <p className="text-sm text-zinc-300 mt-4 text-center px-4">{channel.description}</p>
            )}
          </div>

          {/* Stats */}
          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-tertiary/50 border border-border">
              <div className="w-10 h-10 rounded-lg bg-nexo-500/20 flex items-center justify-center flex-shrink-0">
                <Users size={18} className="text-nexo-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Подписчики</p>
                <p className="text-xs text-zinc-500">{subscriberCount} человек</p>
              </div>
            </div>

            {isAdminViewer && analytics && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-tertiary/50 border border-border">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <BarChart3 size={18} className="text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Просмотры</p>
                  <p className="text-xs text-zinc-500">{analytics.totalViews || 0} всего</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-tertiary/50 border border-border">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Calendar size={18} className="text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Создан</p>
                <p className="text-xs text-zinc-500">
                  {new Date(channel.createdAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {/* Channel Link */}
            {channel.username && (
              <div className="p-3 rounded-xl bg-surface-tertiary/50 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <LinkIcon size={16} className="text-nexo-400" />
                    <span className="text-sm font-medium text-white">Ссылка на канал</span>
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
                  >
                    {isCopied ? <Copy size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-secondary border border-border">
                  <span className="text-xs text-zinc-300 truncate flex-1">
                    {window.location.origin}/?channel={channel.username}
                  </span>
                </div>
                {isCopied && (
                  <p className="text-xs text-emerald-400 mt-1">Ссылка скопирована!</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Admin Actions */}
        {isAdmin && (
          <div className="p-4 border-t border-white/5">
            <button
              onClick={() => {
                onClose();
                // Open ChannelStudio by dispatching custom event
                const event = new CustomEvent('open-channel-studio', { detail: { channelId } });
                window.dispatchEvent(event);
              }}
              className="w-full py-3 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              <BarChart3 size={18} />
              Управление каналом
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}
