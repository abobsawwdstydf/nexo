import { useState, useEffect, useRef } from 'react';
import type React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Users, Megaphone, Search, Check, UserPlus, Loader2, Sparkles, Hash, Globe, Camera } from 'lucide-react';
import { ClearInput, type ClearInputHandle } from './ClearInput';
import { api } from '../lib/api';
import { useChatStore } from '../stores/chatStore';
import { useLang } from '../lib/i18n';
import type { UserPresence } from '../lib/types';
import Avatar from './Avatar';

interface NewChatModalProps {
  onClose: () => void;
}

type Mode = 'personal' | 'group' | 'channel';

export default function NewChatModal({ onClose }: NewChatModalProps) {
  const { addChat, setActiveChat, loadMessages } = useChatStore();
  const { t } = useLang();
  const [mode, setMode] = useState<Mode>('personal');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [channelSearchResults, setChannelSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [channelUsername, setChannelUsername] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const inputRef = useRef<ClearInputHandle>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setUsers([]);
      setChannelSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const [userResults, channelResults] = await Promise.all([
          api.searchUsers(query),
          api.searchChannels(query).catch(() => []),
        ]);
        setUsers(userResults.filter(u => !selectedUsers.has(u.id)));
        setChannelSearchResults(channelResults || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selectedUsers]);

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSelectUser = async (selectedUser: UserPresence) => {
    try {
      const chat = await api.createPersonalChat(selectedUser.id);
      addChat(chat);
      setActiveChat(chat.id);
      loadMessages(chat.id);
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const memberIds = Array.from(selectedUsers);
      const chat = await api.createGroupChat(groupName.trim(), memberIds);
      // Upload avatar if selected
      if (avatarFile && chat.id) {
        try {
          const formData = new FormData();
          formData.append('avatar', avatarFile);
          await fetch(`/api/chats/${chat.id}/avatar`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });
        } catch (e) {
          console.error('Avatar upload error:', e);
        }
      }
      addChat(chat);
      setActiveChat(chat.id);
      loadMessages(chat.id);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateChannel = async () => {
    if (!groupName.trim() || !channelUsername.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const chat = await api.createChannel(
        groupName.trim(),
        channelUsername.trim(),
        channelDescription.trim() || undefined
      );
      // Upload avatar if selected
      if (avatarFile && chat.id) {
        try {
          const formData = new FormData();
          formData.append('avatar', avatarFile);
          await fetch(`/api/chats/${chat.id}/avatar`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });
        } catch (e) {
          console.error('Avatar upload error:', e);
        }
      }
      addChat(chat);
      setActiveChat(chat.id);
      loadMessages(chat.id);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const modes: { key: Mode; icon: typeof MessageSquare; label: string; desc: string }[] = [
    { key: 'personal', icon: MessageSquare, label: 'Личный чат', desc: 'Напишите сообщение другу' },
    { key: 'group', icon: Users, label: 'Группа', desc: 'Создайте групповой чат' },
    { key: 'channel', icon: Megaphone, label: 'Канал', desc: 'Создайте публичный канал' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      onTouchEnd={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 100, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full sm:max-w-xl overflow-hidden relative sm:m-4 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-t-[32px] sm:rounded-3xl backdrop-blur-2xl"
        style={{ background: 'rgba(17,17,17,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Grabber handle - mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: '#2B2B2F' }}>
                {(() => {
                  const ModeIcon = modes.find(m => m.key === mode)!.icon;
                  return <ModeIcon size={18} className="text-white" />;
                })()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Новый чат</h2>
                <p className="text-xs text-zinc-400">Выберите тип общения</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl text-zinc-400 hover:text-white flex items-center justify-center"
              style={{ background: '#2B2B2F' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="p-4">
          <div className="flex gap-2 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {modes.map(m => (
              <button
                key={m.key}
                onClick={() => { setMode(m.key); setQuery(''); setUsers([]); setSelectedUsers(new Set()); setIsAnimating(true); setTimeout(() => setIsAnimating(false), 300); }}
                className={`flex-1 py-3 px-3 rounded-xl text-xs font-medium transition-all duration-300 flex flex-col items-center gap-1.5 ${
                  mode === m.key
                    ? 'text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
                style={mode === m.key ? { background: '#845EF7', border: '1px solid rgba(132,94,247,0.5)' } : { background: '#2A2A2A', border: '1px solid transparent' }}
              >
                <m.icon size={16} />
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-5 pb-4"
        >
          <p className="text-sm text-zinc-400 text-center">{modes.find(m => m.key === mode)?.desc}</p>
        </motion.div>

        <div className="p-5 max-h-[calc(100vh-200px)] sm:max-h-[50vh] overflow-y-auto relative flex-1">
          <AnimatePresence mode="wait">
          {mode === 'personal' && (
            <motion.div 
              key="personal"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-3"
            >
              {/* Search */}
              <ClearInput
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Поиск по имени или username..."
                className="w-full py-3.5 text-sm text-white placeholder-zinc-500 rounded-2xl outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                leftIcon={<Search size={18} className="text-zinc-500" />}
              />

              {/* Users list */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 size={24} className="text-nexo-400 animate-spin" />
                  <p className="text-sm text-zinc-400">Ищем пользователей...</p>
                </div>
              ) : users.length > 0 || channelSearchResults.length > 0 ? (
                <div className="space-y-1">
                  {users.length > 0 && <p className="text-xs text-zinc-500 px-2 mb-1">Люди: {users.length}</p>}
                  {users.map(user => (
                    <motion.button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left group"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="relative">
                        <Avatar 
                          src={user.avatar} 
                          name={user.displayName || user.username} 
                          size="md"
                          isVerified={user.isVerified}
                          verifiedBadgeUrl={user.verifiedBadgeUrl}
                          verifiedBadgeType={user.verifiedBadgeType}
                        />
                        {user.isOnline && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-surface-secondary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{user.displayName || user.username}</p>
                        <p className="text-xs text-zinc-500">@{user.username}</p>
                      </div>
                      <MessageSquare size={16} className="text-zinc-600 group-hover:text-white transition-colors opacity-0 group-hover:opacity-100" />
                    </motion.button>
                  ))}
                  {channelSearchResults.length > 0 && (
                    <>
                      <p className="text-xs text-zinc-500 px-2 mt-3 mb-1">Каналы: {channelSearchResults.length}</p>
                      {channelSearchResults.map((ch: any) => (
                        <motion.button
                          key={ch.id}
                          onClick={() => { useChatStore.getState().setActiveChat(ch.id); onClose(); }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left group"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          <Avatar src={ch.avatar} name={ch.name || ch.username || 'C'} size="md" isVerified={ch.isVerified} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{ch.name}</p>
                            <p className="text-xs text-zinc-500">@{ch.username} · Канал</p>
                          </div>
                          <Hash size={16} className="text-amber-400 opacity-70" />
                        </motion.button>
                      ))}
                    </>
                  )}
                </div>
              ) : query.length >= 2 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Search size={28} className="text-zinc-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-zinc-400">Никого не найдено</p>
                    <p className="text-xs text-zinc-600 mt-1">Попробуйте другой запрос</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Sparkles size={28} className="text-zinc-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-zinc-400">Начните вводить имя или username</p>
                    <p className="text-xs text-zinc-600 mt-1">Найдите друга для общения</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {mode === 'group' && (
            <motion.div
              key="group"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {/* Avatar picker */}
              <div className="flex justify-center">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-white/20 hover:border-white/40 flex items-center justify-center transition-all group"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={24} className="text-zinc-400 group-hover:text-white transition-colors" />
                    )}
                  </button>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white"
                    >
                      <X size={10} />
                    </button>
                  )}
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>
              </div>

              {/* Group name */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Users size={12} />
                  Название группы
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Моя супер группа"
                  maxLength={50}
                  className="w-full px-4 py-3.5 text-sm text-white placeholder-zinc-500 rounded-2xl outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                />
                {groupName && (
                  <p className="text-xs text-zinc-600 mt-1 text-right">{groupName.length}/50</p>
                )}
              </div>

              {/* Members selection */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <UserPlus size={12} />
                  Участники {selectedUsers.size > 0 && (
                    <span className="bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full text-xs">
                      {selectedUsers.size}
                    </span>
                  )}
                </label>
                <ClearInput
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Поиск участников..."
                  className="w-full py-3.5 text-sm text-white placeholder-zinc-500 rounded-2xl outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                  leftIcon={<Search size={16} className="text-zinc-500" />}
                />

                {/* Selected users */}
                {selectedUsers.size > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {Array.from(selectedUsers).map(id => {
                      const user = users.find(u => u.id === id);
                      if (!user) return null;
                      return (
                        <motion.button
                          key={id}
                          onClick={() => toggleUser(id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all"
                          style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)', color: '#e4e4e7' }}
                        >
                          <Check size={12} />
                          {user.displayName || user.username}
                          <X size={10} className="ml-1 opacity-50 hover:opacity-100" />
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {/* Users list */}
                {users.length > 0 && (
                  <div className="space-y-1 mt-3 max-h-48 overflow-y-auto rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {users.map(user => (
                      <motion.button
                        key={user.id}
                        onClick={() => toggleUser(user.id)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all text-left ${
                          selectedUsers.has(user.id) ? 'border border-white/10' : 'hover:bg-white/5 border border-transparent'
                        }`}
                        style={selectedUsers.has(user.id) ? { background: 'rgba(255,255,255,0.06)' } : undefined}
                      >
                        <div className="relative">
                          <Avatar 
                            src={user.avatar} 
                            name={user.displayName || user.username} 
                            size="sm"
                            isVerified={user.isVerified}
                            verifiedBadgeUrl={user.verifiedBadgeUrl}
                            verifiedBadgeType={user.verifiedBadgeType}
                          />
                          {user.isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-surface-secondary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{user.displayName || user.username}</p>
                          <p className="text-xs text-zinc-500">@{user.username}</p>
                        </div>
                        {selectedUsers.has(user.id) && (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(255,255,255,0.1)' }}
                          >
                            <Check size={12} className="text-white" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>

              {/* Create button */}
              <motion.button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || isCreating}
                whileHover={{ scale: !(!groupName.trim() || isCreating) ? 1.02 : 1 }}
                whileTap={{ scale: !(!groupName.trim() || isCreating) ? 0.98 : 1 }}
                className="w-full py-4 rounded-2xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {isCreating ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <Users size={18} className="group-hover:scale-110 transition-transform" />
                    Создать группу
                  </>
                )}
              </motion.button>
            </motion.div>
          )}

          {mode === 'channel' && (
            <motion.div
              key="channel"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {/* Avatar picker */}
              <div className="flex justify-center">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-white/20 hover:border-white/40 flex items-center justify-center transition-all group"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={24} className="text-zinc-400 group-hover:text-white transition-colors" />
                    )}
                  </button>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              </div>

              {/* Channel name */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Megaphone size={12} />
                  Название канала
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Мой крутой канал"
                  maxLength={50}
                  className="w-full px-4 py-3.5 text-sm text-white placeholder-zinc-500 rounded-2xl outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                />
                {groupName && (
                  <p className="text-xs text-zinc-600 mt-1 text-right">{groupName.length}/50</p>
                )}
              </div>

              {/* Username */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Hash size={12} />
                  Username канала
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">@</span>
                  <input
                    type="text"
                    value={channelUsername}
                    onChange={e => setChannelUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="my_channel"
                    className="w-full pl-8 pr-4 py-3.5 text-sm text-white placeholder-zinc-500 rounded-2xl lowercase outline-none transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1.5 flex items-center gap-1">
                  <Globe size={10} />
                  Только латинские буквы, цифры и _
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <MessageSquare size={12} />
                  Описание <span className="text-zinc-600 font-normal">(необязательно)</span>
                </label>
                <textarea
                  value={channelDescription}
                  onChange={e => setChannelDescription(e.target.value)}
                  placeholder="О чём ваш канал..."
                  maxLength={255}
                  className="w-full px-4 py-3.5 text-sm text-white placeholder-zinc-500 rounded-2xl resize-none h-24 outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                />
                <p className="text-xs text-zinc-600 mt-1 text-right">{channelDescription.length}/255</p>
              </div>

              {/* Preview */}
              {groupName && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <p className="text-xs text-zinc-500 mb-3">Предпросмотр:</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      {groupName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{groupName}</p>
                      {channelUsername && <p className="text-xs text-zinc-500">@{channelUsername}</p>}
                      {channelDescription && <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{channelDescription}</p>}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Create button */}
              <motion.button
                onClick={handleCreateChannel}
                disabled={!groupName.trim() || !channelUsername.trim() || isCreating}
                whileHover={{ scale: !(!groupName.trim() || !channelUsername.trim() || isCreating) ? 1.02 : 1 }}
                whileTap={{ scale: !(!groupName.trim() || !channelUsername.trim() || isCreating) ? 0.98 : 1 }}
                className="w-full py-4 rounded-2xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {isCreating ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <Megaphone size={18} className="group-hover:scale-110 transition-transform" />
                    Создать канал
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
