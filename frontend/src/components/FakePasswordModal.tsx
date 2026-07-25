import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Eye, EyeOff, Lock, MessageSquare, Check, Trash2, Info } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import SidePanelWrapper from './SidePanelWrapper';

interface FakePasswordModalProps {
  onClose: () => void;
  embedded?: boolean;
}

export default function FakePasswordModal({ onClose, embedded }: FakePasswordModalProps) {
  const { user } = useAuthStore();
  const { success, error: showError } = useToastStore();

  const [hasFakePassword, setHasFakePassword] = useState(false);
  const [fakeChats, setFakeChats] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [fakePassword, setFakePassword] = useState('');
  const [confirmFakePassword, setConfirmFakePassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showFakePwd, setShowFakePwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Chat selection
  const [chats, setChats] = useState<any[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadChats();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.get<{ hasFakePassword: boolean; fakeChats: string[] }>('/fake-password/settings');
      setHasFakePassword(data.hasFakePassword);
      setFakeChats(data.fakeChats || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const loadChats = async () => {
    setChatsLoading(true);
    try {
      const data = await api.getChats();
      setChats(data.filter((c: any) => c.type === 'personal' || c.type === 'group'));
    } catch {
      // ignore
    } finally {
      setChatsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentPassword) {
      showError('Введите текущий пароль');
      return;
    }
    if (fakePassword && fakePassword !== confirmFakePassword) {
      showError('Фейковые пароли не совпадают');
      return;
    }
    if (fakePassword && fakePassword.length < 6) {
      showError('Фейковый пароль должен содержать минимум 6 символов');
      return;
    }

    setSaving(true);
    try {
      await api.post('/fake-password/set', {
        currentPassword,
        fakePassword: fakePassword || null,
        fakeChats,
      });
      success(fakePassword ? 'Фейковый пароль установлен' : 'Фейковый пароль удалён');
      setHasFakePassword(!!fakePassword);
      setCurrentPassword('');
      setFakePassword('');
      setConfirmFakePassword('');
    } catch (e: any) {
      showError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!currentPassword) {
      showError('Введите текущий пароль для подтверждения');
      return;
    }
    setSaving(true);
    try {
      await api.post('/fake-password/set', {
        currentPassword,
        fakePassword: null,
        fakeChats: [],
      });
      success('Фейковый пароль удалён');
      setHasFakePassword(false);
      setFakeChats([]);
      setCurrentPassword('');
    } catch (e: any) {
      showError(e.message || 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const toggleChat = (chatId: string) => {
    setFakeChats(prev =>
      prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId]
    );
  };

  return (
    <SidePanelWrapper
      onClose={onClose}
      embedded={embedded}
      title="Фейковый пароль"
      icon={<Shield size={15} className="text-orange-400" />}
    >
      <div className="p-4 space-y-4">
          {/* Info box */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex gap-2">
            <Info className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-orange-300">
              При вводе фейкового пароля отображаются только выбранные чаты. Кошелёк, скрытые чаты и NFT не видны. Идеально для принудительной разблокировки устройства.
            </p>
          </div>

          {/* Status */}
          <div className={`flex items-center gap-2 p-3 rounded-xl ${hasFakePassword ? 'bg-green-500/10 border border-green-500/20' : 'bg-white/5 border border-white/10'}`}>
            <div className={`w-2 h-2 rounded-full ${hasFakePassword ? 'bg-green-400' : 'bg-white/30'}`} />
            <span className={`text-sm ${hasFakePassword ? 'text-green-300' : 'text-white/50'}`}>
              {hasFakePassword ? 'Фейковый пароль установлен' : 'Фейковый пароль не установлен'}
            </span>
          </div>

          {/* Current password */}
          <div>
            <label className="text-xs text-white/50 mb-1 block">Текущий пароль (для подтверждения)</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type={showCurrentPwd ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Введите текущий пароль"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New fake password */}
          <div>
            <label className="text-xs text-white/50 mb-1 block">Новый фейковый пароль</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type={showFakePwd ? 'text' : 'password'}
                value={fakePassword}
                onChange={e => setFakePassword(e.target.value)}
                placeholder="Минимум 6 символов"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => setShowFakePwd(!showFakePwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showFakePwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm fake password */}
          {fakePassword && (
            <div>
              <label className="text-xs text-white/50 mb-1 block">Подтвердите фейковый пароль</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type={showConfirmPwd ? 'text' : 'password'}
                  value={confirmFakePassword}
                  onChange={e => setConfirmFakePassword(e.target.value)}
                  placeholder="Повторите фейковый пароль"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Chat selection */}
          <div>
            <label className="text-xs text-white/50 mb-2 block flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              Видимые чаты в режиме фейкового пароля ({fakeChats.length} выбрано)
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {chatsLoading ? (
                <div className="text-center py-4 text-white/30 text-sm">Загрузка...</div>
              ) : chats.length === 0 ? (
                <div className="text-center py-4 text-white/30 text-sm">Нет чатов</div>
              ) : (
                chats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => toggleChat(chat.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                      fakeChats.includes(chat.id)
                        ? 'bg-indigo-500/20 border border-indigo-500/30'
                        : 'bg-white/5 border border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center flex-shrink-0 text-sm">
                      {chat.avatar ? (
                        <img src={chat.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        (chat.name || 'C')[0].toUpperCase()
                      )}
                    </div>
                    <span className="text-sm text-white flex-1 text-left truncate">
                      {chat.name || chat.username || 'Чат'}
                    </span>
                    {fakeChats.includes(chat.id) && (
                      <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/[0.06] flex gap-2 flex-shrink-0">
        {hasFakePassword && (
          <button
            onClick={handleRemove}
            disabled={saving || !currentPassword}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Удалить
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !currentPassword || (!!fakePassword && fakePassword !== confirmFakePassword)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50 text-sm font-medium"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Shield className="w-4 h-4" />
          )}
          {hasFakePassword ? 'Обновить' : 'Установить'}
        </button>
      </div>
    </SidePanelWrapper>
  );
}
