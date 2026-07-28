import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Bookmark,
  Send,
  Trash2,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import type { Chat, Message } from '../lib/types';
import { ChatList } from '../components/ChatList';
import { MessageArea } from '../components/MessageArea';
import FriendsPanel from '../components/FriendsPanel';
import CreateChannelModal from '../components/CreateChannelModal';
import NewChatModal from '../components/NewChatModal';
import UserProfileModal from '../components/UserProfileModal';
import SettingsModal from '../components/SettingsModal';
import { toast } from '../lib/toast';
import { Confetti } from '../components/Confetti';

const FONT = "'Koganejidainogemu', 'PreschoolPlayhouse', 'Caveat', cursive";

interface SavedNote {
  id: string;
  text: string;
  createdAt: string;
}

const SAVED_KEY = 'nexo_saved_notes';

function loadNotes(): SavedNote[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveNotes(notes: SavedNote[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(notes));
}

function SavedMessagesView({ onBack }: { onBack: () => void }) {
  const [notes, setNotes] = useState<SavedNote[]>(loadNotes);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveNotes(notes);
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [notes]);

  const addNote = () => {
    const t = input.trim();
    if (!t) return;
    const note: SavedNote = {
      id: `note_${Date.now()}`,
      text: t,
      createdAt: new Date().toLocaleString('ru-RU'),
    };
    setNotes(prev => [...prev, note]);
    setInput('');
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <motion.button
            onClick={onBack}
            className="md:hidden p-2 -ml-1 rounded-xl hover:bg-white/[0.06] transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft size={18} className="text-white/50" />
          </motion.button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
            <Bookmark size={15} className="text-amber-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Избранное</h2>
        </div>
        {notes.length > 0 && (
          <motion.button
            onClick={() => setNotes([])}
            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors text-red-400/50 hover:text-red-400"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Очистить всё"
          >
            <Trash2 size={15} />
          </motion.button>
        )}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
              <Bookmark size={22} className="text-amber-400/50" />
            </div>
            <h3 className="text-sm font-medium text-white/50">Ваше Избранное</h3>
            <p className="text-xs text-white/30 mt-1.5 max-w-[200px] leading-relaxed">
              Сохраняйте сюда заметки, ссылки и важные сообщения
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="group relative p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors"
              >
                <p className="text-sm text-white/80 pr-6 leading-relaxed whitespace-pre-wrap break-words">
                  {note.text}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-white/20">{note.createdAt}</span>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-white/[0.08] transition-all text-red-400/50 hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="flex-shrink-0 px-3 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); } }}
            placeholder="Написать заметку..."
            className="flex-1 h-10 px-4 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/80 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06]"
          />
          <motion.button
            onClick={addNote}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 transition-colors flex-shrink-0"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={!input.trim()}
            style={{ opacity: input.trim() ? 1 : 0.4 }}
          >
            <Send size={16} className="text-white/60" />
          </motion.button>
        </div>
      </div>
    </>
  );
}

function Tip({ icon: Icon, text }: { icon: typeof Bookmark; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="text-white/20 mt-0.5 flex-shrink-0" />
      <span className="text-xs text-white/30 leading-relaxed">{text}</span>
    </div>
  );
}

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
    messages: [],
    unreadCount: 0,
  };

  // ─── Fetch chats ──────────────────────────────────────────────────────
  const fetchChats = useCallback(async () => {
    try {
      const data = await api.getChats();
      const chatArray: Chat[] = Array.isArray(data) ? data : ((data as any)?.chats ?? []);
      setChats(chatArray);
      // Auto-select first chat if none selected
      if (chatArray.length > 0 && !selectedChatId) {
        setSelectedChatId(chatArray[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch chats:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedChatId]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

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

        socket.on('new_message', (msg: Message) => {
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
  const handleChatCreated = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    setMobileView('chat');
    fetchChats();
  }, [fetchChats]);
  const handleChannelCreated = useCallback(() => {
    fetchChats();
  }, [fetchChats]);

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
        setSelectedChatId(chat.id);
        setMobileView('chat');
        fetchChats();
      }).catch(console.error);
    }
  }, [chats, fetchChats]);

  // ─── Filter chats by search ──────────────────────────────────────────
  const allChats = [savedMessagesChat, ...chats];
  const filteredChats = searchQuery
    ? allChats.filter(chat =>
        chat.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allChats;

  const selectedChat = allChats.find(c => c.id === selectedChatId) || null;
  const isSavedMessages = selectedChat?.id === '_saved_messages_';

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div
      className="h-full w-full flex flex-col relative"
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
            flex-col rounded-2xl overflow-hidden
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
            {isSavedMessages ? (
              <motion.div
                key="_saved_"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <SavedMessagesView onBack={handleBackToList} />
              </motion.div>
            ) : selectedChat ? (
              <motion.div
                key={selectedChat.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
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
    </div>
  );
}
