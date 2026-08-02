import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Settings,
  Camera,
  Music,
  Calendar,
  AtSign,
  Shield,
  Bell,
  Palette,
  Star,
  ChevronRight,
  LogOut,
  Copy,
  Check,
  Play,
  Pause,
  SkipForward,
  Plus,
  Trash2,
} from 'lucide-react';
import type { User } from '../lib/types';
import { VerifiedBadge } from './VerifiedBadge';

interface UserProfileModalProps {
  user: User;
  onClose: () => void;
  onOpenSettings: (tab?: string) => void;
  onLogout: () => void;
}

interface ProfileTrack {
  title: string;
  url: string;
}

function loadTracks(): ProfileTrack[] {
  try {
    const raw = localStorage.getItem('nexo_profile_tracks');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function UserProfileModal({ user, onClose, onOpenSettings, onLogout }: UserProfileModalProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ─── Music player ───────────────────────────────────────────────
  const [tracks, setTracks] = useState<ProfileTrack[]>(loadTracks);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    localStorage.setItem('nexo_profile_tracks', JSON.stringify(tracks));
  }, [tracks]);

  // Stop music as soon as the modal is closed.
  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  useEffect(() => {
    const track = tracks[current];
    if (!track) {
      audioRef.current?.pause();
      return;
    }
    const audio = audioRef.current ?? (audioRef.current = new Audio());
    if (audio.src !== track.url) {
      audio.src = track.url;
      audio.preload = 'none';
    }
    audio.onended = () => setCurrent(i => (i + 1) % Math.max(tracks.length, 1));
    if (playing) {
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [playing, current, tracks]);

  const togglePlay = () => setPlaying(p => !p);

  const addTrack = () => {
    const title = newTitle.trim();
    const url = newUrl.trim();
    if (!title || !url) return;
    const next = [...tracks, { title, url }];
    setTracks(next);
    setCurrent(0);
    setNewTitle('');
    setNewUrl('');
    setAdding(false);
  };

  const removeTrack = (index: number) => {
    const wasPlayingCurrent = playing && current === index;
    const next = tracks.filter((_, i) => i !== index);
    setTracks(next);
    if (current >= next.length) setCurrent(Math.max(0, next.length - 1));
    if (wasPlayingCurrent) setPlaying(false);
  };

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(`@${user.username}`);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  const initials = (user.displayName || user.username || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const premiumColor = user.isPremium
    ? 'from-amber-400 via-yellow-300 to-orange-400'
    : 'from-zinc-600 to-zinc-700';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="relative w-full max-w-[420px] rounded-2xl liquid-glass-strong overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ─── Close ──────────────────────────────────────────────── */}
        <motion.button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-xl bg-black/40 border border-white/[0.06] hover:bg-white/[0.1] transition-all duration-200"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <X size={16} className="text-white/50" />
        </motion.button>

        {/* ─── Banner ─────────────────────────────────────────────── */}
        <div className={`h-24 bg-gradient-to-br ${premiumColor} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-white/5 blur-2xl" />
        </div>

        {/* ─── Avatar ─────────────────────────────────────────────── */}
        <div className="flex justify-center -mt-12 relative z-10">
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl overflow-hidden ring-4 ring-[#0f0f14] shadow-xl">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white/60">{initials}</span>
                </div>
              )}
            </div>
            <motion.button
              className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              whileHover={{ scale: 1.02 }}
            >
              <Camera size={18} className="text-white/70" />
            </motion.button>
          </div>
        </div>

        {/* ─── Info ───────────────────────────────────────────────── */}
        <div className="px-6 pt-3 pb-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-lg font-bold text-white/90 font-display">
              {user.displayName || user.username}
            </h1>
            <VerifiedBadge
              isVerified={user.isVerified}
              badgeUrl={user.verifiedBadgeUrl}
              badgeType={user.verifiedBadgeType}
              size={16}
            />
            {user.isPremium && <Star size={14} className="text-amber-400" />}
          </div>

          <button
            onClick={handleCopyUsername}
            className="inline-flex items-center gap-1.5 mt-1 text-xs text-white/40 hover:text-white/60 transition-all duration-200"
          >
            <AtSign size={11} />
            @{user.username}
            {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
          </button>

          {user.bio && (
            <p className="mt-3 text-sm text-white/60 leading-relaxed max-w-xs mx-auto">
              {user.bio}
            </p>
          )}

          {/* Status */}
          <div className="flex items-center justify-center gap-4 mt-3 text-[11px]">
            <span className={`flex items-center gap-1.5 ${user.isOnline ? 'text-green-400/70' : 'text-white/30'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${user.isOnline ? 'bg-green-400' : 'bg-white/20'}`} />
              {user.isOnline ? 'В сети' : 'Не в сети'}
            </span>
            {user.profileMusic && (
              <span className="flex items-center gap-1.5 text-white/30">
                <Music size={11} />
                {user.profileMusic}
              </span>
            )}
            {user.birthday && (
              <span className="flex items-center gap-1.5 text-white/30">
                <Calendar size={11} />
                {new Date(user.birthday).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </span>
            )}
          </div>
        </div>

        {/* ─── Music player ───────────────────────────────────────── */}
        {tracks.length > 0 && (
          <div className="px-5 py-3">
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-3 space-y-2">
              <div className="flex items-center gap-3">
                <motion.button
                  onClick={togglePlay}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  className="w-11 h-11 rounded-full bg-gradient-to-br from-accent to-accent-dark text-white flex items-center justify-center flex-shrink-0 shadow-[0_4px_16px_rgba(99,102,241,0.35)]"
                >
                  {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                </motion.button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/85 truncate">
                    {tracks[current]?.title || 'Нет трека'}
                  </p>
                  <p className="text-[10px] text-white/30">
                    {playing ? 'Сейчас играет' : 'На паузе'}
                  </p>
                </div>
                <motion.button
                  onClick={() => setCurrent(i => (i + 1) % tracks.length)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-full hover:bg-white/[0.08] transition-colors flex-shrink-0"
                >
                  <SkipForward size={16} className="text-white/40" />
                </motion.button>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {tracks.map((t, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer transition-colors ${
                      i === current ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                    }`}
                    onClick={() => { setCurrent(i); setPlaying(true); }}
                  >
                    <Music size={11} className={i === current ? 'text-accent' : 'text-white/20'} />
                    <span className={`text-[11px] truncate flex-1 ${i === current ? 'text-white/85' : 'text-white/45'}`}>
                      {t.title}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); removeTrack(i); }}
                      className="p-0.5 rounded hover:bg-white/[0.1] transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={10} className="text-white/25" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Add track form */}
        <div className="px-5 pb-1">
          {adding ? (
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-3 space-y-2">
              <div>
                <label className="block text-[10px] text-white/30 mb-1">Название трека</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Например: My Way"
                  className="w-full h-9 px-3 text-xs bg-white/[0.05] border border-white/[0.06] rounded-lg text-white/80 placeholder:text-white/20 outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="block text-[10px] text-white/30 mb-1">Ссылка на аудио</label>
                <input
                  type="text"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  placeholder="https://.../track.mp3"
                  className="w-full h-9 px-3 text-xs bg-white/[0.05] border border-white/[0.06] rounded-lg text-white/80 placeholder:text-white/20 outline-none focus:border-white/20"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setAdding(false)}
                  className="px-3 py-1.5 text-[11px] text-white/40 hover:text-white/60 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={addTrack}
                  disabled={!newTitle.trim() || !newUrl.trim()}
                  className="px-3 py-1.5 text-[11px] rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-white/70 transition-colors disabled:opacity-30"
                >
                  Добавить
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 text-[11px] text-white/30 hover:text-white/50 transition-colors"
            >
              <Plus size={12} />
              {tracks.length > 0 ? 'Добавить трек' : 'Добавить музыку в профиль'}
            </button>
          )}
        </div>

        {/* ─── Divider ────────────────────────────────────────────── */}
        <div className="mx-6 h-px bg-white/[0.06] mt-2" />

        {/* ─── Quick actions ──────────────────────────────────────── */}
        <div className="px-3 py-2 space-y-0.5">
          <ProfileAction
            icon={Bell}
            label="Уведомления"
            onClick={() => { onClose(); onOpenSettings('notifications'); }}
          />
          <ProfileAction
            icon={Palette}
            label="Внешний вид"
            onClick={() => { onClose(); onOpenSettings('appearance'); }}
          />
          <ProfileAction
            icon={Shield}
            label="Конфиденциальность"
            onClick={() => { onClose(); onOpenSettings('privacy'); }}
          />
          <ProfileAction
            icon={Settings}
            label="Все настройки"
            onClick={() => { onClose(); onOpenSettings('general'); }}
          />
        </div>

        {/* ─── Divider ────────────────────────────────────────────── */}
        <div className="mx-6 h-px bg-white/[0.06]" />

        {/* ─── Account info ───────────────────────────────────────── */}
        <div className="px-6 py-3">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-white/30">Создан</span>
            <span className="text-xs text-white/50">
              {new Date(user.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          {user.beavers !== undefined && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-white/30">Бобры</span>
              <span className="text-xs text-amber-400/70">{user.beavers}</span>
            </div>
          )}
        </div>

        {/* ─── Logout ─────────────────────────────────────────────── */}
        <div className="px-3 pb-3">
          <motion.button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.06] transition-all duration-200"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            <LogOut size={14} />
            Выйти из аккаунта
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProfileAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Settings;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all duration-200 group"
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center gap-3">
        <Icon size={15} className="text-white/30 group-hover:text-white/50 transition-all duration-200" />
        <span className="text-xs text-white/60 group-hover:text-white/80 transition-all duration-200">{label}</span>
      </div>
      <ChevronRight size={14} className="text-white/15 group-hover:text-white/30 transition-all duration-200" />
    </motion.button>
  );
}
