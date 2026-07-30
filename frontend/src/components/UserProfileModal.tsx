import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'lucide-react';
import type { User } from '../lib/types';

interface UserProfileModalProps {
  user: User;
  onClose: () => void;
  onOpenSettings: (tab?: string) => void;
  onLogout: () => void;
}

export default function UserProfileModal({ user, onClose, onOpenSettings, onLogout }: UserProfileModalProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(`@${user.username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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

        {/* ─── Divider ────────────────────────────────────────────── */}
        <div className="mx-6 h-px bg-white/[0.06]" />

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
