import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Globe, Server, Heart, Zap, Mail, User, Video, Shield } from 'lucide-react';

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
      {/* Background — серый, как на главной мессенджера */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-black">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.04, 0.08, 0.04] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[10%] -left-[10%] w-[500px] h-[500px] rounded-full bg-white blur-[140px]"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.03, 0.06, 0.03] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          className="absolute bottom-[20%] -right-[5%] w-[400px] h-[400px] rounded-full bg-zinc-400 blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.02, 0.05, 0.02] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
          className="absolute top-[40%] left-[40%] w-[350px] h-[350px] rounded-full bg-zinc-500 blur-[100px]"
        />
        <div
          className="absolute inset-0 opacity-[0.012]"
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
            className="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-2xl bg-white/[0.06] border border-white/[0.1] shadow-lg shadow-black/40"
          >
            <img src="/logo.png" alt="Нексо" className="w-14 h-14 object-contain" />
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
              Нексо — это мессенджер для тех, кто ценит приватность
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
                  <strong className="text-white/80">Молниеносная скорость</strong> — мгновенная доставка, живой WebSocket и оптимизированное ядро.
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
                <span className="w-1.5 h-1.5 rounded-full bg-white/40 mt-1.5 shrink-0" />
                <span>Никакой рекламы и трекеров — только вы и ваши контакты</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white/40 mt-1.5 shrink-0" />
                <span>Боты с поддержкой Telegram Bot API — свои сервисы в чатах</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white/40 mt-1.5 shrink-0" />
                <span>Истории, реакции, каналы, голосовые и видеозвонки</span>
              </li>
            </ul>
          }
        />

        {/* Обещание Нексо */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-white/70" />
            <h2 className="text-sm font-semibold text-white/90">Обещание Нексо</h2>
          </div>
          <div className="space-y-3 text-sm text-white/60 leading-relaxed">
            <p>
              Это мой мессенджер, и ваши данные я не отдам никому. Если когда-нибудь власти
              попросят данные пользователей Нексо — вы не увидите их больше никогда,
              ни под каким названием, ни в каких форках.
            </p>
            <p>
              Я ставлю на проект 2–3 года. Нексо будет выделено несколько месяцев активной
              работы — именно в эти месяцы я буду его поддерживать и развивать.
            </p>
            <p>
              Если за этот период (до конца 2027 года) появится хотя бы 10 стабильных
              пользователей — мессенджер продолжит свою работу. Если нет — проект будет
              перенесён на неопределённый срок.
            </p>
          </div>
        </motion.div>

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
                <Mail size={16} className="text-white/50 shrink-0" />
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
                <Video size={16} className="text-white/50 shrink-0" />
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
        <Icon size={16} className="text-white/60" />
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
