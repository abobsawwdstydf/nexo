import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from 'iconsax-react';
import { useAuthStore } from '../stores/authStore';
import { useInitStore } from '../stores/initStore';
import { api } from '../lib/api';
import type { Chat, Message } from '../lib/types';
import { ChatList } from '../components/ChatList';
import { MessageArea } from '../components/MessageArea';
import FriendsPanel from '../components/FriendsPanel';
import CreateChannelModal from '../components/CreateChannelModal';
import NewChatModal from '../components/NewChatModal';
import UserProfileModal from '../components/UserProfileModal';
import SettingsModal from '../components/SettingsModal';
import AccountManager from '../components/AccountManager';
import { toast } from '../lib/toast';
import { Confetti } from '../components/Confetti';
import { CallOverlay } from '../components/CallOverlay';
import { useCallContext } from '../lib/callContext';
import { getNotesMessages, NOTES_CHAT_ID } from '../lib/api/noteChat';

const FONT = "'JF Dot Shinonome Gothic 14', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function MessengerBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Ambient blobs */}
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.04, 0.08, 0.04] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[10%] -left-[10%] w-[500px] h-[500px] rounded-full bg-white blur-[140px]"
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.03, 0.06, 0.03] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        className="absolute bottom-[20%] -right-[5%] w-[400px] h-[400px] rounded-full bg-zinc-400 blur-[120px]"
      />
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.02, 0.05, 0.02] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        className="absolute top-[40%] left-[40%] w-[350px] h-[350px] rounded-full bg-zinc-500 blur-[100px]"
      />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.012]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}

