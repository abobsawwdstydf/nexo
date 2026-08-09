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
  Users,
  Coins,
  FileText,
  Mail,
  Cake,
  QrCode,
  Share2,
  Pencil,
} from 'lucide-react';
import QRCodeLib from 'qrcode';
import type { User } from '../lib/types';
import { VerifiedBadge } from './VerifiedBadge';
import { toast } from '../lib/toast';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { getInviteLink } from '../lib/getDomain';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { getInitials } from '../lib/initials';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [showQr, setShowQr] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(user.displayName || '');
  const [draftBio, setDraftBio] = useState(user.bio || '');
  const [saving, setSaving] = useState(false);

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(`@${user.username}`);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  const handleShare = async () => {
    const link = getInviteLink(user.username);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${user.displayName || user.username} в Нексо`, text: `Присоединяйтесь: ${link}` });
        return;
      } catch { /* user cancelled */ }
    }
    navigator.clipboard.writeText(link);
    toast.success('Ссылка на профиль скопирована');
  };

  const renderQr = useCallback(() => {
    if (!qrRef.current) return;
    QRCodeLib.toCanvas(qrRef.current, getInviteLink(user.username), {
      width: 220,
      margin: 1,
      color: { dark: '#09090f', light: '#ffffff' },
    }).catch(() => toast.error('Не удалось создать QR-код'));
  }, [user.username]);

  useEffect(() => {
    if (showQr) renderQr();
  }, [showQr, renderQr]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Keep drafts in sync when the profile data changes
  useEffect(() => {
    if (!editing) {
      setDraftName(user.displayName || '');
      setDraftBio(user.bio || '');
    }
  }, [user.displayName, user.bio, editing]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const media = await api.uploadFile(file);
      const updated = await api.updateProfile({ avatar: media.url });
      useAuthStore.getState().updateUser({ avatar: updated.avatar || media.url });
      toast.success('Аватар обновлён');
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось обновить аватар');
    }
  };

  const handleSaveProfile = async () => {
    if (saving) return;
    try {
      setSaving(true);
      const updated = await api.updateProfile({
        displayName: draftName.trim(),
        bio: draftBio.trim(),
      });
      useAuthStore.getState().updateUser({ displayName: updated.displayName, bio: updated.bio });
      setEditing(false);
      toast.success('Профиль сохранён');
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const initials = getInitials(user.displayName || user.username);

  const premiumColor = user.isPremium
    ? 'from-amber-400 via-yellow-300 to-orange-400'
    : 'from-zinc-800 via-zinc-900 to-black';

  const fmtDate = (iso?: string | null): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const memberSince = fmtDate(user.createdAt);
  const birthday = fmtDate(user.birthday);
  const premiumUntil = fmtDate(user.premiumUntil);

  const details = [
    ...(user.beavers != null ? [{ Icon: Coins, label: 'Бобры', value: String(user.beavers) }] : []),
    ...(user.subscribersCount != null ? [{ Icon: Users, label: 'Подписчики', value: String(user.subscribersCount) }] : []),
    ...(user.postsCount != null ? [{ Icon: FileText, label: 'Посты', value: String(user.postsCount) }] : []),
    ...(memberSince ? [{ Icon: Calendar, label: 'В Нексо с', value: memberSince }] : []),
    ...(user.isPremium && premiumUntil ? [{ Icon: Star, label: 'Премиум до', value: premiumUntil }] : []),
    ...(birthday ? [{ Icon: Cake, label: 'День рождения', value: birthday }] : []),
    ...(user.email ? [{ Icon: Mail, label: 'Email', value: user.email }] : []),
    ...(user.profileMusic ? [{ Icon: Music, label: 'Музыка', value: user.profileMusic }] : []),
  ];

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
                <img src={normalizeMediaUrl(user.avatar)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white/60">{initials}</span>
                </div>
              )}
            </div>
            <motion.button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-3xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              whileHover={{ scale: 1.02 }}
            >
              <Camera size={20} className="text-white/80" />
            </motion.button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        {/* ─── Info ───────────────────────────────────────────────── */}
        <div className="px-6 pt-3 pb-6 text-center">
          <div className="flex items-center justify-center gap-2">
            {editing ? (
              <input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                maxLength={32}
                autoFocus
                className="w-full max-w-[220px] text-center text-lg font-bold bg-white/[0.06] border border-white/[0.12] rounded-xl px-3 py-1 text-white/90 outline-none focus:border-accent/40 text-white"
              />
            ) : (
              <h1 className="text-xl font-bold text-white/90 font-display">
                {user.displayName || user.username}
              </h1>
            )}
            <VerifiedBadge
              isVerified={user.isVerified}
              badgeUrl={user.verifiedBadgeUrl}
              badgeType={user.verifiedBadgeType}
              size={18}
            />
            {user.isPremium && <Star size={16} className="text-amber-400 fill-amber-400" />}
            <button
              onClick={() => setEditing(v => !v)}
              className="p-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white/80 transition-all"
              title={editing ? 'Отменить' : 'Редактировать профиль'}
            >
              <Pencil size={12} />
            </button>
          </div>

          <button
            onClick={handleCopyUsername}
            className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs text-white/50 hover:text-white/80 transition-all"
          >
            <AtSign size={12} />
            @{user.username}
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          </button>

          {editing ? (
            <textarea
              value={draftBio}
              onChange={e => setDraftBio(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="Расскажите о себе..."
              className="w-full max-w-xs mx-auto mt-3 text-xs bg-white/[0.06] border border-white/[0.12] rounded-xl px-3 py-2 text-white/80 placeholder:text-white/25 outline-none focus:border-accent/40 resize-none"
            />
          ) : user.bio ? (
            <p className="mt-3 text-xs text-white/60 leading-relaxed max-w-xs mx-auto">
              {user.bio}
            </p>
          ) : null}

          {editing && (
            <button
              onClick={handleSaveProfile}
              disabled={saving || !draftName.trim()}
              className="mt-3 px-5 py-1.5 rounded-xl bg-accent/20 hover:bg-accent/30 border border-accent/30 text-xs font-medium text-accent transition-all disabled:opacity-40"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          )}

          {/* Status */}
          <div className="flex items-center justify-center gap-4 mt-3 text-xs">
            <span className={`flex items-center gap-1.5 ${user.isOnline ? 'text-green-400 font-medium' : 'text-white/40'}`}>
              <span className={`w-2 h-2 rounded-full ${user.isOnline ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
              {user.isOnline ? 'В сети' : 'Не в сети'}
            </span>
          </div>

          {/* Details grid */}
          {details.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-5 text-left">
              {details.map(({ Icon, label, value }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.06]"
                >
                  <Icon size={14} className="shrink-0 text-white/40" />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-white/35 truncate">{label}</div>
                    <div className="text-xs text-white/80 truncate">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

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
            <button
              onClick={() => setShowQr(true)}
              className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-white/80 transition-all"
            >
              <QrCode size={15} />
              QR-код
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-white/80 transition-all"
            >
              <Share2 size={15} />
              Поделиться
            </button>
          </div>
        </div>

        {/* ─── QR overlay ─────────────────────────────────────────── */}
        {showQr && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0a0a0f]/95 backdrop-blur-md rounded-none md:rounded-3xl px-6">
            <motion.button
              onClick={() => setShowQr(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/40 border border-white/[0.08] hover:bg-white/[0.1] transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <X size={18} className="text-white/70" />
            </motion.button>
            <div className="text-center">
              <div className="inline-block rounded-2xl bg-white p-3 shadow-2xl">
                <canvas ref={qrRef} width={220} height={220} />
              </div>
              <p className="mt-4 text-sm font-semibold text-white/90">@{user.username}</p>
              <p className="mt-1 text-[11px] text-white/40">Сканируйте, чтобы открыть профиль</p>
              <button
                onClick={handleShare}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/20 text-xs text-accent font-medium transition-all"
              >
                <Share2 size={13} />
                Поделиться ссылкой
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
