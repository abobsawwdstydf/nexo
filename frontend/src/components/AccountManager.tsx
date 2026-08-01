import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Lock,
} from 'lucide-react';
import {
  UserCirlceAdd,
  Add,
  Trash,
  Refresh,
  CloseCircle,
  Global,
} from 'iconsax-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface Account {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  email: string;
  avatar?: string;
  token: string;
  refreshToken: string;
  lastUsed: number;
}

interface AccountManagerProps {
  onClose: () => void;
}

const ACCOUNTS_STORAGE_KEY = 'nexo_accounts';
const CURRENT_ACCOUNT_KEY = 'nexo_current_account';

function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: Account[]) {
  localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

function generateAccountId(): string {
  return `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function AccountManager({ onClose }: AccountManagerProps) {
  const { user, loginWithToken, logout } = useAuthStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [codeExpiry, setCodeExpiry] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);
  const codeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setAccounts(loadAccounts());

    // Cross-domain sync via BroadcastChannel + localStorage events
    let channel: BroadcastChannel | null = null;
    try {
      // Listen for storage changes from other tabs/domains
      window.addEventListener('storage', handleStorageChange);

      // Also try BroadcastChannel for same-origin tabs
      if ('BroadcastChannel' in window) {
        channel = new BroadcastChannel('nexo_accounts_sync');
        channel.onmessage = (event) => {
          if (event.data.type === 'ACCOUNTS_UPDATED') {
            setAccounts(loadAccounts());
          }
        };
      }
    } catch (e) {
      console.error('Cross-domain sync error:', e);
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (channel) channel.close();
      if (codeTimerRef.current) {
        clearInterval(codeTimerRef.current);
        codeTimerRef.current = null;
      }
    };
  }, []);

  // Save current account to accounts list
  useEffect(() => {
    if (user) {
      const currentAccount: Account = {
        id: generateAccountId(),
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email || '',
        avatar: user.avatar || undefined,
        token: localStorage.getItem('nexo_access_token') || '',
        refreshToken: localStorage.getItem('nexo_refresh_token') || '',
        lastUsed: Date.now(),
      };

      setAccounts(prev => {
        const existing = prev.findIndex(a => a.userId === user.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...updated[existing], ...currentAccount, lastUsed: Date.now() };
          saveAccounts(updated);
          return updated;
        } else {
          const newAccounts = [...prev, currentAccount];
          saveAccounts(newAccounts);
          return newAccounts;
        }
      });
    }
  }, [user]);

  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === ACCOUNTS_STORAGE_KEY) {
      setAccounts(loadAccounts());
    }
  };

  const syncAcrossDomains = () => {
    setSyncing(true);
    try {
      // Save accounts to localStorage
      saveAccounts(accounts);
      
      // Broadcast update to other tabs
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('nexo_accounts_sync');
        channel.postMessage({ type: 'ACCOUNTS_UPDATED', accounts });
      }
      
      // Also dispatch storage event manually for cross-domain
      window.dispatchEvent(new StorageEvent('storage', {
        key: ACCOUNTS_STORAGE_KEY,
        newValue: JSON.stringify(accounts),
      }));
      
      toast.success('Аккаунты синхронизированы');
    } catch (e) {
      toast.error('Ошибка синхронизации');
    } finally {
      setSyncing(false);
    }
  };

  const handleSendCode = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.sendLoginCode(email);
      setCodeSent(true);
      setCodeExpiry(300); // 5 minutes
      toast.success('Код отправлен на email');
      
      // Start countdown
      if (codeTimerRef.current) clearInterval(codeTimerRef.current);
      codeTimerRef.current = setInterval(() => {
        setCodeExpiry(prev => {
          if (prev <= 1) {
            if (codeTimerRef.current) clearInterval(codeTimerRef.current);
            codeTimerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || 'Ошибка отправки кода');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async () => {
    if (!code.trim() || code.length !== 6) return;
    setLoading(true);
    try {
      const result = await api.loginConfirm(email, code);
      
      if (result.user && result.accessToken) {
        // Add new account
        const newAccount: Account = {
          id: generateAccountId(),
          userId: result.user.id,
          username: result.user.username,
          displayName: result.user.displayName,
          email: result.user.email || '',
          avatar: result.user.avatar || undefined,
          token: result.accessToken || '',
          refreshToken: result.refreshToken || '',
          lastUsed: Date.now(),
        };
        
        setAccounts(prev => {
          const updated = [...prev, newAccount];
          saveAccounts(updated);
          return updated;
        });
        
        // Login with new account
        loginWithToken(result.accessToken, result.user);
        
        toast.success('Аккаунт добавлен!');
        setShowAddAccount(false);
        setEmail('');
        setCode('');
        setCodeSent(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = async (account: Account) => {
    if (account.userId === user?.id) return;
    
    setLoading(true);
    try {
      // Switch to account
      loginWithToken(account.token, {
        id: account.userId,
        username: account.username,
        displayName: account.displayName,
        email: account.email,
        avatar: account.avatar || null,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        bio: null,
        createdAt: new Date().toISOString(),
      } as any);
      
      // Update last used
      setAccounts(prev => {
        const updated = prev.map(a => 
          a.id === account.id ? { ...a, lastUsed: Date.now() } : a
        );
        saveAccounts(updated);
        return updated;
      });
      
      toast.success(`Переключено на ${account.displayName}`);
      onClose();
    } catch (err: any) {
      toast.error('Ошибка переключения');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAccount = (accountId: string) => {
    setAccounts(prev => {
      const updated = prev.filter(a => a.id !== accountId);
      saveAccounts(updated);
      return updated;
    });
    toast.success('Аккаунт удалён');
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes}м назад`;
    if (hours < 24) return `${hours}ч назад`;
    return `${days}д назад`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-md liquid-glass-mega rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.08] border border-white/[0.06] flex items-center justify-center">
              <Global size={16} className="text-white/50" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/90">Аккаунты</h2>
              <p className="text-[11px] text-white/30">Управление и синхронизация</p>
            </div>
          </div>
          <motion.button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <CloseCircle size={18} className="text-white/40" />
          </motion.button>
        </div>

        {/* Accounts list */}
        <div className="max-h-[400px] overflow-y-auto p-4 space-y-2">
          {accounts.map((account) => (
            <motion.div
              key={account.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                account.userId === user?.id
                  ? 'bg-white/[0.08] border border-white/[0.1]'
                  : 'bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06]'
              }`}
            >
              {/* Avatar */}
              {account.avatar ? (
                <img
                  src={account.avatar}
                  alt={account.displayName}
                  className="w-10 h-10 rounded-xl object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.05] flex items-center justify-center">
                  <User size={16} className="text-white/40" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/80 truncate">
                    {account.displayName}
                  </span>
                  {account.userId === user?.id && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-white/50">
                      Текущий
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/30 truncate">
                  @{account.username} · {formatTimeAgo(account.lastUsed)}
                </p>
              </div>

              {/* Actions */}
              {account.userId !== user?.id && (
                <div className="flex items-center gap-1">
                  <motion.button
                    onClick={() => handleSwitchAccount(account)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    disabled={loading}
                  >
                    <Refresh size={14} className="text-white/40" />
                  </motion.button>
                  <motion.button
                    onClick={() => handleRemoveAccount(account.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Trash size={14} className="text-red-400/50" />
                  </motion.button>
                </div>
              )}
            </motion.div>
          ))}

          {accounts.length === 0 && (
            <div className="text-center py-8">
              <UserCirlceAdd size={32} className="text-white/15 mx-auto mb-3" />
              <p className="text-sm text-white/30">Нет сохранённых аккаунтов</p>
              <p className="text-xs text-white/20 mt-1">Добавьте аккаунт для быстрого переключения</p>
            </div>
          )}
        </div>

        {/* Add account button */}
        <div className="p-4 border-t border-white/[0.06]">
          {!showAddAccount ? (
            <motion.button
              onClick={() => setShowAddAccount(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors text-sm text-white/60"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <Add size={16} />
              Добавить аккаунт
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full h-10 pl-9 pr-3 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20"
                  disabled={codeSent}
                />
              </div>

              {codeSent && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative"
                >
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-значный код"
                    className="w-full h-10 pl-9 pr-3 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20"
                    maxLength={6}
                  />
                  {codeExpiry > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">
                      {Math.floor(codeExpiry / 60)}:{(codeExpiry % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </motion.div>
              )}

              <div className="flex gap-2">
                <motion.button
                  onClick={() => { setShowAddAccount(false); setCodeSent(false); setEmail(''); setCode(''); }}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors text-sm text-white/50"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  Отмена
                </motion.button>
                <motion.button
                  onClick={codeSent ? handleConfirmCode : handleSendCode}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/[0.1] transition-colors text-sm text-white/80"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  disabled={loading || (!codeSent && !email.trim()) || (codeSent && code.length !== 6)}
                >
                  {loading ? 'Загрузка...' : codeSent ? 'Войти' : 'Отправить код'}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Sync button */}
          <motion.button
            onClick={syncAcrossDomains}
            className="w-full flex items-center justify-center gap-2 mt-3 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] transition-colors text-xs text-white/30"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            disabled={syncing}
          >
            <Refresh size={12} className={syncing ? 'animate-spin' : ''} />
            Синхронизировать между устройствами
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
