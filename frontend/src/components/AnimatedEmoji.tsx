import React, { memo } from 'react';
import { motion } from 'framer-motion';

// Mapping of standard emoji unicode strings to custom Telegram-style animated SVG / CSS renderers
export interface AnimatedEmojiProps {
  emoji: string;
  size?: number;
  className?: string;
}

export const ANIMATED_EMOJI_MAP: Record<string, { type: string; bgGradient: string; shadow: string; label: string }> = {
  '👍': { type: 'thumbsup', bgGradient: 'from-amber-400 to-yellow-500', shadow: 'rgba(245,158,11,0.4)', label: 'Класс' },
  '❤️': { type: 'heart', bgGradient: 'from-rose-500 to-red-600', shadow: 'rgba(239,68,68,0.5)', label: 'Сердце' },
  '🔥': { type: 'fire', bgGradient: 'from-orange-500 to-amber-500', shadow: 'rgba(249,115,22,0.5)', label: 'Огонь' },
  '😂': { type: 'laugh', bgGradient: 'from-amber-300 to-yellow-400', shadow: 'rgba(234,179,8,0.4)', label: 'Ха-ха' },
  '😮': { type: 'open_mouth', bgGradient: 'from-cyan-400 to-blue-500', shadow: 'rgba(6,182,212,0.4)', label: 'Ого' },
  '😢': { type: 'cry', bgGradient: 'from-sky-400 to-indigo-500', shadow: 'rgba(56,189,248,0.4)', label: 'Грусть' },
  '👏': { type: 'clap', bgGradient: 'from-emerald-400 to-teal-500', shadow: 'rgba(52,211,153,0.4)', label: 'Аплодисменты' },
  '🎉': { type: 'tada', bgGradient: 'from-purple-400 to-pink-500', shadow: 'rgba(168,85,247,0.5)', label: 'Праздник' },
  '💩': { type: 'poop', bgGradient: 'from-amber-700 to-yellow-900', shadow: 'rgba(180,83,9,0.4)', label: 'Какашка' },
  '🥳': { type: 'party', bgGradient: 'from-pink-400 to-rose-500', shadow: 'rgba(244,63,94,0.4)', label: 'Тусовка' },
  '🚀': { type: 'rocket', bgGradient: 'from-violet-500 to-indigo-600', shadow: 'rgba(139,92,246,0.5)', label: 'Ракета' },
  '💡': { type: 'bulb', bgGradient: 'from-yellow-300 to-amber-400', shadow: 'rgba(252,211,77,0.5)', label: 'Идея' },
  '💯': { type: 'hundred', bgGradient: 'from-red-500 to-rose-600', shadow: 'rgba(225,29,72,0.5)', label: '100%' },
  '😎': { type: 'cool', bgGradient: 'from-blue-400 to-cyan-500', shadow: 'rgba(59,130,246,0.4)', label: 'Круто' },
  '😭': { type: 'loud_cry', bgGradient: 'from-blue-500 to-indigo-600', shadow: 'rgba(99,102,241,0.4)', label: 'Плач' },
  '😈': { type: 'devil', bgGradient: 'from-purple-600 to-fuchsia-700', shadow: 'rgba(192,38,211,0.5)', label: 'Дьявол' },
};

// Последовательности с variation selector \uFE0F (❤️) нормализуются до базового
// символа, чтобы попадать в маппинг.
function normalizeEmoji(emoji: string): string {
  return emoji.replace(/\uFE0F/g, '');
}

