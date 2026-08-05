import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { useInitStore } from '../stores/initStore';
import { api } from '../lib/api';
import type { Chat, Message, UserBasic } from '../lib/types';
import { enrichChat } from '../lib/enrichChat';
import { ChatList } from '../components/ChatList';
import { MessageArea } from '../components/MessageArea';
import FriendsPanel from '../components/FriendsPanel';
import NewChatModal from '../components/NewChatModal';
import UserProfileModal from '../components/UserProfileModal';
import SettingsModal from '../components/SettingsModal';
import AccountManager from '../components/AccountManager';
import { toast } from '../lib/toast';
import { Confetti } from '../components/Confetti';
import { CallOverlay } from '../components/CallOverlay';
import { useCallContext } from '../lib/callContext';
import { getSocket } from '../lib/socket';
import { getNotesMessages, NOTES_CHAT_ID, NOTES_CHANGED_EVENT } from '../lib/api/noteChat';
import { getAIMessages, AI_CHAT_ID, AI_CHANGED_EVENT } from '../lib/api/aiChat';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { playNotification } from '../lib/sounds';

const FONT = "'Onest', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

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

export default function MessengerPage({ onInfoClick }: { onInfoClick?: () => void }) {
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
  const [createTab, setCreateTab] = useState<null | 'personal' | 'group' | 'channel'>(null);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [firstLoad, setFirstLoad] = useState(true);

  // Saved Messages virtual chat — memoized so it is not recreated (and notes are
  // not re-read from localStorage) on every render. Refreshes on notes changes.
  const [notesVersion, setNotesVersion] = useState(0);
  useEffect(() => {
    const handler = () => setNotesVersion(v => v + 1);
    window.addEventListener(NOTES_CHANGED_EVENT, handler);
    return () => window.removeEventListener(NOTES_CHANGED_EVENT, handler);
  }, []);

  const savedMessagesChat = useMemo<Chat>(() => ({
    id: NOTES_CHAT_ID,
    type: 'personal',
    name: 'Избранное',
    username: null,
    avatar: null,
    description: 'Ваши заметки и сохранённые сообщения',
    createdAt: new Date().toISOString(),
    members: [],
    messages: getNotesMessages(),
    unreadCount: 0,
  }), [notesVersion]);

  // Нексо AI virtual chat — memoized, refreshes on AI history changes.
  const [aiVersion, setAiVersion] = useState(0);
  useEffect(() => {
    const handler = () => setAiVersion(v => v + 1);
    window.addEventListener(AI_CHANGED_EVENT, handler);
    return () => window.removeEventListener(AI_CHANGED_EVENT, handler);
  }, []);

  const aiChat = useMemo<Chat>(() => ({
    id: AI_CHAT_ID,
    type: 'personal',
    name: 'Нексо AI',
    username: 'nexo_ai',
    avatar: null,
    description: 'Умный ИИ-ассистент — отвечает на любые вопросы',
    createdAt: new Date().toISOString(),
    members: [],
    messages: getAIMessages(),
    unreadCount: 0,
  }), [aiVersion]);

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
      const t = setTimeout(() => setConfettiTrigger(t => t + 1), 500);
      return () => clearTimeout(t);
    }
  }, [loading, chats.length, firstLoad]);

  // Socket listener for incoming messages → toast notification.
  // Registered once on mount; reads latest chat state via refs so the
  // listener is never re-registered (previously leaked a handler per re-render).
  const selectedChatIdRef = useRef(selectedChatId);
  selectedChatIdRef.current = selectedChatId;
  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket?.connected) return;

    const onMessage = (msg: Message) => {
      // Show toast only if this chat is NOT currently selected
      if (msg.chatId !== selectedChatIdRef.current) {
        const chat = chatsRef.current.find(c => c.id === msg.chatId);
        const name = chat?.name || msg.sender?.displayName || msg.sender?.username || 'Новое сообщение';
        toast.info(`✉️ ${name}`, msg.content || '');
        // Deep Nexo notification thump
        playNotification();
      }
      // Trigger confetti on first received message only (one-time celebration)
      if (!confettiFiredRef.current) {
        confettiFiredRef.current = true;
        setConfettiTrigger(t => t + 1);
      }
    };

    socket.on('message:new', onMessage);
    return () => {
      socket.off('message:new', onMessage);
    };
  }, []);

  // ─── Incoming calls (WebRTC signalling via WS) ────────────────────────
  const [incomingCall, setIncomingCall] = useState<{
    offer: RTCSessionDescriptionInit;
    from: UserBasic;
    chatId: string;
    callType: 'voice' | 'video';
  } | null>(null);
  const callContextRef = useRef(callContext);
  callContextRef.current = callContext;
  const incomingCallRef = useRef(incomingCall);
  incomingCallRef.current = incomingCall;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onCallOffer = (data: any) => {
      // Busy — already in a call or an incoming call is being presented
      if (callContextRef.current.activeCall || incomingCallRef.current) return;
      if (!data.offer || !data.from) return;
      setIncomingCall({
        offer: data.offer,
        from: data.from,
        chatId: data.chatId || '',
        callType: data.callType === 'video' ? 'video' : 'voice',
      });
    };

    socket.on('call:offer', onCallOffer);
    return () => {
      socket.off('call:offer', onCallOffer);
    };
  }, []);

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
  const handleOpenNewChat = useCallback(() => setCreateTab('personal'), []);
  const handleOpenAccountManager = useCallback(() => setShowAccountManager(true), []);
  const handleOpenFeedback = useCallback(() => {
    if (!user) return;
    api.getOrCreateFeedbackChat()
      .then(chat => {
        useInitStore.getState().addChat(enrichChat(chat, user));
        setSelectedChatId(chat.id);
        setMobileView('chat');
        setShowFriends(false);
      })
      .catch(err => {
        console.error('Failed to open feedback chat:', err);
      });
  }, [user]);
  const handleChatCreated = useCallback((chat: Chat | null) => {
    if (chat && user) {
      useInitStore.getState().addChat(enrichChat(chat, user));
      setSelectedChatId(chat.id);
      setMobileView('chat');
    }
    // Refresh init — re-fetch from /init
    useAuthStore.getState().checkAuth();
  }, [user]);

  const handleFriendsChat = useCallback((userId: string) => {
    if (!user) return;
    setShowFriends(false);
    // Try to find existing personal chat
    const existing = chats.find(c => c.type === 'personal' && c.otherMember?.id === userId);
    if (existing) {
      setSelectedChatId(existing.id);
      setMobileView('chat');
    } else {
      // Create new chat
      api.createPersonalChat(userId).then(chat => {
        useInitStore.getState().addChat(enrichChat(chat, user));
        setSelectedChatId(chat.id);
        setMobileView('chat');
      }).catch(console.error);
    }
  }, [chats, user]);

  // ─── Filter chats by search ──────────────────────────────────────────
  const allChats = [savedMessagesChat, aiChat, ...chats];
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
      <div className="relative z-10 flex-1 flex p-2 h-full overflow-hidden">
        <div className="flex-1 flex overflow-hidden rounded-[26px] border border-white/[0.08] liquid-glass-strong shadow-[0_0_60px_rgba(0,0,0,0.45)]">
        {/* ─── Chat List Sidebar ────────────────────────────────────── */}
        <div
          className={`
            w-full md:w-[360px] md:min-w-[320px] flex-shrink-0
            ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}
            flex-col overflow-hidden border-r border-white/[0.06]
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
              onOpenAccountManager={handleOpenAccountManager}
              onOpenFeedback={handleOpenFeedback}
            />
          )}
        </div>

        {/* ─── Message Area ────────────────────────────────────────── */}
        <div
          className={`
            flex-1 min-w-0
            ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
            flex-col overflow-hidden
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
      </div>

      {/* ─── Mobile bottom nav (TG 2026) ───────────────────────────── */}
      {mobileView === 'list' && !showProfile && !showSettings && !createTab && !showAccountManager && (
        <MobileBottomNav
          active={showFriends ? 'friends' : 'chats'}
          onChats={() => { setShowFriends(false); setMobileView('list'); }}
          onFriends={() => { setShowFriends(true); setMobileView('list'); }}
          onSettings={() => handleOpenSettings('general')}
          onProfile={handleOpenProfile}
        />
      )}

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
            onInfoClick={onInfoClick}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {createTab && (
          <NewChatModal
            initialTab={createTab}
            onClose={() => setCreateTab(null)}
            onChatCreated={handleChatCreated}
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

      {/* ═══ Call overlay (outgoing + incoming) ═══ */}
      <CallOverlay
        open={callContext.activeCall || !!incomingCall}
        type={incomingCall ? incomingCall.callType : callContext.callType}
        target={incomingCall ? incomingCall.from : callContext.callTarget}
        chatId={incomingCall ? incomingCall.chatId : callContext.callChatId}
        incoming={!!incomingCall}
        initialOffer={incomingCall?.offer ?? null}
        onClose={() => {
          callContext.endCall();
          setIncomingCall(null);
        }}
        onIncomingRejected={() => setIncomingCall(null)}
      />

    </div>
  );
}
