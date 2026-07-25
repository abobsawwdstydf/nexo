import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { useToastStore } from '../stores/toastStore';

interface CreatePollModalProps {
  chatId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreatePollModal({ chatId, onClose, onSuccess }: CreatePollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [duration, setDuration] = useState(0); // 0 = без ограничения
  const [isLoading, setIsLoading] = useState(false);
  const { success, error } = useToastStore();

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreate = async () => {
    const validOptions = options.filter(o => o.trim());
    if (!question.trim() || validOptions.length < 2) {
      error('Заполните вопрос и минимум 2 варианта');
      return;
    }

    setIsLoading(true);
    try {
      await api.createPoll(chatId, question.trim(), validOptions, allowMultiple, isAnonymous, duration);
      success('Опрос создан');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating poll:', err);
      error('Не удалось создать опрос');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 sm:inset-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[450px] sm:rounded-2xl z-50 bg-surface-secondary border border-border flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Создать опрос</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Вопрос</label>
            <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Введите вопрос" maxLength={200} className="w-full px-4 py-3 bg-surface rounded-xl border border-border focus:border-nexo-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Варианты ответов</label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <input type="text" value={option} onChange={(e) => updateOption(index, e.target.value)} placeholder={`Вариант ${index + 1}`} className="flex-1 px-4 py-2 bg-surface rounded-xl border border-border focus:border-nexo-500 outline-none" />
                  {options.length > 2 && <button onClick={() => removeOption(index)} className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg"><Trash2 size={18} /></button>}
                </div>
              ))}
            </div>
            {options.length < 10 && <button onClick={addOption} className="mt-2 flex items-center gap-2 text-sm text-nexo-400 hover:text-nexo-300"><Plus size={16} />Добавить вариант</button>}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} className="w-4 h-4 rounded border-border bg-surface" />
              <span className="text-sm">Множественный выбор</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="w-4 h-4 rounded border-border bg-surface" />
              <span className="text-sm">Анонимное голосование</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2"><Clock size={16} className="inline mr-1" />Длительность</label>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full px-4 py-2 bg-surface rounded-xl border border-border focus:border-nexo-500 outline-none">
              <option value={0}>Без ограничения</option>
              <option value={60}>1 час</option>
              <option value={360}>6 часов</option>
              <option value={1440}>1 день</option>
              <option value={10080}>1 неделя</option>
            </select>
          </div>
        </div>

        <div className="p-4 border-t border-border">
          <button onClick={handleCreate} disabled={isLoading} className="w-full py-3 bg-nexo-500 hover:bg-nexo-600 disabled:opacity-50 rounded-xl font-medium">
            {isLoading ? 'Создание...' : 'Создать опрос'}
          </button>
        </div>
      </motion.div>
    </>
  );
}
