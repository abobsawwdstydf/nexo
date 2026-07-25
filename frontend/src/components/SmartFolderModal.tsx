import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, Palette, Check } from 'lucide-react';
import { SmartFolder, SmartFolderRule } from '../lib/types';
import { api } from '../lib/api';

interface SmartFolderModalProps {
  onClose: () => void;
  onSaved: () => void;
  initialData?: SmartFolder;
}

const SMART_FOLDER_ICONS = ['⚡', '🔥', '💬', '📸', '📎', '📌', '🔒', '🎯', '❤️', '⭐', '🎵', '🎮'];

const PRESET_COLORS = [
  '#7B61FF', '#a855f7', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6b7280',
];

const RULE_TYPES = [
  { type: 'unread', label: 'Непрочитанные', icon: '🔴', description: 'Чаты с непрочитанными сообщениями' },
  { type: 'mentions', label: 'Упоминания', icon: '📢', description: 'Чаты где вас упомянули' },
  { type: 'media', label: 'Медиа', icon: '📸', description: 'Чаты с фото/видео/аудио' },
  { type: 'keyword', label: 'Ключевое слово', icon: '🔤', description: 'Чаты содержащие слово' },
  { type: 'chat_type', label: 'Тип чата', icon: '👥', description: 'personal или group' },
  { type: 'muted', label: 'Без звука', icon: '🔇', description: 'Заглушенные чаты' },
  { type: 'archived', label: 'Архив', icon: '📦', description: 'Архивированные чаты' },
  { type: 'pinned', label: 'Закреплённые', icon: '📌', description: 'Закреплённые чаты' },
] as const;

export default function SmartFolderModal({ onClose, onSaved, initialData }: SmartFolderModalProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [icon, setIcon] = useState(initialData?.icon || '⚡');
  const [color, setColor] = useState(initialData?.color || '#7B61FF');
  const [rules, setRules] = useState<SmartFolderRule[]>(() => {
    if (initialData?.rules) {
      try { return JSON.parse(initialData.rules); } catch { return []; }
    }
    return [];
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [chatTypeInput, setChatTypeInput] = useState<'personal' | 'group'>('personal');
  const [saving, setSaving] = useState(false);

  const toggleRule = (type: SmartFolderRule['type']) => {
    setRules(prev => {
      const existing = prev.find(r => r.type === type);
      if (existing) return prev.filter(r => r.type !== type);
      return [...prev, { type, value: undefined }];
    });
  };

  const updateRuleValue = (type: string, value: string) => {
    setRules(prev => prev.map(r => r.type === type ? { ...r, value } : r));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        icon,
        color,
        rules: JSON.stringify(rules),
      };
      if (initialData) {
        await api.updateSmartFolder(initialData.id, data);
      } else {
        await api.createSmartFolder(data);
      }
      onSaved();
      onClose();
    } catch (error) {
      console.error('Ошибка сохранения умной папки:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        className="relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#1a1a1f] border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/5 sticky top-0 bg-[#1a1a1f] z-10">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-nexo-400" />
            <h3 className="text-base font-semibold text-white">
              {initialData ? 'Редактировать умную папку' : 'Создать умную папку'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Название */}
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название папки"
              maxLength={30}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50 transition-colors"
              autoFocus
            />
          </div>

          {/* Иконки */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">Иконка</label>
            <div className="grid grid-cols-6 gap-2">
              {SMART_FOLDER_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`aspect-square min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-lg transition-all ${
                    icon === emoji
                      ? 'bg-nexo-500/20 ring-2 ring-nexo-500 scale-110'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Цвет */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
              <Palette size={12} /> Цвет
            </label>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`aspect-square min-w-[44px] min-h-[44px] rounded-lg transition-all relative ${
                    color === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check size={14} className="absolute inset-0 m-auto text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Правила */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">Правила фильтрации</label>
            <div className="space-y-1.5">
              {RULE_TYPES.map(({ type, label, icon: ruleIcon, description }) => {
                const active = rules.some(r => r.type === type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleRule(type)}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center gap-3 min-h-[44px] ${
                      active
                        ? 'bg-white/10 border-white/20'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-lg">{ruleIcon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{label}</div>
                      <div className="text-[10px] text-zinc-500">{description}</div>
                    </div>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                      active ? 'bg-nexo-500 border-nexo-500' : 'border-zinc-600'
                    }`}>
                      {active && <Check size={10} className="text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Дополнительные параметры для keyword/chat_type */}
          {rules.some(r => r.type === 'keyword') && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <label className="text-xs text-zinc-500 mb-1.5 block">Ключевое слово</label>
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => {
                  setKeywordInput(e.target.value);
                  updateRuleValue('keyword', e.target.value);
                }}
                placeholder="Введите слово..."
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50"
              />
            </div>
          )}

          {rules.some(r => r.type === 'chat_type') && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <label className="text-xs text-zinc-500 mb-1.5 block">Тип чата</label>
              <div className="flex gap-2">
                {(['personal', 'group'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setChatTypeInput(t);
                      updateRuleValue('chat_type', t);
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      chatTypeInput === t && rules.some(r => r.type === 'chat_type' && r.value === t)
                        ? 'bg-nexo-500/20 text-nexo-400 ring-1 ring-nexo-500/50'
                        : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                    }`}
                  >
                    {t === 'personal' ? 'Личные' : 'Группы'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Превью */}
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
              style={{ backgroundColor: color + '20', color }}
            >
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{name || 'Название'}</div>
              <div className="text-[10px] text-zinc-500">
                {rules.length === 0 ? 'Без правил' : `${rules.length} правил: ${rules.map(r => RULE_TYPES.find(rt => rt.type === r.type)?.label).join(', ')}`}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 flex gap-2 px-4 py-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-sm font-medium transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 py-2 rounded-xl bg-nexo-500 hover:bg-nexo-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium transition-colors"
          >
            {saving ? 'Сохранение...' : initialData ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
