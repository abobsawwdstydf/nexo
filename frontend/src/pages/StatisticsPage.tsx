import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, MessageSquare, Image, Users, Calendar, Clock, TrendingUp, Download } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface Statistics {
  totalMessages: number;
  totalMedia: number;
  totalChats: number;
  accountAgeDays: number;
  topContacts: Array<{
    chatId: string;
    messageCount: number;
    chat: any;
  }>;
  hourlyActivity: Array<{
    hour: number;
    count: number;
  }>;
}

interface Activity {
  date: string;
  count: number;
}

export default function StatisticsPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Statistics | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    loadStatistics();
    loadActivity();
  }, [days]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const data = await api.get('/utilities/statistics');
      setStats(data);
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivity = async () => {
    try {
      const data = await api.get(`/utilities/activity?days=${days}`);
      setActivity(data.activity);
    } catch (error) {
      console.error('Error loading activity:', error);
    }
  };

  const maxActivityCount = Math.max(...activity.map(a => a.count), 1);
  const maxHourlyCount = stats ? Math.max(...stats.hourlyActivity.map(h => h.count), 1) : 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-nexo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <BarChart3 size={32} className="text-nexo-400" />
            Статистика
          </h1>
          <p className="text-zinc-400">Ваша активность в Нексо Мессенджере</p>
        </div>

        {/* Stats Cards — 2 колонки */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-2xl p-4 overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare size={16} className="text-blue-400 shrink-0" />
              <span className="text-[11px] text-blue-400 font-semibold truncate">СООБЩЕНИЯ</span>
            </div>
            <p className="text-2xl font-bold text-white mb-1 truncate">{stats?.totalMessages.toLocaleString()}</p>
            <p className="text-xs text-zinc-400 truncate">Всего отправлено</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-2xl p-4 overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-2">
              <Image size={16} className="text-purple-400 shrink-0" />
              <span className="text-[11px] text-purple-400 font-semibold truncate">МЕДИА</span>
            </div>
            <p className="text-2xl font-bold text-white mb-1 truncate">{stats?.totalMedia.toLocaleString()}</p>
            <p className="text-xs text-zinc-400 truncate">Файлов отправлено</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-2xl p-4 overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-2">
              <Users size={16} className="text-emerald-400 shrink-0" />
              <span className="text-[11px] text-emerald-400 font-semibold truncate">ЧАТЫ</span>
            </div>
            <p className="text-2xl font-bold text-white mb-1 truncate">{stats?.totalChats.toLocaleString()}</p>
            <p className="text-xs text-zinc-400 truncate">Активных чатов</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-2xl p-4 overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} className="text-orange-400 shrink-0" />
              <span className="text-[11px] text-orange-400 font-semibold truncate">АККАУНТ</span>
            </div>
            <p className="text-2xl font-bold text-white mb-1 truncate">{stats?.accountAgeDays}</p>
            <p className="text-xs text-zinc-400 truncate">Дней с нами</p>
          </motion.div>
        </div>

        {/* Activity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp size={20} className="text-nexo-400" />
              <h2 className="text-xl font-semibold text-white">Активность по дням</h2>
            </div>
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-nexo-500/50"
            >
              <option value="7">7 дней</option>
              <option value="14">14 дней</option>
              <option value="30">30 дней</option>
              <option value="90">90 дней</option>
            </select>
          </div>

          <div className="flex items-end gap-2 h-48">
            {activity.map((day, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div className="flex-1 w-full flex items-end">
                  <div
                    className="w-full bg-gradient-to-t from-nexo-500 to-nexo-400 rounded-t-lg transition-all hover:from-nexo-400 hover:to-nexo-300"
                    style={{ height: `${(day.count / maxActivityCount) * 100}%` }}
                    title={`${day.count} сообщений`}
                  />
                </div>
                <span className="text-[10px] text-zinc-500">
                  {new Date(day.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Hourly Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8"
        >
          <div className="flex items-center gap-2 mb-6">
            <Clock size={20} className="text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Активность по часам</h2>
          </div>

          <div className="flex items-end gap-1 h-32">
            {stats?.hourlyActivity.map((hour) => (
              <div key={hour.hour} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex-1 w-full flex items-end">
                  <div
                    className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t transition-all hover:from-purple-400 hover:to-purple-300"
                    style={{ height: `${(hour.count / maxHourlyCount) * 100}%` }}
                    title={`${hour.count} сообщений в ${hour.hour}:00`}
                  />
                </div>
                {hour.hour % 3 === 0 && (
                  <span className="text-[9px] text-zinc-500">{hour.hour}</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Top Contacts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <Users size={20} className="text-emerald-400" />
            <h2 className="text-xl font-semibold text-white">Топ контактов</h2>
          </div>

          <div className="space-y-3">
            {stats?.topContacts.slice(0, 10).map((contact, index) => {
              const otherMember = contact.chat?.members?.find((m: any) => m.user.id !== user?.id);
              const chatName = contact.chat?.type === 'personal'
                ? otherMember?.user.displayName || otherMember?.user.username
                : contact.chat?.name || 'Чат';

              return (
                <div
                  key={contact.chatId}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{chatName}</p>
                    <p className="text-xs text-zinc-500">{contact.messageCount} сообщений</p>
                  </div>
                  <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-nexo-500 to-purple-500"
                      style={{
                        width: `${(contact.messageCount / stats.topContacts[0].messageCount) * 100}%`
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