// Анимированные webp-эмодзи (Telegram-стиль) из /animated-emojis/*.webp.
// Ключи — без \uFE0F. В perf-mode webp не рендерятся (экономия CPU на слабых устройствах).
export const ANIMATED_WEBP_MAP: Record<string, { file: string; label: string }> = {
  '😀': { file: '3346+beaming_eyes_face_grin_smiling.webp', label: 'Улыбка' },
  '😃': { file: '3346+beaming_eyes_face_grin_smiling.webp', label: 'Улыбка' },
  '😄': { file: '3346+beaming_eyes_face_grin_smiling.webp', label: 'Улыбка' },
  '😁': { file: '3346+beaming_eyes_face_grin_smiling.webp', label: 'Улыбка' },
  '🥳': { file: '3345+face_partying.webp', label: 'Тусовка' },
  '🎉': { file: '3345+face_partying.webp', label: 'Праздник' },
  '😳': { file: '3344+face_flushed.webp', label: 'Смущение' },
  '😒': { file: '3343+face_unamused.webp', label: 'Недовольство' },
  '😖': { file: '3342+anguished_face.webp', label: 'Мучение' },
  '😡': { file: '3341+enraged_face_pout_rage.webp', label: 'Злость' },
  '😠': { file: '3341+enraged_face_pout_rage.webp', label: 'Злость' },
  '❤': { file: '3340+heart_red.webp', label: 'Сердце' },
  '🧡': { file: '3370+heart_orange.webp', label: 'Сердце' },
  '💛': { file: '3372+heart_yellow.webp', label: 'Сердце' },
  '💚': { file: '3373+green_heart.webp', label: 'Сердце' },
  '💙': { file: '3371+blue_heart.webp', label: 'Сердце' },
  '💜': { file: '3374+heart_purple.webp', label: 'Сердце' },
  '🤍': { file: '3377+heart_white.webp', label: 'Сердце' },
  '🤎': { file: '3376+brown_heart.webp', label: 'Сердце' },
  '🖤': { file: '3375+black_heart.webp', label: 'Сердце' },
  '💘': { file: '3381+arrow_cupid_heart.webp', label: 'Сердце' },
  '💔': { file: '3382+broken_heart.webp', label: 'Разбитое сердце' },
  '💋': { file: '3352+kiss_mark.webp', label: 'Поцелуй' },
  '😘': { file: '3354+a_blowing_face_heart_kiss_kissing.webp', label: 'Поцелуй' },
  '🥰': { file: '3380+face_hearts_smiling_three.webp', label: 'Влюблённость' },
  '😍': { file: '3351+eyes_face_heart_smiling.webp', label: 'Влюблённость' },
  '😻': { file: '3378+cat_eyes_heart_smiling.webp', label: 'Кот влюблён' },
  '😿': { file: '3421+cat_crying_face.webp', label: 'Кот плачет' },
  '😭': { file: '3347+cry_crying_face.webp', label: 'Плач' },
  '😮': { file: '3348+face_mouth_open.webp', label: 'Удивление' },
  '🙄': { file: '3350+eyes_face_roll_rolling.webp', label: 'Закатывание глаз' },
  '💀': { file: '3349+skull.webp', label: 'Череп' },
  '💡': { file: '3365+bulb_light.webp', label: 'Идея' },
  '🔒': { file: '3356+closed_key_lock_locked.webp', label: 'Замок' },
  '💎': { file: '3355+gem_stone.webp', label: 'Бриллиант' },
  '🧐': { file: '3353+face_monocle.webp', label: 'Расследование' },
  '⌛': { file: '3364+done_flowing_hourglass_not_sand.webp', label: 'Песочные часы' },
  '😔': { file: '3363+face_pensive.webp', label: 'Задумчивость' },
  '📮': { file: '3362+flag_mail_mailbox_open_raised.webp', label: 'Почта' },
  '🧑🏫': { file: '3361+man_teacher.webp', label: 'Учитель' },
  '👨🏫': { file: '3361+man_teacher.webp', label: 'Учитель' },
  '🎄': { file: '3367+christmas_tree.webp', label: 'Ёлка' },
  '👛': { file: '3366+purse.webp', label: 'Кошелёк' },
  '💱': { file: '3368+currency_exchange.webp', label: 'Обмен валют' },
  '⛄': { file: '3369+snow_snowman.webp', label: 'Снеговик' },
  '🤔': { file: '3404+face_thinking.webp', label: 'Размышление' },
  '🧽': { file: '3403+sponge.webp', label: 'Губка' },
  '🤷': { file: '3402+man_shrugging.webp', label: 'Пожимание плечами' },
  '🤷♂': { file: '3402+man_shrugging.webp', label: 'Пожимание плечами' },
  '🤷♀': { file: '3401+shrugging_woman.webp', label: 'Пожимание плечами' },
  '💊': { file: '3397+pill.webp', label: 'Таблетка' },
  '🤮': { file: '3396+face_vomiting.webp', label: 'Рвота' },
  '🚑': { file: '3395+ambulance.webp', label: 'Скорая' },
  '🧼': { file: '3394+soap.webp', label: 'Мыло' },
  '🤧': { file: '3393+face_sneezing.webp', label: 'Чихание' },
  '🤕': { file: '3392+bandage_face_head.webp', label: 'Бинты' },
  '🤢': { file: '3391+face_nauseated.webp', label: 'Тошнота' },
  '🤒': { file: '3390+face_thermometer.webp', label: 'Градусник' },
  '🦠': { file: '3389+microbe.webp', label: 'Микроб' },
  '📂': { file: '3388+file_folder_open.webp', label: 'Папка' },
  '📁': { file: '3387+file_folder.webp', label: 'Папка' },
  '🧮': { file: '3386+abacus.webp', label: 'Счёты' },
  '📢': { file: '3385+mega_megaphone.webp', label: 'Мегафон' },
  '🎁': { file: '3384+gift_heart_ribbon.webp', label: 'Подарок' },
  '🧭': { file: '3383+compass.webp', label: 'Компас' },
  '💌': { file: '3379+letter_love.webp', label: 'Любовное письмо' },
  '😎': { file: '3420+face_smiling_sunglasses.webp', label: 'Круто' },
  '😴': { file: '3419+face_sleeping.webp', label: 'Сон' },
  '☺': { file: '3418+face_relaxed_smiling.webp', label: 'Спокойствие' },
  '😟': { file: '3417+face_worried.webp', label: 'Беспокойство' },
  '😱': { file: '3416+face_fear_in_scream_screaming.webp', label: 'Крик' },
  '🙈': { file: '3359+evil_monkey_no_see.webp', label: 'Не вижу' },
  '💸': { file: '3358+money_wings.webp', label: 'Деньги' },
  '⌨': { file: '3357+keyboard.webp', label: 'Клавиатура' },
  '📝': { file: '3360+memo_pencil.webp', label: 'Заметка' },
};

