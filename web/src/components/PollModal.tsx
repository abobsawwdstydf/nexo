import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Check, BarChart3, Trash2 } from 'lucide-react';
import BottomSheet from './BottomSheet';

interface PollModalProps {
  onClose: () => void;
  onSend: (poll: { question: string; options: string[]; multiple: boolean; quiz: boolean }) => void;
}

export default function PollModal({ onClose, onSend }: PollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [quiz, setQuiz] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<number>(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const addOption = () => {
    if (options.length >= 10) return;
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
    if (correctAnswer >= index && correctAnswer > 0) {
      setCorrectAnswer(correctAnswer - 1);
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSend = () => {
    if (!question.trim()) return;
    if (options.some(o => !o.trim())) return;

    onSend({
      question: question.trim(),
      options: options.map(o => o.trim()),
      multiple,
      quiz,
    });
    onClose();
  };

  const canSend = question.trim() && options.every(o => o.trim()) && options.length >= 2;

  const content = (
    <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
      {/* Question */}
      <div>
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">
          Вопрос
        </label>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Введите вопрос..."
          maxLength={200}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50 transition-colors"
        />
      </div>

      {/* Options */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Варианты ответа
          </label>
          <span className="text-xs text-zinc-500">{options.length}/10</span>
        </div>

        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              {quiz && (
                <button
                  onClick={() => setCorrectAnswer(index)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    correctAnswer === index
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/5 text-zinc-500 hover:bg-white/10'
                  }`}
                >
                  <Check size={14} />
                </button>
              )}

              <input
                type="text"
                value={option}
                onChange={e => updateOption(index, e.target.value)}
                placeholder={`Вариант ${index + 1}`}
                maxLength={100}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50 transition-colors text-sm"
              />

              {options.length > 2 && (
                <button
                  onClick={() => removeOption(index)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {options.length < 10 && (
          <button
            onClick={addOption}
            className="mt-2 flex items-center gap-2 text-sm text-nexo-400 hover:text-nexo-300 transition-colors"
          >
            <Plus size={14} />
            Добавить вариант
          </button>
        )}
      </div>

      {/* Settings */}
      <div className="space-y-3 bg-white/5 rounded-xl p-4">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium text-white">Несколько вариантов</p>
            <p className="text-xs text-zinc-400">Разрешить выбирать несколько</p>
          </div>
          <div
            onClick={() => { setMultiple(!multiple); if (quiz) setQuiz(false); }}
            className={`w-10 h-6 rounded-full transition-colors relative ${multiple ? 'bg-nexo-500' : 'bg-white/10'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${multiple ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium text-white">Режим викторины</p>
            <p className="text-xs text-zinc-400">Выберите правильный ответ</p>
          </div>
          <div
            onClick={() => { setQuiz(!quiz); if (quiz) setMultiple(false); }}
            className={`w-10 h-6 rounded-full transition-colors relative ${quiz ? 'bg-emerald-500' : 'bg-white/10'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${quiz ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
        </label>
      </div>
    </div>
  );

  const footer = (
    <div className="p-4 border-t border-white/5 flex-shrink-0">
      <button
        onClick={handleSend}
        disabled={!canSend}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-medium hover:from-nexo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-nexo-500/25"
      >
        Отправить опрос
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen onClose={onClose} title="Создать опрос">
        <div className="flex flex-col h-full">
          {/* Custom header with icon */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <BarChart3 size={18} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white">Создать опрос</h3>
          </div>
          {content}
          {footer}
        </div>
      </BottomSheet>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <BarChart3 size={18} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white">Создать опрос</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {content}
        {footer}
      </motion.div>
    </motion.div>
  );
}
