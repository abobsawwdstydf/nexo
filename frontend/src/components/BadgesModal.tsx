import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Award, Eye, EyeOff, Lock } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import SidePanelWrapper from './SidePanelWrapper';

interface Badge {
  id: string;
  badgeId: string;
  awardedAt: string;
  isVisible: boolean;
  badge: {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    condition: string;
    conditionValue: number;
  };
}

interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  condition: string;
  conditionValue: number;
}

interface BadgesModalProps {
  userId?: string;
  onClose: () => void;
  isSelf?: boolean;
  embedded?: boolean;
}

export default function BadgesModal({ userId, onClose, isSelf = false, embedded }: BadgesModalProps) {
  const { user } = useAuthStore();
  const { success, error: showError } = useToastStore();
  const [myBadges, setMyBadges] = useState<Badge[]>([]);
  const [allDefinitions, setAllDefinitions] = useState<BadgeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const targetUserId = userId || user?.id;
  const isOwn = isSelf || targetUserId === user?.id;

  useEffect(() => {
    loadBadges();
    if (isOwn) {
      loadDefinitions();
    }
  }, [targetUserId]);

  const loadBadges = async () => {
    try {
      const endpoint = isOwn ? '/badges/my' : `/badges/user/${targetUserId}`;
      const data = await api.get<{ badges: Badge[] }>(endpoint);
      setMyBadges(data.badges || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const loadDefinitions = async () => {
    try {
      const data = await api.get<{ badges: BadgeDefinition[] }>('/badges/definitions');
      setAllDefinitions(data.badges || []);
    } catch {
      // ignore
    }
  };

  const toggleVisibility = async (badgeId: string, isVisible: boolean) => {
    try {
      await api.put(`/badges/${badgeId}/visibility`, { isVisible: !isVisible });
      setMyBadges(prev =>
        prev.map(b => b.badgeId === badgeId ? { ...b, isVisible: !isVisible } : b)
      );
    } catch (e: any) {
      showError(e.message || 'Ошибка');
    }
  };

  const checkBadges = async () => {
    setChecking(true);
    try {
      const data = await api.post<{ awarded: string[] }>('/badges/check', {});
      if (data.awarded.length > 0) {
        success(`Получено новых значков: ${data.awarded.length}!`);
        loadBadges();
      } else {
        success('Новых значков нет');
      }
    } catch (e: any) {
      showError(e.message || 'Ошибка');
    } finally {
      setChecking(false);
    }
  };

  const earnedBadgeIds = new Set(myBadges.map(b => b.badgeId));
  const unearnedBadges = allDefinitions.filter(d => !earnedBadgeIds.has(d.id));

  return (
    <SidePanelWrapper
      onClose={onClose}
      embedded={embedded}
      title={`Значки${isSelf ? ` (${myBadges.filter(b => b.isVisible).length})` : ''}`}
      icon={<Award size={15} className="text-yellow-400" />}
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Earned badges */}
              {myBadges.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
                    Полученные ({myBadges.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {myBadges.map(userBadge => (
                      <motion.div
                        key={userBadge.id}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`relative p-3 rounded-xl border transition-all ${
                          userBadge.isVisible
                            ? 'bg-white/5 border-white/10'
                            : 'bg-white/2 border-white/5 opacity-50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                            style={{ backgroundColor: userBadge.badge.color + '20' }}
                          >
                            {userBadge.badge.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{userBadge.badge.name}</p>
                            <p className="text-xs text-white/40 line-clamp-2">{userBadge.badge.description}</p>
                            <p className="text-xs text-white/25 mt-1">
                              {new Date(userBadge.awardedAt).toLocaleDateString('ru-RU')}
                            </p>
                          </div>
                        </div>
                        {isOwn && (
                          <button
                            onClick={() => toggleVisibility(userBadge.badgeId, userBadge.isVisible)}
                            className="absolute top-2 right-2 p-1 rounded-lg hover:bg-white/10 transition-colors"
                            title={userBadge.isVisible ? 'Скрыть' : 'Показать'}
                          >
                            {userBadge.isVisible
                              ? <Eye className="w-3.5 h-3.5 text-white/40" />
                              : <EyeOff className="w-3.5 h-3.5 text-white/20" />
                            }
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unearned badges (only for own profile) */}
              {isOwn && unearnedBadges.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">
                    Ещё не получены ({unearnedBadges.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {unearnedBadges.map(badge => (
                      <div
                        key={badge.id}
                        className="p-3 rounded-xl border border-white/5 bg-white/2 opacity-40"
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl flex-shrink-0 grayscale">
                            {badge.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white/60 truncate">{badge.name}</p>
                            <p className="text-xs text-white/30 line-clamp-2">{badge.description}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-white/20" />
                          <span className="text-xs text-white/20">Не получен</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {myBadges.length === 0 && !isOwn && (
                <div className="text-center py-12">
                  <Award className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40">Нет значков</p>
                </div>
              )}
            </>
          )}
      </div>
    </SidePanelWrapper>
  );
}