export default function MessengerPage() {
  const { user, logout } = useAuthStore();
  const { chats: initChats, loaded: initLoaded } = useInitStore();
  const callContext = useCallContext();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string>('general');
  const [showFriends, setShowFriends] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [firstLoad, setFirstLoad] = useState(true);

  // Saved Messages virtual chat
  const savedMessagesChat: Chat = {
    id: '_saved_messages_',
    type: 'personal',
    name: 'Избранное',
    username: null,
    avatar: null,
    description: 'Ваши заметки и сохранённые сообщения',
    createdAt: new Date().toISOString(),
    members: [],
    messages: getNotesMessages(),
    unreadCount: 0,
  };

  // ─── Chats from initStore (no extra HTTP call) ──────────────────────
  useEffect(() => {
    if (initLoaded) {
      setChats(initChats);
      setLoading(false);
      if (initChats.length > 0 && !selectedChatId) {
        setSelectedChatId(initChats[0].id);
      }
    }
  }, [initLoaded, initChats, selectedChatId]);

  // Confetti on first load — celebrate having chats!
  useEffect(() => {
    if (!loading && chats.length > 0 && firstLoad) {
      setFirstLoad(false);
      setTimeout(() => setConfettiTrigger(t => t + 1), 500);
    }
  }, [loading, chats.length, firstLoad]);

  // Socket listener for incoming messages → toast notification
  useEffect(() => {
    let cancelled = false;
    async function initSocket() {
      try {
        const { getSocket } = await import('../lib/socket');
        const socket = getSocket();
        if (!socket?.connected) return;

        socket.on('message:new', (msg: Message) => {
          if (cancelled) return;
          // Show toast only if this chat is NOT currently selected
          if (msg.chatId !== selectedChatId) {
            const chat = chats.find(c => c.id === msg.chatId);
            const name = chat?.name || msg.sender.displayName || msg.sender.username || 'Новое сообщение';
            toast.info(`✉️ ${name}`, msg.content || '');
          }
          // Trigger confetti on first received message
          setConfettiTrigger(t => t + 1);
        });
      } catch {}
    }
    initSocket();
    return () => { cancelled = true; };
  }, [selectedChatId, chats]);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleSelectChat = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    setMobileView('chat');
  }, []);

  const handleBackToList = useCallback(() => {
    setMobileView('list');
  }, []);

  // ─── Handlers for modals ──────────────────────────────────────────────
  const handleOpenProfile = useCallback(() => setShowProfile(true), []);
  const handleOpenSettings = useCallback((tab?: string) => {
    if (tab) setSettingsTab(tab);
    setShowSettings(true);
  }, []);

  const handleOpenFriends = useCallback(() => setShowFriends(true), []);
  const handleOpenNewChat = useCallback(() => setShowNewChat(true), []);
  const handleOpenNewChannel = useCallback(() => setShowNewChannel(true), []);
  const handleOpenAccountManager = useCallback(() => setShowAccountManager(true), []);
  const handleChatCreated = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    setMobileView('chat');
    // Refresh init — re-fetch from /init
    useAuthStore.getState().checkAuth();
  }, []);
  const handleChannelCreated = useCallback(() => {
    useAuthStore.getState().checkAuth();
  }, []);

  const handleFriendsChat = useCallback((userId: string) => {
    setShowFriends(false);
    // Try to find existing personal chat
    const existing = chats.find(c => c.type === 'personal' && c.otherMember?.id === userId);
    if (existing) {
      setSelectedChatId(existing.id);
      setMobileView('chat');
    } else {
      // Create new chat
      api.createPersonalChat(userId).then(chat => {
        useInitStore.getState().addChat(chat);
        setSelectedChatId(chat.id);
        setMobileView('chat');
      }).catch(console.error);
    }
  }, [chats]);

  // ─── Filter chats by search ──────────────────────────────────────────
  const allChats = [savedMessagesChat, ...chats];
  const filteredChats = searchQuery
    ? allChats.filter(chat =>
        chat.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allChats;

  const selectedChat = allChats.find(c => c.id === selectedChatId) || null;

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div
      className="h-full w-full flex flex-col relative font-pixel"
      style={{ fontFamily: FONT }}
    >
      <MessengerBackground />
      <Confetti trigger={confettiTrigger} />

      {/* Main layout */}
      <div className="relative z-10 flex-1 flex gap-3 p-3 h-full overflow-hidden">
        {/* ─── Chat List Sidebar ────────────────────────────────────── */}
        <div
          className={`
            w-full md:w-[360px] md:min-w-[320px] flex-shrink-0
            ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}
            flex-col rounded-2xl md:overflow-hidden overflow-visible
            liquid-glass-strong
          `}
        >
          {showFriends ? (
            <FriendsPanel
              onClose={() => setShowFriends(false)}
              onStartChat={handleFriendsChat}
            />
          ) : (
            <ChatList
              chats={filteredChats}
              selectedChatId={selectedChatId}
              onSelectChat={handleSelectChat}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              loading={loading}
              user={user}
              onLogout={logout}
              onOpenProfile={handleOpenProfile}
              onOpenSettings={() => handleOpenSettings('general')}
              onOpenFriends={handleOpenFriends}
              onNewChat={handleOpenNewChat}
              onNewChannel={handleOpenNewChannel}
              onOpenAccountManager={handleOpenAccountManager}
            />
          )}
        </div>

        {/* ─── Message Area ────────────────────────────────────────── */}
        <div
          className={`
            flex-1 min-w-0
            ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
            flex-col rounded-2xl overflow-hidden
            liquid-glass
          `}
        >
          <AnimatePresence mode="wait">
            {selectedChat ? (
              <motion.div
                key={selectedChat.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <MessageArea
                  chat={selectedChat}
                  onBack={handleBackToList}
                />
              </motion.div>
            ) : (
              <motion.div
                key="_empty_"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex items-center justify-center"
              >
              <div className="text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-white/40" style={{ letterSpacing: '0.02em' }}>
                    Выберите чат
                  </h2>
                  <p className="text-sm text-white/20 mt-2">
                    Начните общение с друзьями
                  </p>
                </motion.div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>

      {/* ═══ Modals ═══ */}
      <AnimatePresence>
        {showProfile && user && (
          <UserProfileModal
            user={user}
            onClose={() => setShowProfile(false)}
            onOpenSettings={handleOpenSettings}
            onLogout={logout}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && user && (
          <SettingsModal
            user={user}
            initialTab={settingsTab}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNewChat && (
          <NewChatModal
            onClose={() => setShowNewChat(false)}
            onChatCreated={handleChatCreated}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNewChannel && (
          <CreateChannelModal
            onClose={() => setShowNewChannel(false)}
            onCreated={handleChannelCreated}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAccountManager && (
          <AccountManager
            onClose={() => setShowAccountManager(false)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
