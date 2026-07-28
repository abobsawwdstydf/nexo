import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tv, Music, Gamepad2, MonitorPlay, Plus, Play, Pause, SkipForward, Trash2,
  Link, Users, Share2, X, Loader, Check,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

type ActivityType = 'watch' | 'game' | 'music';

interface VoiceRoomActivityProps {
  onClose: () => void;
}

interface QueueItem {
  id: string;
  title: string;
  url: string;
  addedBy: string;
  duration: string;
}

const ACTIVITIES: { key: ActivityType; label: string; icon: typeof Tv; color: string }[] = [
  { key: 'watch', label: 'Смотреть', icon: Tv, color: 'red' },
  { key: 'game', label: 'Игры', icon: Gamepad2, color: 'blue' },
  { key: 'music', label: 'Музыка', icon: Music, color: 'green' },
];

const COLOR_MAP: Record<string, string> = {
  red: 'bg-red-500/20 border-red-500/20 text-red-400/70',
  blue: 'bg-blue-500/20 border-blue-500/20 text-blue-400/70',
  green: 'bg-green-500/20 border-green-500/20 text-green-400/70',
};

export default function VoiceRoomActivity({ onClose }: VoiceRoomActivityProps) {
  const [activity, setActivity] = useState<ActivityType>('watch');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([
    { id: '1', title: 'Название видео 1', url: 'https://youtube.com/watch?v=1', addedBy: 'Вы', duration: '10:24' },
    { id: '2', title: 'Название видео 2', url: 'https://youtube.com/watch?v=2', addedBy: 'Алексей', duration: '5:12' },
  ]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const addToQueue = useCallback(() => {
    if (!youtubeUrl.trim()) return;
    const newItem: QueueItem = {
      id: Date.now().toString(),
      title: youtubeUrl.split('/').pop() || 'Видео',
      url: youtubeUrl,
      addedBy: 'Вы',
      duration: '??:??',
    };
    setQueue(prev => [...prev, newItem]);
    setYoutubeUrl('');
    toast.success('Добавлено в очередь');
  }, [youtubeUrl]);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  }, []);

  const handleShare = useCallback(() => {
    const link = `https://nexo.app/watch/${Date.now().toString(36)}`;
    setShareLink(link);
    setSharing(true);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/20 flex items-center justify-center">
            <Tv size={15} className="text-red-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Активности</h2>
        </div>
        <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <X size={15} className="text-white/40" />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Activity selector */}
        <div className="grid grid-cols-3 gap-2">
          {ACTIVITIES.map(a => {
            const Icon = a.icon;
            const isActive = activity === a.key;
            return (
              <motion.button key={a.key} onClick={() => setActivity(a.key)}
                className={`p-3 rounded-xl border transition-all ${isActive ? COLOR_MAP[a.color] : 'bg-white/[0.03] border-white/[0.06] text-white/40 hover:bg-white/[0.05]'}`}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Icon size={16} className="mx-auto mb-1.5" />
                <p className="text-[10px] text-center">{a.label}</p>
              </motion.button>
            );
          })}
        </div>

        {/* YouTube URL input */}
        {activity === 'watch' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1">Добавить видео</label>
            <div className="flex gap-2">
              <input type="url" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addToQueue()}
                placeholder="Вставьте ссылку YouTube..."
                className="flex-1 h-9 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20" />
              <motion.button onClick={addToQueue}
                className="px-3 h-9 rounded-xl bg-red-500/20 border border-red-500/20 text-red-400/70 text-xs hover:bg-red-500/30 transition-colors"
                whileTap={{ scale: 0.95 }}>
                <Plus size={14} />
              </motion.button>
            </div>
          </div>
        )}

        {/* Playback controls */}
        {activity === 'watch' && queue.length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-white/50 truncate flex-1">{queue[currentIdx]?.title}</p>
              <span className="text-[10px] text-white/25 ml-2">{currentIdx + 1}/{queue.length}</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <motion.button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} className="p-2 rounded-lg hover:bg-white/[0.06]"
                whileTap={{ scale: 0.9 }}>
                <SkipForward size={14} className="text-white/40 rotate-180" />
              </motion.button>
              <motion.button onClick={() => setIsPlaying(v => !v)} className="p-3 rounded-full bg-white/[0.08] hover:bg-white/[0.12] transition-colors"
                whileTap={{ scale: 0.9 }}>
                {isPlaying ? <Pause size={16} className="text-white/70" /> : <Play size={16} className="text-white/70 ml-0.5" />}
              </motion.button>
              <motion.button onClick={() => setCurrentIdx(i => Math.min(queue.length - 1, i + 1))} className="p-2 rounded-lg hover:bg-white/[0.06]"
                whileTap={{ scale: 0.9 }}>
                <SkipForward size={14} className="text-white/40" />
              </motion.button>
            </div>
          </div>
        )}

        {/* Queue */}
        <div>
          <div className="flex items-center justify-between px-1 pb-2">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Очередь</label>
            <span className="text-[10px] text-white/25">{queue.length} треков</span>
          </div>
          <div className="space-y-0.5">
            {queue.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-6">Очередь пуста</p>
            ) : queue.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${i === currentIdx ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}>
                <span className="text-[10px] text-white/25 w-4 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/60 truncate">{item.title}</p>
                  <p className="text-[10px] text-white/25">{item.addedBy} · {item.duration}</p>
                </div>
                <button onClick={() => removeFromQueue(item.id)} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.08]">
                  <Trash2 size={11} className="text-red-400/50" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Share */}
        <div>
          <motion.button onClick={handleShare} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-white/50 hover:bg-white/[0.08] transition-colors"
            whileTap={{ scale: 0.98 }}>
            <Share2 size={12} />Поделиться сессией
          </motion.button>
          <AnimatePresence>
            {sharing && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mt-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Link size={11} className="text-white/30 flex-shrink-0" />
                  <input type="text" readOnly value={shareLink} className="flex-1 text-[10px] text-white/40 bg-transparent outline-none" />
                  <motion.button onClick={() => { navigator.clipboard.writeText(shareLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
                    className="p-1 rounded hover:bg-white/[0.08]" whileTap={{ scale: 0.9 }}>
                    {linkCopied ? <Check size={11} className="text-green-400/70" /> : <Share2 size={11} className="text-white/30" />}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Participants */}
        <div>
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block px-1 pb-2">Участники</label>
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02]">
            <Users size={13} className="text-white/20" />
            <span className="text-xs text-white/40">3 участника смотрят</span>
          </div>
        </div>
      </div>
    </div>
  );
}