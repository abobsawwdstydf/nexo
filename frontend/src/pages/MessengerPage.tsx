import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import type { Chat } from '../lib/types';
import { ChatList } from '../components/ChatList';
import { MessageArea } from '../components/MessageArea';

const FONT = "'Inter', system-ui, -apple-system, sans-serif";

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

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleSelectChat = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    setMobileView('chat');
  }, []);

  const handleBackToList = useCallback(() => {
    setMobileView('list');
  }, []);

  // ─── Filter chats by search ──────────────────────────────────────────
  const filteredChats = searchQuery
    ? chats.filter(chat =>
        chat.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : chats;

  const selectedChat = chats.find(c => c.id === selectedChatId) || null;

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div
      className="h-full w-full flex flex-col relative"
      style={{ fontFamily: FONT }}
    >
      <MessengerBackground />

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
          <ChatList
            chats={filteredChats}
            selectedChatId={selectedChatId}
            onSelectChat={handleSelectChat}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            loading={loading}
            user={user}
            onLogout={logout}
          />
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
          {selectedChat ? (
            <MessageArea
              chat={selectedChat}
              onBack={handleBackToList}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
