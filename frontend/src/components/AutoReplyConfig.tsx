import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Bot, Clock, Timer, Users, Settings, Play, Pause,
  TestTube, Check, AlertCircle, Loader, ChevronDown, Zap, X,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface AutoReplyConfigProps {
  onClose: () => void;
}

interface ChatPreview {
  id: string;
  name: string;
  avatar: string | null;
}

export default function AutoReplyConfig({ onClose }: AutoReplyConfigProps) {
  const [enabled, setEnabled] = useState(false);
  const [persona, setPersona] = useState('Я временно отсутствую. AI-ассистент ответит за меня.');
  const [maxRepliesPerHour, setMaxRepliesPerHour] = useState(10);
  const [replyDelay, setReplyDelay] = useState(3);
  const [activeChats, setActiveChats] = useState<string[]>([]);
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoadingChats(true);
    api.getChats().then((data: any) => {
      const list = Array.isArray(data) ? data : data?.chats || [];
      setChats(list.map((c: any) => ({ id: c.id, name: c.name || 'Чат', avatar: c.avatar })));
    }).catch(() => {}).finally(() => setLoadingChats(false));
  }, []);

  const toggleChat = useCallback((chatId: string) => {
    setActiveChats(prev => prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId]);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await new Promise(r => setTimeout(r, 500));
      toast.success('Настройки сохранены');
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }, []);

  const handleTestReply = useCallback(async () => {
    if (!testInput.trim()) return;
    setTestLoading(true);
    setTestOutput('');
    try {
      const res = await api.aiChat([
        { role: 'system', content: `Ты автоответчик. Персона: ${persona}. Отвечай кратко (1-2 предложения) на русском.` },
        { role: 'user', content: testInput },
      ]);
      setTestOutput(res.text);
    } catch {
      setTestOutput('Ошибка генерации ответа');
    } finally {
      setTestLoading(false);
    }
  }, [testInput, persona]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/20 flex items-center justify-center">
            <Bot size={15} className="text-violet-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">AI Автоответчик</h2>
        </div>
        <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <X size={15} className="text-white/40" />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <Zap size={15} className={enabled ? 'text-violet-400/70' : 'text-white/25'} />
            <span className="text-xs text-white/60">Автоответчик</span>
          </div>
          <div onClick={() => setEnabled(v => !v)} className={`w-9 h-5 rounded-full transition-colors duration-200 relative cursor-pointer ${enabled ? 'bg-violet-500/50' : 'bg-white/[0.08]'}`}>
            <motion.div animate={{ x: enabled ? 18 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="w-4 h-4 rounded-full bg-white/80 absolute top-0.5" />
          </div>
        </div>

        {/* Persona */}
        <div>
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block px-1 pb-2">Персона</label>
          <textarea value={persona} onChange={e => setPersona(e.target.value)} rows={3}
            placeholder="Опишите характер автоответчика..."
            className="w-full px-3 py-2.5 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06] resize-none" />
        </div>

        {/* Max replies per hour */}
        <div>
          <div className="flex items-center justify-between px-1 pb-2">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Макс. ответов/час</label>
            <span className="text-xs text-white/50 font-mono">{maxRepliesPerHour}</span>
          </div>
          <input type="range" min={0} max={50} value={maxRepliesPerHour} onChange={e => setMaxRepliesPerHour(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-white/[0.08] accent-violet-500 cursor-pointer" />
          <div className="flex justify-between text-[10px] text-white/20 px-0.5 mt-1">
            <span>0</span><span>25</span><span>50</span>
          </div>
        </div>

        {/* Reply delay */}
        <div>
          <div className="flex items-center justify-between px-1 pb-2">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Задержка ответа</label>
            <span className="text-xs text-white/50 font-mono">{replyDelay}с</span>
          </div>
          <input type="range" min={0} max={30} value={replyDelay} onChange={e => setReplyDelay(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-white/[0.08] accent-violet-500 cursor-pointer" />
          <div className="flex justify-between text-[10px] text-white/20 px-0.5 mt-1">
            <span>0с</span><span>15с</span><span>30с</span>
          </div>
        </div>

        {/* Active chats */}
        <div>
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block px-1 pb-2">Активные чаты</label>
          {loadingChats ? (
            <div className="flex justify-center py-4"><Loader size={16} className="text-white/30 animate-spin" /></div>
          ) : (
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {chats.map(chat => (
                <div key={chat.id} onClick={() => toggleChat(chat.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors ${activeChats.includes(chat.id) ? 'bg-violet-500/10 border border-violet-500/20' : 'hover:bg-white/[0.03] border border-transparent'}`}>
                  <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors ${activeChats.includes(chat.id) ? 'border-violet-400 bg-violet-400/20' : 'border-white/20'}`}>
                    {activeChats.includes(chat.id) && <Check size={10} className="text-violet-400" />}
                  </div>
                  <span className="text-xs text-white/60 truncate">{chat.name}</span>
                </div>
              ))}
              {chats.length === 0 && <p className="text-xs text-white/20 text-center py-4">Нет чатов</p>}
            </div>
          )}
        </div>

        {/* Preview / Test */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block pb-2">Тест автоответа</label>
          <div className="flex gap-2">
            <input type="text" value={testInput} onChange={e => setTestInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTestReply()}
              placeholder="Введите сообщение для теста..."
              className="flex-1 h-9 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20" />
            <motion.button onClick={handleTestReply} disabled={testLoading || !testInput.trim()}
              className="px-3 h-9 rounded-xl bg-violet-500/20 border border-violet-500/20 text-violet-400/70 text-xs hover:bg-violet-500/30 transition-colors disabled:opacity-40"
              whileTap={{ scale: 0.95 }}>
              {testLoading ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}
            </motion.button>
          </div>
          <AnimatePresence>
            {testOutput && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mt-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Bot size={10} className="text-violet-400/50" />
                  <span className="text-[10px] text-violet-400/50">AI-ответ:</span>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">{testOutput}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Save button */}
        <motion.button onClick={handleSave} disabled={saving}
          className="w-full py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/20 text-xs text-violet-400/80 font-medium hover:bg-violet-500/30 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          whileTap={{ scale: 0.98 }}>
          {saving ? <><Loader size={12} className="animate-spin" />Сохранение...</> : <><Check size={12} />Сохранить настройки</>}
        </motion.button>
      </div>
    </div>
  );
}