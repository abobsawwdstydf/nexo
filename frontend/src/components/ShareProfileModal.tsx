import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link2, QrCode, Send, Search, Loader2, Check, Copy, ArrowLeft, Share2 } from 'lucide-react';
import { ClearInput } from './ClearInput';
import { api } from '../lib/api';
import { useToastStore } from '../stores/toastStore';
import QRCodeModal from './QRCodeModal';
import BottomSheet from './BottomSheet';
import type { Chat } from '../lib/types';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

interface ShareProfileModalProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
  };
  onClose: () => void;
}

type Step = 'menu' | 'chats';

export default function ShareProfileModal({ user, onClose }: ShareProfileModalProps) {
  const isMobile = useIsMobile();
  const { success, error: showError } = useToastStore();
  const [step, setStep] = useState<Step>('menu');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const profileUrl = `${window.location.origin}/?user=${user.username}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      success('Ссылка на профиль скопирована');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = profileUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        success('Ссылка на профиль скопирована');
        setTimeout(() => setCopied(false), 1800);
      } catch {
        showError('Не удалось скопировать ссылку');
      }
    }
  };

  const menuContent = (
    <MenuStep
      user={user}
      profileUrl={profileUrl}
      copied={copied}
      onCopy={copyLink}
      onShowQR={() => setShowQR(true)}
      onOpenChats={() => setStep('chats')}
      onClose={onClose}
    />
  );

  const chatsContent = (
    <ChatsStep
      user={user}
      profileUrl={profileUrl}
      onBack={() => setStep('menu')}
      onClose={onClose}
    />
  );

  const currentStep = step === 'menu' ? menuContent : chatsContent;

  if (isMobile) {
    return (
      <>
        <BottomSheet isOpen onClose={onClose} title="Поделиться профилем">
          {currentStep}
        </BottomSheet>

        {showQR && (
          <QRCodeModal
            user={user}
            onClose={() => setShowQR(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-surface-secondary rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {currentStep}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {showQR && (
        <QRCodeModal
          user={user}
          onClose={() => setShowQR(false)}
        />
      )}
    </>
  );
}

function MenuStep({
  user,
  profileUrl,
  copied,
  onCopy,
  onShowQR,
  onOpenChats,
  onClose,
}: {
  user: { username: string; displayName: string; avatar: string | null };
  profileUrl: string;
  copied: boolean;
  onCopy: () => void;
  onShowQR: () => void;
  onOpenChats: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-nexo-500 flex items-center justify-center flex-shrink-0">
            <Share2 size={16} className="text-white" />
          </div>
          <h3 className="text-sm font-semibold text-white truncate">Поделиться профилем</h3>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          aria-label="Закрыть"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-2">
        <button
          onClick={onCopy}
          className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-white/[0.12] transition-all active:scale-[0.98] text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-nexo-500/20 flex items-center justify-center text-nexo-300 flex-shrink-0">
            {copied ? <Check size={18} className="text-emerald-400" /> : <Link2 size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{copied ? 'Скопировано!' : 'Скопировать ссылку'}</p>
            <p className="text-xs text-zinc-500 truncate mt-0.5">{profileUrl}</p>
          </div>
        </button>

        <button
          onClick={onShowQR}
          className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-white/[0.12] transition-all active:scale-[0.98] text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 flex-shrink-0">
            <QrCode size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">QR-код</p>
            <p className="text-xs text-zinc-500 mt-0.5">Покажите код для быстрого перехода</p>
          </div>
        </button>

        <button
          onClick={onOpenChats}
          className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-white/[0.12] transition-all active:scale-[0.98] text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300 flex-shrink-0">
            <Send size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Отправить в чат</p>
            <p className="text-xs text-zinc-500 mt-0.5">Поделиться в личке, группе или канале</p>
          </div>
        </button>
      </div>
    </>
  );
}

function ChatsStep({
  user,
  profileUrl,
  onBack,
  onClose,
}: {
  user: { username: string; displayName: string };
  profileUrl: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const { success, error: showError } = useToastStore();
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await api.getChats();
        if (!cancelled) {
          setChats(data || []);
          setFilteredChats(data || []);
        }
      } catch (err) {
        if (!cancelled) showError('Ошибка загрузки чатов');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [showError]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredChats(
        chats.filter((chat) =>
          (chat.name && chat.name.toLowerCase().includes(q)) ||
          (chat.username && chat.username.toLowerCase().includes(q))
        )
      );
    }
  }, [searchQuery, chats]);

  const toggleChat = (chatId: string) => {
    setSelectedChats((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  };

  const handleSend = async () => {
    if (selectedChats.size === 0) {
      showError('Выберите хотя бы один чат');
      return;
    }
    setSending(true);
    try {
      const message = `👤 Профиль @${user.username} в Нексо\n${profileUrl}`;
      for (const chatId of selectedChats) {
        try {
          await api.post(`/chats/${chatId}/messages`, {
            content: message,
            type: 'text',
          });
        } catch (err) {
          console.error('Failed to send to chat', chatId, err);
        }
      }
      success(`Профиль отправлен в ${selectedChats.size} ${selectedChats.size === 1 ? 'чат' : 'чаты'}`);
      onClose();
    } catch (err) {
      showError('Ошибка при отправке');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Назад"
          >
            <ArrowLeft size={16} />
          </button>
          <h3 className="text-sm font-semibold text-white truncate">Выберите чат</h3>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          aria-label="Закрыть"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-3 border-b border-white/5 flex-shrink-0">
        <ClearInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск чатов..."
          className="w-full rounded-xl bg-surface-tertiary text-sm text-white placeholder-zinc-500 border border-white/5 focus:border-nexo-500/50 transition-colors outline-none py-2.5"
          leftIcon={<Search size={15} className="text-zinc-500" />}
        />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={24} className="animate-spin text-zinc-400" />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-zinc-500 text-sm">Чаты не найдены</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => toggleChat(chat.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left ${
                  selectedChats.has(chat.id)
                    ? 'bg-nexo-500/15 border border-nexo-500/40'
                    : 'hover:bg-white/[0.05] border border-transparent'
                }`}
              >
                {chat.avatar ? (
                  <img src={chat.avatar} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-nexo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {(chat.name || chat.username || '?')[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {chat.name || chat.username || 'Чат'}
                  </p>
                  {chat.type === 'group' && <p className="text-xs text-zinc-500">Группа</p>}
                  {chat.type === 'channel' && <p className="text-xs text-zinc-500">Канал</p>}
                </div>
                {selectedChats.has(chat.id) && (
                  <Check size={18} className="text-nexo-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/5 space-y-2 flex-shrink-0">
        <p className="text-xs text-zinc-500">
          Выбрано: {selectedChats.size} {selectedChats.size === 1 ? 'чат' : 'чатов'}
        </p>
        <button
          onClick={handleSend}
          disabled={sending || selectedChats.size === 0}
          className="w-full py-3 rounded-xl bg-nexo-500 hover:bg-nexo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-nexo-500/20"
        >
          {sending ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Отправка...</span>
            </>
          ) : (
            <>
              <Send size={17} />
              <span>Отправить</span>
            </>
          )}
        </button>
      </div>
    </>
  );
}
