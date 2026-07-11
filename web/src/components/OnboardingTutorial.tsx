import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Type, Table2, ListOrdered, Quote, Hash, Minus, Bold, Italic, Code, AtSign, Smile, Send } from 'lucide-react';

interface OnboardingTutorialProps {
  onComplete: () => void;
}

interface Step {
  title: string;
  description: string;
  icon: React.ReactNode;
  syntax: string;
  example: React.ReactNode;
}

const steps: Step[] = [
  {
    title: 'Привет! Это Нексо',
    description: 'Мессенджер с богатыми возможностями форматирования. Научимся создавать красивые сообщения!',
    icon: <Smile size={28} className="text-nexo-400" />,
    syntax: '',
    example: (
      <div className="text-center py-4">
        <div className="text-3xl mb-2">👋</div>
        <p className="text-sm text-zinc-400">Добро пожаловать в Нексо!</p>
      </div>
    )
  },
  {
    title: 'Жирный и курсив',
    description: 'Выделяй текст жирным или курсивом для акцентов.',
    icon: <Bold size={28} className="text-nexo-400" />,
    syntax: '**жирный** и *курсив*',
    example: (
      <div className="space-y-1">
        <p><strong className="text-white">Это жирный текст</strong></p>
        <p><em className="text-zinc-300">Это курсив</em></p>
        <p><strong><em>Жирный курсив!</em></strong></p>
      </div>
    )
  },
  {
    title: 'Зачёркнутый и код',
    description: 'Зачёркивай текст или выделяй код однострочниками.',
    icon: <Code size={28} className="text-nexo-400" />,
    syntax: '~зачёркнутый~ и `код`',
    example: (
      <div className="space-y-1">
        <p><del className="text-zinc-400">Это зачёркнутый текст</del></p>
        <p><code className="font-mono text-[13px] bg-black/20 px-1.5 py-0.5 rounded text-nexo-300">console.log("привет")</code></p>
      </div>
    )
  },
  {
    title: 'Заголовки',
    description: 'Используй # для заголовков разных уровней — как в документах.',
    icon: <Hash size={28} className="text-nexo-400" />,
    syntax: '# Заголовок 1\n## Заголовок 2\n### Заголовок 3',
    example: (
      <div className="space-y-1">
        <p className="text-lg font-bold">Заголовок 1</p>
        <p className="text-base font-bold">Заголовок 2</p>
        <p className="text-sm font-semibold">Заголовок 3</p>
      </div>
    )
  },
  {
    title: 'Таблицы',
    description: 'Создавай таблицы для структурированной информации!',
    icon: <Table2 size={28} className="text-nexo-400" />,
    syntax: '| Имя | Возраст |\n|------|--------|\n| Алиса | 25 |\n| Боб | 30 |',
    example: (
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="border-collapse text-xs w-full">
          <thead>
            <tr>
              <th className="px-2 py-1 font-semibold border border-white/10 bg-white/[0.06] rounded-tl-lg">Имя</th>
              <th className="px-2 py-1 font-semibold border border-white/10 bg-white/[0.06] rounded-tr-lg">Возраст</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-2 py-1 border border-white/10">Алиса</td>
              <td className="px-2 py-1 border border-white/10">25</td>
            </tr>
            <tr>
              <td className="px-2 py-1 border border-white/10">Боб</td>
              <td className="px-2 py-1 border border-white/10">30</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  },
  {
    title: 'Списки',
    description: 'Нумерованные и маркированные списки для порядка.',
    icon: <ListOrdered size={28} className="text-nexo-400" />,
    syntax: '- Пункт 1\n- Пункт 2\n\n1. Первый\n2. Второй',
    example: (
      <div className="space-y-2 text-xs">
        <div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Купить продукты</li>
            <li>Позвонить другу</li>
            <li>Сделать домашку</li>
          </ul>
        </div>
        <div>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>Открыть мессенджер</li>
            <li>Написать сообщение</li>
            <li>Нажать Enter</li>
          </ol>
        </div>
      </div>
    )
  },
  {
    title: 'Цитаты и разделители',
    description: 'Выделяй важные мысли цитатами или отделяй секции линиями.',
    icon: <Quote size={28} className="text-nexo-400" />,
    syntax: '> Это цитата\n\n---',
    example: (
      <div className="space-y-3">
        <div className="border-l-2 border-nexo-500/60 pl-3 py-0.5 text-sm italic opacity-80">
          «Мессенджер — это не просто чат, это способ жизни»
        </div>
        <hr className="border-white/10" />
      </div>
    )
  },
  {
    title: 'Готово!',
    description: 'Теперь ты умеешь форматировать сообщения! Попробуй написать что-нибудь красивое в чате.',
    icon: <Send size={28} className="text-nexo-400" />,
    syntax: '',
    example: (
      <div className="text-center py-2">
        <p className="text-sm text-zinc-400 mb-3">Вот шпаргалка для быстрого доступа:</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { label: 'Жирный', val: '**текст**' },
            { label: 'Курсив', val: '*текст*' },
            { label: 'Код', val: '`код`' },
            { label: 'Таблица', val: '| кол |' },
            { label: 'Список', val: '- пункт' },
            { label: 'Цитата', val: '> цитата' },
            { label: 'Заголовок', val: '# H1' },
            { label: 'Линия', val: '---' },
          ].map(({ label, val }) => (
            <div key={label} className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1.5">
              <span className="text-zinc-500">{label}</span>
              <code className="text-nexo-300 font-mono text-[10px]">{val}</code>
            </div>
          ))}
        </div>
      </div>
    )
  }
];

export default function OnboardingTutorial({ onComplete }: OnboardingTutorialProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  const handleComplete = () => {
    setVisible(false);
    setTimeout(onComplete, 300);
  };

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) setStep(s => s - 1);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => { e.stopPropagation(); }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-[#111113] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              {current.icon}
              <h2 className="text-base font-semibold text-white">{current.title}</h2>
            </div>
            <button
              onClick={handleComplete}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 px-4 py-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-nexo-500' : i < step ? 'w-1.5 bg-nexo-500/50' : 'w-1.5 bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="px-4 py-3 min-h-[180px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-sm text-zinc-400 mb-3">{current.description}</p>

                {current.syntax && (
                  <div className="mb-3 bg-black/30 rounded-xl px-3 py-2 font-mono text-xs text-nexo-300 whitespace-pre-wrap border border-white/5">
                    {current.syntax}
                  </div>
                )}

                <div className="bg-white/[0.03] rounded-xl px-3 py-2 border border-white/[0.06]">
                  {current.example}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <button
              onClick={handlePrev}
              disabled={isFirst}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} /> Назад
            </button>
            <span className="text-[10px] text-zinc-600">{step + 1} / {steps.length}</span>
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 rounded-xl text-xs font-medium bg-nexo-500 text-white hover:bg-nexo-600 transition-colors"
            >
              {isLast ? 'Начать!' : 'Далее'} {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
