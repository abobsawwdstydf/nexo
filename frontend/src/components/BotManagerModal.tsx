import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Bot, Plus, Loader2, Copy, Check, Trash2, RefreshCw, ChevronLeft, TerminalSquare, KeyRound, UserPlus, Power } from 'lucide-react';
import type { BotInfo, BotCommandInfo } from '../lib/api/bots';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { getInitials } from '../lib/initials';
import { normalizeMediaUrl } from '../lib/mediaUrl';

interface BotManagerModalProps {
  onClose: () => void;
  onBotInstalled?: (chatId: string) => void;
}

export default function BotManagerModal({ onClose, onBotInstalled }: BotManagerModalProps) {
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState<BotInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [newBotDesc, setNewBotDesc] = useState('');
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [newCmd, setNewCmd] = useState('');
  const [newCmdResp, setNewCmdResp] = useState('');
  const [cmdBusy, setCmdBusy] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [installChats, setInstallChats] = useState<Array<{ id: string; name: string | null; type: string }>>([]);
  const [installBusy, setInstallBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);

  const loadBots = async () => {
    try {
      const list = await api.getBots();
      setBots(list);
      setSelectedBot(prev => (prev ? list.find(b => b.id === prev.id) || null : null));
    } catch (err) {
      console.error('[Bots] load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBots();
  }, []);

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const openBot = async (botId: string) => {
    try {
      const bot = await api.getBot(botId);
      setSelectedBot(bot);
      setFreshToken(null);
      setShowCommands(false);
      setShowInstall(false);
    } catch (err) {
      console.error('[Bots] open failed:', err);
      toast.error('Ne udalos otkryt bota');
    }
  };

  const handleCreate = async () => {
    if (!newBotName.trim()) return;
    setSaving(true);
    try {
      const created = await api.createBot({ name: newBotName.trim(), description: newBotDesc.trim() || undefined });
      setFreshToken(created.token);
      setNewBotName('');
      setNewBotDesc('');
      await loadBots();
      toast.success('Bot sozdan');
    } catch (err) {
      console.error('[Bots] create failed:', err);
      toast.error('Ne udalos sozdat bota');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBot) return;
    if (!confirm('Udalit bota ' + selectedBot.name + '?')) return;
    try {
      await api.deleteBot(selectedBot.id);
      setSelectedBot(null);
      await loadBots();
      toast.info('Bot udalen');
    } catch (err) {
      console.error('[Bots] delete failed:', err);
      toast.error('Ne udalos udalit bota');
    }
  };

  const handleRegenToken = async () => {
    if (!selectedBot) return;
    try {
      const res = await api.regenerateBotToken(selectedBot.id);
      setFreshToken(res.token);
      toast.success('Token perevypushchen');
    } catch (err) {
      console.error('[Bots] regen failed:', err);
      toast.error('Ne udalos sgenerirovat token');
    }
  };

  const handleToggleActive = async () => {
    if (!selectedBot) return;
    setToggleBusy(true);
    try {
      const updated = await api.updateBot(selectedBot.id, { isActive: !selectedBot.isActive });
      setSelectedBot(updated);
      await loadBots();
    } catch (err) {
      console.error('[Bots] toggle failed:', err);
      toast.error('Ne udalos izmenit status');
    } finally {
      setToggleBusy(false);
    }
  };

  const handleAddCommand = async () => {
    if (!selectedBot || !newCmd.trim()) return;
    setCmdBusy(true);
    try {
      await api.addBotCommand(selectedBot.id, { command: newCmd.trim(), response: newCmdResp.trim() || undefined });
      setNewCmd('');
      setNewCmdResp('');
      const cmds = await api.getBotCommands(selectedBot.id);
      setSelectedBot({ ...selectedBot, commands: cmds });
      toast.success('Komanda dobavlena');
    } catch (err) {
      console.error('[Bots] add command failed:', err);
      toast.error('Ne udalos dobavit komandu');
    } finally {
      setCmdBusy(false);
    }
  };

  const handleDeleteCommand = async (cmdId: string) => {
    if (!selectedBot) return;
    try {
      await api.deleteBotCommand(selectedBot.id, cmdId);
      const cmds = await api.getBotCommands(selectedBot.id);
      setSelectedBot({ ...selectedBot, commands: cmds });
    } catch (err) {
      console.error('[Bots] delete command failed:', err);
    }
  };

  const openInstall = async () => {
    setShowInstall(true);
    try {
      const chats = await api.getChats();
      setInstallChats(chats.map(c => ({ id: c.id, name: c.name, type: c.type })));
    } catch (err) {
      console.error('[Bots] load chats failed:', err);
    }
  };

  const handleInstall = async (chatId: string) => {
    if (!selectedBot) return;
    setInstallBusy(true);
    try {
      await api.installBot(selectedBot.id, chatId);
      toast.success('Bot ustanovlen v chat');
      onBotInstalled?.(chatId);
      setShowInstall(false);
    } catch (err) {
      console.error('[Bots] install failed:', err);
      toast.error('Ne udalos ustanovit bota');
    } finally {
      setInstallBusy(false);
    }
  };
  const initials = getInitials(selectedBot?.name || '');
  const commands = selectedBot?.commands || [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 40 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="relative w-full h-full md:h-auto md:max-h-[88vh] max-w-none md:max-w-[440px] rounded-none md:rounded-3xl liquid-glass-strong overflow-y-auto"
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

        {selectedBot ? (
          <>
            {/* Bot detail view */}
            <div className="h-28 bg-gradient-to-br from-cyan-900 via-zinc-900 to-black relative overflow-hidden">
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-cyan-400/10 blur-3xl" />
            </div>
            <div className="flex justify-center -mt-10 relative z-10 px-6">
              <button
                onClick={() => { setSelectedBot(null); setFreshToken(null); }}
                className="absolute left-4 top-2 p-2 rounded-full bg-black/40 border border-white/[0.08] hover:bg-white/[0.1] transition-all"
              >
                <ChevronLeft size={16} className="text-white/70" />
              </button>
              <div className="w-20 h-20 rounded-3xl overflow-hidden ring-4 ring-[#0a0a0f] shadow-2xl">
                {selectedBot.avatar ? (
                  <img src={normalizeMediaUrl(selectedBot.avatar)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-cyan-700 to-cyan-900 flex items-center justify-center">
                    <Bot size={28} className="text-white/70" />
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 pt-3 pb-6">
              <div className="text-center">
                <h1 className="text-lg font-bold text-white/90 font-display">{selectedBot.name}</h1>
                <p className="text-xs text-white/40 mt-0.5">@{selectedBot.username}</p>
                <span className={`inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium border ${selectedBot.isActive ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/[0.04] border-white/[0.08] text-white/40'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedBot.isActive ? 'bg-green-400' : 'bg-white/20'}`} />
                  {selectedBot.isActive ? 'Active' : 'Paused'}
                </span>
              </div>

              {selectedBot.description && (
                <p className="mt-3 text-xs text-white/60 leading-relaxed max-w-xs mx-auto">{selectedBot.description}</p>
              )}

              <p className="mt-4 text-center text-[10px] text-white/25">Sozdan: {new Date(selectedBot.createdAt).toLocaleDateString('ru-RU')}</p>

              {/* Commands */}
              <div className="mt-5 text-left">
                <button
                  onClick={() => setShowCommands(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all text-xs text-white/70"
                >
                  <span className="flex items-center gap-2"><TerminalSquare size={14} /> Komandy ({commands.length})</span>
                  <span className="text-white/30">{showCommands ? '-' : '+'}</span>
                </button>
                {showCommands && (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={newCmd}
                        onChange={e => setNewCmd(e.target.value)}
                        placeholder="/command"
                        className="flex-1 h-8 px-3 text-xs bg-white/[0.05] border border-white/[0.08] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20"
                      />
                      <button
                        onClick={handleAddCommand}
                        disabled={cmdBusy || !newCmd.trim()}
                        className="px-3 h-8 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-colors disabled:opacity-40"
                      >
                        {cmdBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                      </button>
                    </div>
                    <input
                      value={newCmdResp}
                      onChange={e => setNewCmdResp(e.target.value)}
                      placeholder="Ovet bota (neobjazatelno)"
                      className="w-full h-8 px-3 text-xs bg-white/[0.05] border border-white/[0.08] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20"
                    />
                    {commands.length === 0 ? (
                      <p className="text-[11px] text-white/25 py-2">Komand poka net</p>
                    ) : (
                      commands.map(cmd => (
                        <div key={cmd.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                          <code className="flex-1 min-w-0 text-xs text-white/80 truncate">{cmd.command}</code>
                          {cmd.response && <span className="text-[10px] text-white/30 truncate max-w-[120px]">{cmd.response}</span>}
                          <button onClick={() => handleDeleteCommand(cmd.id)} className="p-1 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Token */}
              <div className="mt-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40 font-medium mb-2">
                  <KeyRound size={11} /> Token API
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 text-[10px] text-cyan-300/80 truncate bg-black/40 rounded-lg px-2 py-1.5">
                    {(freshToken || ':token-skryt-perevypustite:')}
                  </code>
                  {freshToken && (
                    <button onClick={() => copyToken(freshToken)} className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white/60 transition-colors" title="Kopirovat">
                      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-white/25 mt-1.5">Token pokazyvaetsya odin raz pri sozdanii i pri perevypuske.</p>
                <button
                  onClick={handleRegenToken}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs text-white/60 transition-colors"
                >
                  <RefreshCw size={12} /> Perevypustit token
                </button>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={handleToggleActive}
                  disabled={toggleBusy}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-white/80 transition-all disabled:opacity-50"
                >
                  {toggleBusy ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
                  {selectedBot.isActive ? 'Pause' : 'Vklyuchit'}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs font-medium text-red-400 transition-all"
                >
                  <Trash2 size={15} /> Udalit
                </button>
              </div>
              <button
                onClick={openInstall}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-all"
              >
                <UserPlus size={15} /> Ustanovit v chat
              </button>

              {/* Install chat picker */}
              {showInstall && (
                <div className="mt-3 max-h-44 overflow-y-auto space-y-1">
                  {installChats.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleInstall(c.id)}
                      disabled={installBusy}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-xs text-white/75 disabled:opacity-50"
                    >
                      <span className="truncate">{c.name || c.type}</span>
                      <Plus size={12} className="text-white/40 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Bot list + create */}
            <div className="h-24 bg-gradient-to-br from-cyan-900 via-zinc-900 to-black relative overflow-hidden">
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-cyan-400/10 blur-3xl" />
            </div>
            <div className="px-6 pt-4 pb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center">
                  <Bot size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-white/90 font-display">Moi boty</h1>
                  <p className="text-[11px] text-white/40">Telegram API-compatible bots</p>
                </div>
              </div>

              {/* Create form */}
              <div className="mt-4 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[10px] uppercase tracking-wide text-white/40 font-medium mb-2">Novyj bot</p>
                <input
                  value={newBotName}
                  onChange={e => setNewBotName(e.target.value)}
                  placeholder="Imya bota (2-64 simvola)"
                  className="w-full h-8 px-3 text-xs bg-white/[0.05] border border-white/[0.08] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20"
                />
                <input
                  value={newBotDesc}
                  onChange={e => setNewBotDesc(e.target.value)}
                  placeholder="Opisanie"
                  className="mt-2 w-full h-8 px-3 text-xs bg-white/[0.05] border border-white/[0.08] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20"
                />
                <button
                  onClick={handleCreate}
                  disabled={saving || !newBotName.trim()}
                  className="mt-2.5 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-all disabled:opacity-40"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Sozdat bota
                </button>
              </div>

              {/* Fresh token */}
              {freshToken && (
                <div className="mt-3 p-3 rounded-2xl bg-cyan-500/[0.06] border border-cyan-500/20">
                  <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-cyan-300/70 font-medium mb-2">
                    <KeyRound size={11} /> Token (pokazan odin raz!)
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 text-[10px] text-cyan-300/90 truncate bg-black/40 rounded-lg px-2 py-1.5">{freshToken}</code>
                    <button onClick={() => copyToken(freshToken)} className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white/60 transition-colors">
                      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              )}

              {/* List */}
              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-wide text-white/40 font-medium mb-2">Spisok botov</p>
                {loading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 size={18} className="text-white/30 animate-spin" /></div>
                ) : bots.length === 0 ? (
                  <p className="text-center text-[11px] text-white/25 py-6">Poka botov net — sozdajte pervogo</p>
                ) : (
                  <div className="space-y-1.5">
                    {bots.map(bot => (
                      <button
                        key={bot.id}
                        onClick={() => openBot(bot.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-transparent hover:border-white/[0.06] transition-all text-left"
                      >
                        {bot.avatar ? (
                          <img src={normalizeMediaUrl(bot.avatar)} alt="" className="w-9 h-9 rounded-xl object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-700 to-cyan-900 flex items-center justify-center">
                            <Bot size={16} className="text-white/70" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-white/85 truncate">{bot.name}</div>
                          <div className="text-[10px] text-white/30 truncate">@{bot.username}{bot.commands?.length ? ` · ${bot.commands.length} cmd` : ''}</div>
                        </div>
                        {!bot.isActive && (
                          <span className="px-1.5 py-0.5 rounded-md bg-white/[0.05] text-[9px] text-white/40">Pause</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
