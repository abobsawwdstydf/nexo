import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Flag, MessageSquare, BadgeCheck, Send, ShieldAlert, TicketPercent, Plus, Pause, Play, Trash2, Copy, BarChart3 } from 'lucide-react';
import { api } from '../lib/api';
import type { ApiClient } from '../lib/api/core';
import type { AdminReport, AdminFeedbackTicket, AdminPromoCode, AdminAnalyticsResponse } from '../lib/api/admin';
import { toast } from '../lib/toast';

type Tab = 'reports' | 'feedback' | 'badges' | 'promos' | 'analytics';

interface AdminPanelProps {
  onClose: () => void;
  /** API-РєР»РёРµРЅС‚: adminApi РґР»СЏ Р°РІС‚РѕРЅРѕРјРЅРѕР№ СЃС‚СЂР°РЅРёС†С‹ /admin, api вЂ” РІРЅСѓС‚СЂРё РјРµСЃСЃРµРЅРґР¶РµСЂР°. */
  client?: ApiClient;
}

function SectionHeader({ title, icon: Icon, onRefresh, loading }: {
  title: string;
  icon: typeof Flag;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        <Icon size={16} className="text-accent" />
        {title}
      </h3>
      <button
        onClick={onRefresh}
        className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
      >
        <motion.span
          animate={loading ? { rotate: 360 } : {}}
          transition={loading ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : {}}
          className="block"
        >
          <RefreshCwIcon />
        </motion.span>
      </button>
    </div>
  );
}

function RefreshCwIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export default function AdminPanel({ onClose, client = api }: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>('reports');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [feedback, setFeedback] = useState<AdminFeedbackTicket[]>([]);
  const [loading, setLoading] = useState(false);

  // Badge form
  const [badgeTarget, setBadgeTarget] = useState('');
  const [badgeType, setBadgeType] = useState('verified');
  const [badgeUrl, setBadgeUrl] = useState('');

  // Promo codes
  const [promos, setPromos] = useState<AdminPromoCode[]>([]);
  const [promosLoading, setPromosLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AdminAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [promoForm, setPromoForm] = useState({ code: '', discountPercent: 20, maxUses: 100, active: true, expiresAt: '' });
  const [promoSaving, setPromoSaving] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const items = await client.getAdminReports();
      setReports(items);
    } catch (err) {
      console.error('Failed to load reports:', err);
      toast.error('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Р¶Р°Р»РѕР±С‹');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const items = await client.getAdminFeedback();
      setFeedback(items);
    } catch (err) {
      console.error('Failed to load feedback:', err);
      toast.error('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РѕР±СЂР°С‰РµРЅРёСЏ');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPromos = useCallback(async () => {
    setPromosLoading(true);
    try {
      setPromos(await client.getAdminPromoCodes());
    } catch (err) {
      console.error('Failed to load promos:', err);
      toast.error('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РїСЂРѕРјРѕРєРѕРґС‹');
    } finally {
      setPromosLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      setAnalytics(await client.getAdminAnalytics());
    } catch (err) {
      console.error('Failed to load analytics:', err);
      toast.error('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Р°РЅР°Р»РёС‚РёРєСѓ');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'reports') loadReports();
    if (tab === 'feedback') loadFeedback();
    if (tab === 'promos') loadPromos();
    if (tab === 'analytics') loadAnalytics();
  }, [tab, loadReports, loadFeedback, loadPromos]);

  const handleReply = async (chatId: string) => {
    const content = window.prompt('РћС‚РІРµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ:');
    if (!content || !content.trim()) return;
    try {
      await client.adminReplyFeedback(chatId, content.trim());
      toast.success('РћС‚РІРµС‚ РѕС‚РїСЂР°РІР»РµРЅ');
      loadFeedback();
    } catch (err) {
      console.error('Failed to reply:', err);
      toast.error('РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РѕС‚РІРµС‚');
    }
  };

  const handleGrantBadge = async () => {
    if (!badgeTarget.trim() || !badgeUrl.trim()) {
      toast.error('РЈРєР°Р¶Рё ID РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё URL Р±РµР№РґР¶Р°');
      return;
    }
    try {
      await client.adminSetBadge({ targetId: badgeTarget.trim(), badgeType, badgeUrl: badgeUrl.trim() });
      toast.success('Р‘РµР№РґР¶ РІС‹РґР°РЅ');
      setBadgeTarget('');
      setBadgeUrl('');
    } catch (err) {
      console.error('Failed to grant badge:', err);
      toast.error('РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РґР°С‚СЊ Р±РµР№РґР¶');
    }
  };

  const handleClearBadge = async () => {
    if (!badgeTarget.trim()) {
      toast.error('РЈРєР°Р¶Рё ID РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ');
      return;
    }
    try {
      await client.adminClearBadge(badgeTarget.trim());
      toast.success('Р‘РµР№РґР¶ СЃРЅСЏС‚');
      setBadgeTarget('');
    } catch (err) {
      console.error('Failed to clear badge:', err);
      toast.error('РќРµ СѓРґР°Р»РѕСЃСЊ СЃРЅСЏС‚СЊ Р±РµР№РґР¶');
    }
  };

  const handleCreatePromo = async () => {
    if (!promoForm.code.trim()) {
      toast.error('РЈРєР°Р¶Рё РєРѕРґ РїСЂРѕРјРѕРєРѕРґР°');
      return;
    }
    if (promoForm.discountPercent < 1 || promoForm.discountPercent > 99) {
      toast.error('РЎРєРёРґРєР°: 1вЂ“99%');
      return;
    }
    setPromoSaving(true);
    try {
      await client.adminCreatePromoCode({
        code: promoForm.code.trim().toUpperCase(),
        discountPercent: promoForm.discountPercent,
        maxUses: promoForm.maxUses,
        active: promoForm.active,
        expiresAt: promoForm.expiresAt || undefined,
      });
      toast.success('РџСЂРѕРјРѕРєРѕРґ СЃРѕР·РґР°РЅ');
      setPromoForm({ code: '', discountPercent: 20, maxUses: 100, active: true, expiresAt: '' });
      loadPromos();
    } catch (err) {
      console.error('Failed to create promo:', err);
      toast.error('РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РїСЂРѕРјРѕРєРѕРґ');
    } finally {
      setPromoSaving(false);
    }
  };

  const handleTogglePromo = async (p: AdminPromoCode) => {
    try {
      await client.adminUpdatePromoCode(p.id, { active: !p.active });
      loadPromos();
    } catch {
      toast.error('РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ РїСЂРѕРјРѕРєРѕРґ');
    }
  };

  const handleDeletePromo = async (p: AdminPromoCode) => {
    if (!window.confirm(`РЈРґР°Р»РёС‚СЊ РїСЂРѕРјРѕРєРѕРґ ${p.code}?`)) return;
    try {
      await client.adminDeletePromoCode(p.id);
      toast.success('РџСЂРѕРјРѕРєРѕРґ СѓРґР°Р»С‘РЅ');
      loadPromos();
    } catch {
      toast.error('РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РїСЂРѕРјРѕРєРѕРґ');
    }
  };

  const handleCopyPromo = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('РљРѕРґ СЃРєРѕРїРёСЂРѕРІР°РЅ');
  };

  const TABS: { id: Tab; label: string; icon: typeof Flag }[] = [
    { id: 'reports', label: 'Р–Р°Р»РѕР±С‹', icon: Flag },
    { id: 'feedback', label: 'РћР±СЂР°С‚РЅР°СЏ СЃРІСЏР·СЊ', icon: MessageSquare },
    { id: 'badges', label: 'Р‘РµР№РґР¶Рё', icon: BadgeCheck },
    { id: 'promos', label: 'РџСЂРѕРјРѕРєРѕРґС‹', icon: TicketPercent },
    { id: 'analytics', label: 'РђРЅР°Р»РёС‚РёРєР°', icon: BarChart3 },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <motion.div
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 16 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="relative w-full max-w-2xl max-h-[80vh] flex flex-col rounded-3xl liquid-glass-strong border border-white/[0.1] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500/25 to-orange-500/25 border border-red-500/25 flex items-center justify-center">
            <ShieldAlert size={17} className="text-red-300" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white">РџР°РЅРµР»СЊ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°</h2>
            <p className="text-[11px] text-white/40">РњРѕРґРµСЂР°С†РёСЏ РїР»Р°С‚С„РѕСЂРјС‹</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white/70 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 pt-3 pb-2 border-b border-white/[0.06] overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                tab === t.id
                  ? 'bg-white/[0.12] text-white border border-white/[0.1]'
                  : 'bg-white/[0.04] text-white/50 hover:text-white/70 border border-transparent'
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'reports' && (
            <div>
              <SectionHeader title="Р–Р°Р»РѕР±С‹ РЅР° С‡Р°С‚С‹ Рё РјРѕРґРµСЂР°С†РёСЏ" icon={Flag} onRefresh={loadReports} loading={loading} />
              {reports.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-10">Р–Р°Р»РѕР± РїРѕРєР° РЅРµС‚</p>
              ) : (
                <div className="space-y-2">
                  {reports.map(r => (
                    <div key={r.id} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white">
                          {r.chatName || '(С‡Р°С‚ СѓРґР°Р»С‘РЅ)'}
                        </span>
                        <span className="text-[11px] text-white/30 flex-shrink-0">
                          {new Date(r.createdAt).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        РџРѕР¶Р°Р»РѕРІР°Р»СЃСЏ: <span className="text-white/70">{r.actorName || r.actorId}</span>
                        {' В· '}РўРёРї: <span className="text-white/70">{r.action}</span>
                        {r.duration > 0 && <> В· <span className="text-white/70">{r.duration} РјРёРЅ</span></>}
                      </div>
                      {r.reason && (
                        <p className="mt-2 text-xs text-white/60 bg-white/[0.04] rounded-xl px-3 py-2">
                          В«{r.reason}В»
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'feedback' && (
            <div>
              <SectionHeader title="РћР±СЂР°С‰РµРЅРёСЏ РІ РїРѕРґРґРµСЂР¶РєСѓ" icon={MessageSquare} onRefresh={loadFeedback} loading={loading} />
              {feedback.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-10">РћР±СЂР°С‰РµРЅРёР№ РїРѕРєР° РЅРµС‚</p>
              ) : (
                <div className="space-y-2">
                  {feedback.map(t => (
                    <div key={t.chatId} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white">{t.name || 'Р‘РµР· РЅР°Р·РІР°РЅРёСЏ'}</span>
                        <span className="text-[11px] text-white/30 flex-shrink-0">
                          {new Date(t.lastAt).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-white/40">
                        РЎРѕРѕР±С‰РµРЅРёР№: {t.messageCount}
                        {t.lastMessage?.content && (
                          <p className="mt-1.5 text-white/60 bg-white/[0.05] rounded-xl px-3 py-2 line-clamp-2">
                            {t.lastMessage.content}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleReply(t.chatId)}
                        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/15 hover:bg-accent/25 text-accent text-xs font-medium transition-colors"
                      >
                        <MessageSquare size={12} />
                        РћС‚РІРµС‚РёС‚СЊ
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'badges' && (
            <div>
              <SectionHeader title="Р’С‹РґР°С‡Р° Р±РµР№РґР¶РµР№" icon={BadgeCheck} onRefresh={() => {}} loading={false} />
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
                <div>
                  <label className="block text-[11px] text-white/40 mb-1">ID РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (targetId)</label>
                  <input
                    value={badgeTarget}
                    onChange={e => setBadgeTarget(e.target.value)}
                    placeholder="user_id"
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-white/40 mb-1">РўРёРї Р±РµР№РґР¶Р°</label>
                  <select
                    value={badgeType}
                    onChange={e => setBadgeType(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                  >
                    {['verified', 'premium', 'developer', 'moderator'].map(t => (
                      <option key={t} value={t} className="bg-[#12121a]">{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-white/40 mb-1">URL Р±РµР№РґР¶Р°</label>
                  <input
                    value={badgeUrl}
                    onChange={e => setBadgeUrl(e.target.value)}
                    placeholder="https://img.darkheavens.ru/badges/verified.png"
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/30"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleGrantBadge}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors"
                  >
                    <BadgeCheck size={13} />
                    Р’С‹РґР°С‚СЊ Р±РµР№РґР¶
                  </button>
                  <button
                    onClick={handleClearBadge}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-semibold transition-colors"
                  >
                    <SparkleIcon />
                    РЎРЅСЏС‚СЊ Р±РµР№РґР¶
                  </button>
                </div>
              </div>
            </div>
          )}
        {tab === 'analytics' && (
          <div>
            <SectionHeader title="РђРЅР°Р»РёС‚РёРєР°" icon={BarChart3} onRefresh={loadAnalytics} loading={analyticsLoading} />
            {!analytics ? (
              <div className="space-y-3 animate-pulse">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
                  ))}
                </div>
                <div className="h-44 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
                <div className="h-32 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
              </div>
            ) : (
              <AnalyticsView analytics={analytics} />
            )}
          </div>
        )}

        {tab === 'promos' && (
            <div>
              <SectionHeader title="РџСЂРѕРјРѕРєРѕРґС‹ РЅР° РќСѓР§Рµ" icon={TicketPercent} onRefresh={loadPromos} loading={promosLoading} />

              {/* Create form */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3 mb-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-white/40 mb-1">РљРѕРґ</label>
                    <input
                      value={promoForm.code}
                      onChange={e => setPromoForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                      placeholder="SUMMER2026"
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 uppercase outline-none focus:border-white/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/40 mb-1">РЎРєРёРґРєР°, %</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={promoForm.discountPercent}
                      onChange={e => setPromoForm(p => ({ ...p, discountPercent: Number(e.target.value) }))}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/40 mb-1">Р›РёРјРёС‚ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёР№ (0 = в€ћ)</label>
                    <input
                      type="number"
                      min={0}
                      value={promoForm.maxUses}
                      onChange={e => setPromoForm(p => ({ ...p, maxUses: Number(e.target.value) }))}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/40 mb-1">Р”РµР№СЃС‚РІСѓРµС‚ РґРѕ (РѕРїС†.)</label>
                    <input
                      type="date"
                      value={promoForm.expiresAt}
                      onChange={e => setPromoForm(p => ({ ...p, expiresAt: e.target.value }))}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-xs text-white/60 pb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={promoForm.active}
                        onChange={e => setPromoForm(p => ({ ...p, active: e.target.checked }))}
                        className="accent-amber-500"
                      />
                      РђРєС‚РёРІРµРЅ
                    </label>
                  </div>
                </div>
                <button
                  onClick={handleCreatePromo}
                  disabled={promoSaving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors disabled:opacity-40"
                >
                  <Plus size={13} />
                  {promoSaving ? 'РЎРѕР·РґР°РЅРёРµ...' : 'РЎРѕР·РґР°С‚СЊ РїСЂРѕРјРѕРєРѕРґ'}
                </button>
              </div>

              {/* List */}
              {promos.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-8">РџСЂРѕРјРѕРєРѕРґРѕРІ РїРѕРєР° РЅРµС‚</p>
              ) : (
                <div className="space-y-2">
                  {promos.map(p => (
                    <div key={p.id} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            onClick={() => handleCopyPromo(p.code)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] font-mono text-sm font-semibold text-amber-300 transition-colors"
                            title="РЎРєРѕРїРёСЂРѕРІР°С‚СЊ"
                          >
                            {p.code}
                            <Copy size={11} className="text-white/40" />
                          </button>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.active ? 'bg-green-500/15 text-green-400' : 'bg-white/[0.06] text-white/40'}`}>
                            {p.active ? 'Р°РєС‚РёРІРµРЅ' : 'РІС‹РєР»'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-white/70">в€’{p.discountPercent}%</span>
                          <span className="text-[10px] text-white/35">
                            {p.usedCount}/{p.maxUses === 0 ? 'в€ћ' : p.maxUses}
                          </span>
                          {p.expiresAt && (
                            <span className="text-[10px] text-white/35">
                              РґРѕ {new Date(p.expiresAt).toLocaleDateString('ru-RU')}
                            </span>
                          )}
                          <button
                            onClick={() => handleTogglePromo(p)}
                            className={`p-1.5 rounded-lg transition-colors ${p.active ? 'text-white/40 hover:text-white' : 'text-green-400 hover:text-green-300'}`}
                            title={p.active ? 'РћС‚РєР»СЋС‡РёС‚СЊ' : 'Р’РєР»СЋС‡РёС‚СЊ'}
                          >
                            {p.active ? <Pause size={13} /> : <Play size={13} />}
                          </button>
                          <button
                            onClick={() => handleDeletePromo(p)}
                            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 transition-colors"
                            title="РЈРґР°Р»РёС‚СЊ"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 Р‘';
  const units = ['Р‘', 'РљР‘', 'РњР‘', 'Р“Р‘', 'РўР‘'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const v = bytes / Math.pow(1024, i);
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function AnalyticsView({ analytics }: { analytics: AdminAnalyticsResponse }) {
  const { totals, daily, topChats } = analytics;
  const maxMessages = Math.max(...daily.map(d => d.messages), 1);

  const counters: [string, number, string?][] = [
    ['РџРѕР»СЊР·РѕРІР°С‚РµР»Рё', totals.totalUsers],
    ['Р§Р°С‚С‹', totals.totalChats],
    ['РЎРѕРѕР±С‰РµРЅРёСЏ', totals.totalMessages],
    ['РњРµРґРёР°', totals.totalMedia, formatBytes(totals.mediaSizeBytes)],
    ['РСЃС‚РѕСЂРёРё', totals.totalStories],
    ['РџР»Р°С‚РµР¶Рё', totals.totalPayments],
    ['Premium', totals.premiumUsers],
    ['Р–Р°Р»РѕР±С‹', totals.totalReports],
  ];

  return (
    <div className="space-y-4">
      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {counters.map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
            <div className="text-[11px] text-white/40">{label}</div>
            <div className="text-xl font-bold text-white mt-0.5 tabular-nums">
              {value.toLocaleString('ru-RU')}
            </div>
            {hint && <div className="text-[10px] text-white/35">{hint}</div>}
          </div>
        ))}
      </div>

      {/* 30-day histogram */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h4 className="text-xs font-semibold text-white">РђРєС‚РёРІРЅРѕСЃС‚СЊ Р·Р° 30 РґРЅРµР№</h4>
          <span className="text-[10px] text-white/35">РІС‹СЃРѕС‚Р° вЂ” СЃРѕРѕР±С‰РµРЅРёСЏ В· С‡РёСЃР»Рѕ РїРѕРґ СЃС‚РѕР»Р±С†РѕРј вЂ” Р°РєС‚РёРІРЅС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»Рё</span>
        </div>
        <div className="flex items-end gap-[2px] h-24">
          {daily.map(d => (
            <div
              key={d.date}
              title={`${d.date} В· Р°РєС‚РёРІРЅС‹Рµ: ${d.activeUsers} В· РЅРѕРІС‹Рµ: ${d.newUsers} В· СЃРѕРѕР±С‰РµРЅРёСЏ: ${d.messages}`}
              className="flex-1 min-w-0 bg-gradient-to-t from-accent/40 to-accent/90 rounded-t-[3px] cursor-default"
              style={{ height: `${Math.max((d.messages / maxMessages) * 100, 2)}%` }}
            />
          ))}
        </div>
        <div className="flex gap-[2px] mt-1.5">
          {daily.map(d => (
            <div key={d.date} className="flex-1 min-w-0 text-center text-[8px] leading-none text-white/45 tabular-nums">
              {d.activeUsers > 0 ? d.activeUsers : ''}
            </div>
          ))}
        </div>
        <div className="flex gap-[2px] mt-1.5">
          {daily.map((d, i) => (
            <div key={d.date} className="flex-1 min-w-0 text-center text-[8px] leading-none text-white/25 tabular-nums">
              {i % 5 === 4 || i === daily.length - 1 ? `${d.date.slice(8)}.${d.date.slice(5, 7)}` : ''}
            </div>
          ))}
        </div>
      </div>

      {/* Top chats */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
        <h4 className="text-xs font-semibold text-white mb-3">РўРѕРї-10 С‡Р°С‚РѕРІ РїРѕ СЃРѕРѕР±С‰РµРЅРёСЏРј</h4>
        {topChats.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-6">РЎРѕРѕР±С‰РµРЅРёР№ РїРѕРєР° РЅРµС‚</p>
        ) : (
          <div className="space-y-1.5">
            {topChats.map((ch, i) => (
              <div key={ch.chatId} className="flex items-center gap-3 rounded-xl px-3 py-2 bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                <span className="w-5 text-center text-[11px] font-semibold text-white/30 tabular-nums">{i + 1}</span>
                <span className="flex-1 min-w-0 truncate text-xs text-white/80">{ch.name}</span>
                <span className="text-[11px] text-white/50 tabular-nums">{ch.messageCount.toLocaleString('ru-RU')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </svg>
  );
}

function AlertTriangle() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}