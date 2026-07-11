import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Folder, Check, AlertCircle, Loader } from 'lucide-react';
import { api } from '../lib/api';
import Avatar from './Avatar';
import BottomSheet from './BottomSheet';

interface AcceptSharedFolderModalProps {
  token: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AcceptSharedFolderModal({
  token,
  onClose,
  onSuccess,
}: AcceptSharedFolderModalProps) {
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folderData, setFolderData] = useState<any>(null);
  const [result, setResult] = useState<{ addedChats: number; totalChats: number } | null>(null);

  useEffect(() => {
    loadFolderData();
  }, [token]);

  const loadFolderData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSharedFolder(token);
      setFolderData(data);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить папку');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      const res = await api.addSharedFolder(token);
      setResult(res);
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Не удалось добавить папку');
    } finally {
      setAdding(false);
    }
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const header = (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
      <div className="w-8 h-8 rounded-lg bg-nexo-500/10 flex items-center justify-center">
        <Folder size={16} className="text-nexo-400" />
      </div>
      <h2 className="text-lg font-bold text-white flex-1">Добавить папку</h2>
      <button
        onClick={onClose}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );

  const content = (
    <>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader size={32} className="text-nexo-400 animate-spin" />
          <p className="text-sm text-zinc-400">Загрузка...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <p className="text-sm text-red-400 text-center">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-colors"
          >
            Закрыть
          </button>
        </div>
      ) : result ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
            <Check size={32} className="text-green-400" />
          </div>
          <p className="text-lg font-bold text-white">Папка добавлена!</p>
          <p className="text-sm text-zinc-400 text-center">
            Добавлено {result.addedChats} из {result.totalChats} чатов
          </p>
          {result.addedChats < result.totalChats && (
            <p className="text-xs text-zinc-500 text-center max-w-xs">
              Некоторые чаты не были добавлены, так как вы не являетесь их участником
            </p>
          )}
        </div>
      ) : folderData ? (
        <div className="p-5">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                style={{
                  backgroundColor: folderData.folder.color + '20',
                  color: folderData.folder.color,
                }}
              >
                {folderData.folder.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white">{folderData.folder.name}</h3>
                <p className="text-sm text-zinc-400">
                  {folderData.folder.chats.length} {folderData.folder.chats.length === 1 ? 'чат' : folderData.folder.chats.length < 5 ? 'чата' : 'чатов'}
                </p>
              </div>
            </div>

            {folderData.folder.chats.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Чаты в папке
                </p>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {folderData.folder.chats.map((chat: any) => (
                    <div
                      key={chat.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
                    >
                      <Avatar
                        src={chat.avatar}
                        name={chat.name || chat.username || '?'}
                        size="sm"
                        isVerified={chat.isVerified}
                        verifiedBadgeUrl={chat.verifiedBadgeUrl}
                        verifiedBadgeType={chat.verifiedBadgeType}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {chat.name || chat.username}
                        </p>
                        {chat.description && (
                          <p className="text-xs text-zinc-500 truncate">{chat.description}</p>
                        )}
                      </div>
                      {chat.type === 'channel' && (
                        <span className="text-xs text-zinc-500 px-2 py-0.5 rounded bg-white/5">
                          Канал
                        </span>
                      )}
                      {chat.type === 'group' && (
                        <span className="text-xs text-zinc-500 px-2 py-0.5 rounded bg-white/5">
                          Группа
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(folderData.expiresAt || folderData.maxUses) && (
              <div className="mt-4 p-3 rounded-lg bg-zinc-800/50 space-y-1 text-xs text-zinc-400">
                {folderData.expiresAt && (
                  <p>
                    Истекает: {new Date(folderData.expiresAt).toLocaleString('ru-RU')}
                  </p>
                )}
                {folderData.maxUses && (
                  <p>
                    Использовано: {folderData.usedCount} / {folderData.maxUses}
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleAdd}
            disabled={adding}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-nexo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {adding ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Добавление...
              </>
            ) : (
              <>
                <Folder size={18} />
                Добавить папку
              </>
            )}
          </button>

          <p className="text-xs text-zinc-500 text-center mt-3">
            В папку будут добавлены только те чаты, в которых вы уже состоите
          </p>
        </div>
      ) : null}
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen={true} onClose={onClose} title="Добавить папку" showCloseButton={false}>
        {content}
      </BottomSheet>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-[#1a1a1a] shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        {header}
        {content}
      </motion.div>
    </motion.div>
  );
}
