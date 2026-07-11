import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Share2, Clock, Users, Link as LinkIcon } from 'lucide-react';
import { api } from '../lib/api';

interface ShareFolderModalProps {
  folderId: string;
  folderName: string;
  folderIcon: string;
  folderColor: string;
  onClose: () => void;
}

export default function ShareFolderModal({
  folderId,
  folderName,
  folderIcon,
  folderColor,
  onClose,
}: ShareFolderModalProps) {
  const [loading, setLoading] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [maxUses, setMaxUses] = useState<number | null>(null);

  const handleCreateLink = async () => {
    setLoading(true);
    try {
      const result = await api.shareFolderLink(folderId, {
        expiresIn: expiresIn ? expiresIn * 3600 : undefined,
        maxUses: maxUses || undefined,
      });
      setShareLink(result.url);
    } catch (error) {
      console.error('Ошибка создания ссылки:', error);
      alert('Не удалось создать ссылку');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl glass-strong p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: folderColor + '20', color: folderColor }}
            >
              {folderIcon}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Поделиться папкой</h2>
              <p className="text-sm text-zinc-400">{folderName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg glass-btn text-zinc-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {!shareLink ? (
          <>
            {/* Настройки ссылки */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-2">
                  <Clock size={16} />
                  Срок действия
                </label>
                <select
                  value={expiresIn || ''}
                  onChange={(e) => setExpiresIn(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm"
                >
                  <option value="">Без ограничений</option>
                  <option value="1">1 час</option>
                  <option value="24">24 часа</option>
                  <option value="168">7 дней</option>
                  <option value="720">30 дней</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-2">
                  <Users size={16} />
                  Лимит использований
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Без ограничений"
                  value={maxUses || ''}
                  onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-lg glass-input text-white text-sm"
                />
              </div>
            </div>

            {/* Кнопка создания */}
            <button
              onClick={handleCreateLink}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-nexo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  <Share2 size={18} />
                  Создать ссылку
                </>
              )}
            </button>
          </>
        ) : (
          <>
            {/* Ссылка создана */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-nexo-500/10 border border-nexo-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <LinkIcon size={16} className="text-nexo-400" />
                  <span className="text-sm font-medium text-nexo-400">Ссылка создана</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 px-3 py-2 rounded-lg bg-black/30 text-white text-sm border border-white/10"
                  />
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 rounded-lg glass-btn text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                  >
                    {copied ? (
                      <>
                        <Check size={16} className="text-green-400" />
                        <span className="text-sm">Скопировано</span>
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        <span className="text-sm">Копировать</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Информация */}
              <div className="space-y-2 text-sm text-zinc-400">
                {expiresIn && (
                  <div className="flex items-center gap-2">
                    <Clock size={14} />
                    <span>Истекает через {expiresIn === 1 ? '1 час' : expiresIn === 24 ? '24 часа' : expiresIn === 168 ? '7 дней' : '30 дней'}</span>
                  </div>
                )}
                {maxUses && (
                  <div className="flex items-center gap-2">
                    <Users size={14} />
                    <span>Максимум использований: {maxUses}</span>
                  </div>
                )}
                <p className="text-xs text-zinc-500 mt-3">
                  Пользователи, перешедшие по ссылке, смогут добавить эту папку к себе. В папку автоматически добавятся только те чаты, в которых они уже состоят.
                </p>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