export const AnimatedEmoji = memo(function AnimatedEmoji({ emoji, size = 24, className = '' }: AnimatedEmojiProps) {
  const key = normalizeEmoji(emoji);
  const webp = ANIMATED_WEBP_MAP[key];
  const perfMode = typeof document !== 'undefined' && document.body.classList.contains('perf-mode');

  // Анимированный webp (Telegram-стиль) — в perf-mode пропускаем ради CPU.
  if (webp && !perfMode) {
    return (
      <motion.span
        className={`inline-flex items-center justify-center relative select-none flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.9 }}
      >
        <img
          src={`/animated-emojis/${webp.file}`}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="w-full h-full object-contain"
        />
      </motion.span>
    );
  }

  const info = ANIMATED_EMOJI_MAP[key];

  if (!info) {
    // Custom TG-like fallback vector animated pill for unmapped unicode emojis
    return (
      <motion.span
        animate={{ scale: [1, 1.08, 1], rotate: [0, 2, -2, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className={`inline-flex items-center justify-center font-normal leading-none select-none ${className}`}
        style={{ fontSize: `${size}px`, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
      >
        {emoji}
      </motion.span>
    );
  }

  // Animated TG-style SVG / Canvas renderers for mapped emojis
  return (
    <motion.span
      className={`inline-flex items-center justify-center relative select-none flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      whileHover={{ scale: 1.25, rotate: [0, -8, 8, 0] }}
      whileTap={{ scale: 0.9 }}
    >
      {info.type === 'heart' && (
        <motion.svg
          animate={{ scale: [1, 1.15, 1, 1.2, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          viewBox="0 0 24 24"
          className="w-full h-full drop-shadow-[0_4px_12px_rgba(239,68,68,0.6)]"
          fill="url(#heart-grad)"
        >
          <defs>
            <linearGradient id="heart-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff4b72" />
              <stop offset="100%" stopColor="#d91b42" />
            </linearGradient>
          </defs>
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </motion.svg>
      )}

      {info.type === 'fire' && (
        <motion.svg
          animate={{ y: [0, -2, 0], scale: [1, 1.08, 0.96, 1] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
          viewBox="0 0 24 24"
          className="w-full h-full drop-shadow-[0_4px_12px_rgba(249,115,22,0.6)]"
          fill="url(#fire-grad)"
        >
          <defs>
            <linearGradient id="fire-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <path d="M12 23c4.97 0 9-3.58 9-8 0-4.42-3.8-6.16-5.5-10.5-.32-.82-1.42-.91-1.85-.14C12.3 6.78 11.5 8.5 10 9.5 8.5 10.5 7.5 9 7.5 9s-1.82 2.76-1.82 5c0 4.42 4.03 9 6.32 9z" />
        </motion.svg>
      )}

      {info.type === 'thumbsup' && (
        <motion.svg
          animate={{ rotate: [0, -10, 10, 0], y: [0, -2, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          viewBox="0 0 24 24"
          className="w-full h-full drop-shadow-[0_4px_12px_rgba(245,158,11,0.5)]"
          fill="url(#thumb-grad)"
        >
          <defs>
            <linearGradient id="thumb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
          </defs>
          <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.58 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
        </motion.svg>
      )}

      {info.type === 'laugh' && (
        <motion.div
          animate={{ rotate: [-4, 4, -4], y: [0, -1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
          className="w-full h-full rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 shadow-[0_4px_12px_rgba(234,179,8,0.5)] flex items-center justify-center relative overflow-hidden"
        >
          <span className="text-[10px] font-black text-amber-950 font-sans tracking-tighter">XD</span>
        </motion.div>
      )}

      {info.type === 'tada' && (
        <motion.svg
          animate={{ scale: [1, 1.15, 1], rotate: [-10, 10, -10] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
          viewBox="0 0 24 24"
          className="w-full h-full drop-shadow-[0_4px_12px_rgba(168,85,247,0.6)]"
          fill="url(#tada-grad)"
        >
          <defs>
            <linearGradient id="tada-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
        </motion.svg>
      )}

      {info.type === 'rocket' && (
        <motion.svg
          animate={{ y: [2, -3, 2], x: [-1, 1, -1] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          viewBox="0 0 24 24"
          className="w-full h-full drop-shadow-[0_4px_12px_rgba(139,92,246,0.6)]"
          fill="url(#rocket-grad)"
        >
          <defs>
            <linearGradient id="rocket-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
          <path d="M12 2.5s-4 4.5-4 9.5c0 2.21.89 4.21 2.34 5.66L9 21.5l3-1.5 3 1.5-1.34-3.84C15.11 16.21 16 14.21 16 12c0-5-4-9.5-4-9.5z" />
        </motion.svg>
      )}

      {!['heart', 'fire', 'thumbsup', 'laugh', 'tada', 'rocket'].includes(info.type) && (
        <motion.span
          animate={{ scale: [1, 1.1, 1], rotate: [-4, 4, -4] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="inline-block"
          style={{ fontSize: `${size * 0.85}px`, filter: `drop-shadow(0 4px 10px ${info.shadow})` }}
        >
          {emoji}
        </motion.span>
      )}
    </motion.span>
  );
});

// Сегментация по графемам (Intl.Segmenter) — эмодзи-последовательности типа
// ❤️, 🤷♂️, флаги остаются целыми. Фолбэк — regex по Emoji_Presentation.
const graphemeSegmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

const EMOJI_SEGMENT_RX = /(\p{Emoji_Presentation}\uFE0F?|\p{Emoji}\uFE0F)/gu;

// Helper function to render text replacing emojis with AnimatedEmoji elements
export function parseAnimatedEmojis(text: string, emojiSize = 20): React.ReactNode[] {
  if (!text) return [];

  const parts: string[] = graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(text), s => s.segment)
    : text.split(EMOJI_SEGMENT_RX).filter(Boolean);

  return parts.map((part, index) => {
    const key = normalizeEmoji(part);
    if (ANIMATED_WEBP_MAP[key] || ANIMATED_EMOJI_MAP[key]) {
      return <AnimatedEmoji key={index} emoji={part} size={emojiSize} className="mx-0.5 inline-align-middle" />;
    }
    return part;
  });
}
