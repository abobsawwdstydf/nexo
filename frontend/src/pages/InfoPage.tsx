import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Shield, Lock, Globe, Server, Heart, Users, Zap, Mail, User, Video, Layers } from 'lucide-react';

export default function InfoPage({ onBack }: { onBack: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onBack]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-50 flex items-center justify-center px-4"
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-black">
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.04, 0.08, 0.04] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-20 -left-20 w-[500px] h-[500px] rounded-full bg-blue-500 blur-[140px]"
        />
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.03, 0.07, 0.03] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute -bottom-20 -right-20 w-[500px] h-[500px] rounded-full bg-fuchsia-500 blur-[140px]"
        />
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.02, 0.05, 0.02] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
          className="absolute top-[30%] left-[50%] -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-violet-500 blur-[120px]"
        />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={mounted ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto px-1"
      >
        {/* Back button */}
        <button
          onClick={onBack}
          className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 mb-4 text-sm text-white/50 hover:text-white/80 transition-colors bg-black/40 backdrop-blur-xl border border-white/[0.06] rounded-2xl w-full"
        >
          <ArrowLeft size={16} />
          Назад
        </button>

        {/* Hero */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25"
          >
            <Shield size={36} className="text-white" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="text-3xl font-bold text-white mb-2"
          >
            Нексо
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="text-sm text-white/50"
          >
            Защищённый мессенджер от Dark Heavens
          </motion.p>
        </div>

        {/* About */}
        <InfoCard
          icon={Globe}
          title="О проекте"
          children={
            <p className="text-sm text-white/60 leading-relaxed">
              Нексо — это мессенджер нового поколения, созданный для тех, кто ценит приватность
              и безопасность. Мы не продаём данные, не показываем рекламу и не следуем за вами
              по интернету. Наш приоритет — ваш контроль над информацией.
            </p>
          }
        />

        {/* Security */}
        <InfoCard
          icon={Lock}
          title="Безопасность"
          children={
            <ul className="space-y-2 text-sm text-white/60">
              <li className="flex items-start gap-2">
                <Shield size={14} className="text-green-400 mt-0.5 shrink-0" />
                <span>
                  <strong className="text-white/80">E2E-шифрование</strong> — сообщения шифруются на устройстве и расшифровываются только у получателя. Даже мы не можем их прочитать.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Server size={14} className="text-blue-400 mt-0.5 shrink-0" />
                <span>
                  <strong className="text-white/80">Свои серверы</strong> — инфраструктура на собственных VPS в Европе. Полный контроль над данными.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Zap size={14} className="text-yellow-400 mt-0.5 shrink-0" />
                <span>
                  <strong className="text-white/80">Open Source ядро</strong> — бэкенд на Go, фронт на React. Прозрачный код, независимая аудитория.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Layers size={14} className="text-purple-400 mt-0.5 shrink-0" />
                <span>
                  <strong className="text-white/80">Self-hosted</strong> — можно развернуть собственную копию Нексо без ограничений.
                </span>
              </li>
            </ul>
          }
        />

        {/* Why Nexo */}
        <InfoCard
          icon={Heart}
          title="Почему Нексо?"
          children={
            <ul className="space-y-2 text-sm text-white/60">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                <span>Никакой рекламы и трекеров — только вы и ваши контакты</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 mt-1.5 shrink-0" />
                <span>Боты с поддержкой Telegram Bot API — свои сервисы в чатах</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <span>Голосовые комнаты, заметки, коллекции ссылок и смарт-папки</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                <span>AI-ассистент прямо в чате — помогает и отвечает</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 shrink-0" />
                <span>Пригласительная система и бета-доступ — только по приглашениям</span>
              </li>
            </ul>
          }
        />

        {/* Contacts */}
        <InfoCard
          icon={Mail}
          title="Контакты"
          children={
            <div className="space-y-3 text-sm">
              <a
                href="mailto:nexo.su.support@gmail.com"
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors text-white/70 hover:text-white group"
              >
                <Mail size={16} className="text-violet-400 shrink-0" />
                <span className="group-hover:underline">nexo.su.support@gmail.com</span>
              </a>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <User size={16} className="text-blue-400 shrink-0" />
                <span className="text-white/70">Разработчик: <span className="text-white font-medium">@haker_one</span></span>
              </div>
              <a
                href="https://www.tiktok.com/@nexo.su"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors text-white/70 hover:text-white group"
              >
                <Video size={16} className="text-fuchsia-400 shrink-0" />
                <span className="group-hover:underline">@nexo.su (TikTok)</span>
              </a>
            </div>
          }
        />

        {/* Domains */}
        <InfoCard
          icon={Globe}
          title="Домены"
          children={
            <div className="grid grid-cols-2 gap-2 text-sm">
              {domains.map((d) => (
                <div key={d} className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/50 text-xs font-mono truncate" title={d}>
                  {d}
                </div>
              ))}
            </div>
          }
        />

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-white/20 pb-4">
          © 2026 Dark Heavens Corporate
        </div>
      </motion.div>
    </motion.div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-xl"
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-violet-400" />
        <h2 className="text-sm font-semibold text-white/90">{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}

const domains = [
  'https://msg.darkheavens.ru',
  'https://msg.hakerone.ru',
  'https://n.darkheavens.ru',
  'https://n.hakerone.ru',
  'https://nexo.darkheavens.ru',
  'https://nexo.hakerone.ru',
  'https://нексо.hakerone.ru',
  'https://нексо.darkheavens.ru',
];
