import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  FileAudio,
} from 'lucide-react';
import type { User } from '../lib/types';
import { VerifiedBadge } from './VerifiedBadge';
import { toast } from '../lib/toast';

interface UserProfileModalProps {
  user: User;
  onClose: () => void;
  onOpenSettings: (tab?: string) => void;
  onLogout: () => void;
  onOpenAdmin?: () => void;
}

export default function UserProfileModal({ user, onClose, onOpenSettings, onLogout, onOpenAdmin }: UserProfileModalProps) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(`@${user.username}`);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  const initials = (user.displayName || user.username || '?')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const premiumColor = user.isPremium
    ? 'from-amber-400 via-yellow-300 to-orange-400'
    : 'from-zinc-800 via-zinc-900 to-black';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 40 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="relative w-full h-full md:h-auto md:max-h-[85vh] max-w-none md:max-w-[440px] rounded-none md:rounded-3xl liquid-glass-strong overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <motion.button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/40 border border-white/[0.08] hover:bg-white/[0.1] transition-all"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <X size={18} className="text-white/70" />
        </motion.button>

        {/* ─── Banner ─────────────────────────────────────────────── */}
        <div className={`h-36 bg-gradient-to-br ${premiumColor} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-4 -left-4 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        </div>

        {/* ─── Avatar ─────────────────────────────────────────────── */}
        <div className="flex justify-center -mt-14 relative z-10">
          <div className="relative group">
            <div className="w-28 h-28 rounded-3xl overflow-hidden ring-4 ring-[#0a0a0f] shadow-2xl">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white/60">{initials}</span>
                </div>
              )}
            </div>
            <motion.button
              className="absolute inset-0 rounded-3xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              whileHover={{ scale: 1.02 }}
            >
              <Camera size={20} className="text-white/80" />
            </motion.button>
          </div>
        </div>

        {/* ─── Info ───────────────────────────────────────────────── */}
        <div className="px-6 pt-3 pb-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl font-bold text-white/90 font-display">
              {user.displayName || user.username}
            </h1>
            <VerifiedBadge
              isVerified={user.isVerified}
              badgeUrl={user.verifiedBadgeUrl}
              badgeType={user.verifiedBadgeType}
              size={18}
            />
            {user.isPremium && <Star size={16} className="text-amber-400 fill-amber-400" />}
          </div>

          <button
            onClick={handleCopyUsername}
            className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs text-white/50 hover:text-white/80 transition-all"
          >
            <AtSign size={12} />
            @{user.username}
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          </button>

          {user.bio && (
            <p className="mt-3 text-xs text-white/60 leading-relaxed max-w-xs mx-auto">
              {user.bio}
            </p>
          )}

          {/* Status */}
          <div className="flex items-center justify-center gap-4 mt-3 text-xs">
            <span className={`flex items-center gap-1.5 ${user.isOnline ? 'text-green-400 font-medium' : 'text-white/40'}`}>
              <span className={`w-2 h-2 rounded-full ${user.isOnline ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
              {user.isOnline ? 'В сети' : 'Не в сети'}
            </span>
          </div>

          {/* Quick Action buttons */}
          <div className="grid grid-cols-2 gap-2 mt-6">
            {user.isAdmin && onOpenAdmin && (
              <button
                onClick={() => { onClose(); onOpenAdmin(); }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-accent/15 hover:bg-accent/25 border border-accent/20 text-xs font-medium text-accent transition-all col-span-2"
              >
                <Shield size={15} />
                Панель модерации
              </button>
            )}
            <button
              onClick={() => { onClose(); onOpenSettings('general'); }}
              className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-white/80 transition-all"
            >
              <Settings size={15} />
              Настройки
            </button>
            <button
              onClick={() => { onClose(); onLogout(); }}
              className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/20 text-xs font-medium text-rose-300 transition-all"
            >
              <LogOut size={15} />
              Выйти
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
