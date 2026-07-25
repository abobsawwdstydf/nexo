import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Hash, Loader2, Check, Pin } from 'lucide-react';
import { api } from '../lib/api';
import { Chat } from '../lib/types';
import BottomSheet from './BottomSheet';

interface PinChannelModalProps {
  userId: string;
  currentPinnedChannelId?: string | null;
  onPin: (channelId: string) => void;
  onUnpin: () => void;
  onClose: () => void;
}

export default function PinChannelModal({ userId, currentPinnedChannelId, onPin, onUnpin, onClose }: PinChannelModalProps) {
  const [channels, setChannels] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadChannels();
  }, [userId]);

  const loadChannels = async () => {
    try {
      setIsLoading(true);
      const data = await api.getUserChannels(userId);
      setChannels(data);
    } catch (e) {
      console.error('Failed to load channels:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePin = async (channelId: string) => {
    try {
      setIsProcessing(channelId);
      await api.pinChannel(channelId);
      onPin(channelId);
      onClose();
    } catch (e) {
      console.error('Failed to pin channel:', e);
      alert('Ошибка прикрепления канала');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleUnpin = async () => {
    try {
      setIsProcessing('unpin');
      await api.unpinChannel();
      onUnpin();
      onClose();
    } catch (e) {
      console.error('Failed to unpin channel:', e);
      alert('Ошибка открепления канала');
    } finally {
      setIsProcessing(null);
    }
  };

  const channelList = (
    <>
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-zinc-500" />
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-sm">
            У вас пока нет каналов
          </div>
        ) : (
          <div className="space-y-2">
            {channels.map((channel) => {
              const isPinned = currentPinnedChannelId === channel.id;
              return (
                <button
                  key={channel.id}
                  onClick={() => !isPinned && handlePin(channel.id)}
                  disabled={isProcessing !== null}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isPinned
                      ? 'bg-nexo-500/20 border-nexo-500/50'
                      : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.1]'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {channel.avatar ? (
                    <img
                      src={channel.avatar}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-nexo-500 flex items-center justify-center text-white font-bold">
                      <Hash size={20} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-white truncate">
                      {channel.name || channel.username}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {channel.description || `@${channel.username}`}
                    </p>
                  </div>
                  {isPinned ? (
                    <div className="flex items-center gap-2">
                      <Check size={18} className="text-emerald-400" />
                      <span className="text-xs text-emerald-400 font-medium">Прикреплён</span>
                    </div>
                  ) : isProcessing === channel.id ? (
                    <Loader2 size={18} className="animate-spin text-zinc-500" />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {currentPinnedChannelId && (
        <div className="flex gap-3 p-4 border-t border-white/[0.06] bg-white/[0.02]">
          <button
            onClick={handleUnpin}
            disabled={isProcessing !== null}
            className="flex-1 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing === 'unpin' ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
            Открепить
          </button>
          <button
            onClick={onClose}
            disabled={isProcessing !== null}
            className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors disabled:opacity-50"
          >
            Закрыть
          </button>
        </div>
      )}

      {!currentPinnedChannelId && (
        <div className="p-4 border-t border-white/[0.06] bg-white/[0.02]">
          <button
            onClick={onClose}
            disabled={isProcessing !== null}
            className="w-full py-3 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Закрыть
          </button>
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen onClose={onClose} title="Прикрепить канал" showCloseButton>
        {channelList}
      </BottomSheet>
    );
  }

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
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl z-50 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Pin size={18} className="text-nexo-400" />
            Прикрепить канал
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-zinc-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        {channelList}
      </motion.div>
    </>
  );
}
