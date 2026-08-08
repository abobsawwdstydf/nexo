import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, Shield, MessageSquare, Layers, Rocket, Check, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { AnimatedEmoji } from './AnimatedEmoji';
import { MousePointerClick, Smartphone } from 'lucide-react';

interface OnboardingModalProps {
  onClose: () => void;
}

const STEPS = [
  {
    title: 'Добро пожаловать в Нексо!',
    subtitle: 'Защищённый и молниеносный мессенджер нового поколения',
    icon: Sparkles,
    color: 'from-violet-500 to-fuchsia-600',
    content: (
      <div className="text-center py-4 space-y-3">
        <div className="flex justify-center gap-2 my-2">
          <AnimatedEmoji emoji="🚀" size={40} />
          <AnimatedEmoji emoji="🔥" size={40} />
          <AnimatedEmoji emoji="🎉" size={40} />
        </div>
        <p className="text-sm text-white/70">
          Ощутите мгновенную отправку сообщений, кастомные анимированные эмодзи, таблицы в чатах и полное отсутствие задержек даже на самых слабых устройствах.
        </p>
      </div>
    ),
  },
  {
    title: 'Папки и Истории (TG Style)',
    subtitle: 'Управляйте чатами быстро и удобно',
    icon: Layers,
    color: 'from-blue-500 to-cyan-500',
    content: (
      <div className="space-y-3 py-2 text-sm text-white/70">
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-3">
          <span className="p-2 rounded-lg bg-blue-500/20 text-blue-400">📂</span>
          <div>
            <p className="font-semibold text-white/90">Папки и Фильтры</p>
            <p className="text-xs text-white/40">Разделяйте Новости, Личные и Каналы в один клик</p>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-3">
          <span className="p-2 rounded-lg bg-pink-500/20 text-pink-400">📸</span>
          <div>
            <p className="font-semibold text-white/90">Истории</p>
            <p className="text-xs text-white/40">Делитесь моментами прямо над списком чатов</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Контекстное меню и Реакции',
    subtitle: 'Полный контроль над каждым сообщением',
    icon: MousePointerClick,
    color: 'from-amber-400 to-orange-500',
    content: (
      <div className="space-y-3 py-2 text-sm text-white/70">
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-3">
          <span className="p-2 rounded-lg bg-amber-500/20 text-amber-400">⚡</span>
          <div>
            <p className="font-semibold text-white/90">Быстрые реакции</p>
            <p className="text-xs text-white/40">Двойной тап — мгновенная реакция анимированным эмодзи</p>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-3">
          <span className="p-2 rounded-lg bg-orange-500/20 text-orange-400">📋</span>
          <div>
            <p className="font-semibold text-white/90">Контекстное меню</p>
            <p className="text-xs text-white/40">Закрепить, ответить, копировать, переслать, редактировать, удалить</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Markdown & Таблицы',
    subtitle: 'Оформляйте тексты с профессиональным дизайном',
    icon: MessageSquare,
    color: 'from-emerald-400 to-teal-600',
    content: (
      <div className="space-y-2 py-2 text-xs">
        <p className="text-white/70 text-sm mb-2">Создавайте форматированные таблицы прямо в сообщениях:</p>
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 font-mono text-emerald-300">
          | Название | Статус |<br />
          |---|---|<br />
          | Нексо | ⚡️ 60 FPS |
        </div>
      </div>
    ),
  },
  {
    title: 'Сквозное шифрование (E2E)',
    subtitle: 'Ваши сообщения защищены на всех уровнях',
    icon: Shield,
    color: 'from-indigo-500 to-blue-600',
    content: (
      <div className="space-y-3 py-2 text-center">
        <div className="flex justify-center gap-2 my-2">
          <AnimatedEmoji emoji="🔒" size={40} />
          <AnimatedEmoji emoji="🛡️" size={40} />
        </div>
        <p className="text-sm text-white/70">
          Секретные чаты с end-to-end шифрованием. Ни один сервер не может прочитать ваши сообщения. Ключи генерируются прямо на ваших устройствах.
        </p>
      </div>
    ),
  },
  {
    title: 'Оптимизация для слабых устройств',
    subtitle: 'Максимальная производительность везде',
    icon: Smartphone,
    color: 'from-rose-500 to-pink-600',
    content: (
      <div className="space-y-3 py-2 text-center">
        <div className="flex justify-center gap-2 my-2">
          <AnimatedEmoji emoji="⚡" size={40} />
          <AnimatedEmoji emoji="🔋" size={40} />
        </div>
        <p className="text-sm text-white/70">
          Автоматическое определение слабых устройств. Отключение тяжёлых визуальных эффектов для плавной работы даже на старых телефонах.
        </p>
      </div>
    ),
  },
];

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(s => s - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        className="w-full max-w-md rounded-3xl liquid-glass-strong border border-white/[0.12] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
      >
        {/* Top Gradient Banner */}
        <div className={`p-6 bg-gradient-to-br ${current.color} relative flex flex-col items-center text-center text-white`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 transition-colors"
          >
            <X size={16} />
          </button>
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 shadow-lg">
            <Icon size={28} />
          </div>
          <h2 className="text-xl font-bold font-display">{current.title}</h2>
          <p className="text-xs opacity-90 mt-1">{current.subtitle}</p>
        </div>

        {/* Content Body */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {current.content}
            </motion.div>
          </AnimatePresence>

          {/* Dots Indicator */}
          <div className="flex items-center justify-center gap-1.5 mt-6 mb-4">
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === step ? 'w-6 bg-accent' : 'w-1.5 bg-white/20'
                }`}
              />
            ))}
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {step > 0 ? (
              <button
                onClick={handlePrev}
                className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white/70 transition-colors flex items-center gap-1"
              >
                <ChevronLeft size={16} />Назад
              </button>
            ) : <div />}

            <button
              onClick={handleNext}
              className="ml-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent to-accent-dark text-xs font-semibold text-white shadow-lg glow-accent flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {step === STEPS.length - 1 ? (
                <>Начать работу <Check size={16} /></>
              ) : (
                <>Далее <ChevronRight size={16} /></>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
