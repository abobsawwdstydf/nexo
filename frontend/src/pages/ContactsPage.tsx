import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, UserPlus, Search, Phone, MessageSquare, 
  MoreVertical, Clock, Star, Loader2, X, ArrowLeft 
} from 'lucide-react';
import { ClearInput } from '../components/ClearInput';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { api } from '../lib/api';
import Avatar from '../components/Avatar';
import type { FriendWithId, FriendRequest } from '../lib/types';

type ContactsTab = 'recent' | 'frequent' | 'all';

interface Contact {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: string;
  phone?: string;
}

export default function ContactsPage({ onClose }: { onClose?: () => void }) {
  const { user } = useAuthStore();
  const { chats, setActiveChat } = useChatStore();
  const [activeTab, setActiveTab] = useState<ContactsTab>('all');
  const [friends, setFriends] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [addContactQuery, setAddContactQuery] = useState('');
  const [addContactResults, setAddContactResults] = useState<any[]>([]);

  // Load friends/contacts
  useEffect(() => {
    setIsLoading(true);
    api.getFriends()
      .then((data: any) => {
        setFriends(data.map((f: any) => ({
          id: f.friend.id,
          name: f.friend.name,
          username: f.friend.username,
          avatar: f.friend.avatar,
          isOnline: f.friend.isOnline,
          lastSeen: f.friend.lastSeen,
          phone: f.friend.phone,
        })));
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // Search for adding contacts
  useEffect(() => {
    if (!addContactQuery.trim() || addContactQuery.trim().length < 2) {
      setAddContactResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await api.searchUsers(addContactQuery);
        const friendIds = new Set(friends.map(f => f.id));
        setAddContactResults(results.filter((u: any) => u.id !== user?.id && !friendIds.has(u.id)));
      } catch (e) {
        console.error(e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [addContactQuery, friends, user]);

  // Filter contacts by search
  const filteredContacts = friends.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort by recent chats
  const recentContacts = [...filteredContacts].sort((a, b) => {
    const aChat = chats.find(c => c.otherMember?.id === a.id);
    const bChat = chats.find(c => c.otherMember?.id === b.id);
    const aTime = aChat?.lastMessage?.createdAt ? new Date(aChat.lastMessage.createdAt).getTime() : 0;
    const bTime = bChat?.lastMessage?.createdAt ? new Date(bChat.lastMessage.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  // Sort by frequent (most messages)
  const frequentContacts = [...filteredContacts].sort((a, b) => {
    const aChat = chats.find(c => c.otherMember?.id === a.id);
    const bChat = chats.find(c => c.otherMember?.id === b.id);
    return (bChat?.messages?.length || 0) - (aChat?.messages?.length || 0);
  });

  const displayContacts = activeTab === 'recent' ? recentContacts 
    : activeTab === 'frequent' ? frequentContacts 
    : filteredContacts;

  const tabs = [
    { id: 'recent' as const, label: 'Недавние' },
    { id: 'frequent' as const, label: 'Частые' },
    { id: 'all' as const, label: 'Все контакты' },
  ];

  const startChat = (contactId: string) => {
    const chat = chats.find(c => c.otherMember?.id === contactId);
    if (chat) {
      setActiveChat(chat.id);
      onClose?.();
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-4">
          {onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 transition-colors"
            >
              <ArrowLeft size={20} className="text-text-secondary" />
            </button>
          )}
          <h1 className="text-xl font-semibold text-text-primary flex-1">Контакты</h1>
          <button
            onClick={() => setShowAddContact(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
          >
            <UserPlus size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск контактов..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface border border-border text-text-primary text-sm placeholder-text-secondary focus:outline-none focus:border-accent/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface border border-border">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-accent animate-spin" />
          </div>
        ) : displayContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center mb-4">
              <Users size={24} className="text-text-secondary" />
            </div>
            <p className="text-text-secondary text-sm">
              {searchQuery ? 'Контакты не найдены' : 'Нет контактов'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {displayContacts.map((contact, i) => (
              <motion.button
                key={contact.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => startChat(contact.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left"
              >
                <div className="relative flex-shrink-0">
                  <Avatar src={contact.avatar} name={contact.name} size="lg" />
                  {contact.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-online border-2 border-bg" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary truncate">{contact.name}</span>
                    {contact.username && (
                      <span className="text-xs text-text-secondary">@{contact.username}</span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary truncate">
                    {contact.isOnline ? 'В сети' : contact.lastSeen || 'Не в сети'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); startChat(contact.id); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-text-secondary hover:text-accent transition-colors"
                  >
                    <MessageSquare size={16} />
                  </button>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-text-secondary hover:text-accent transition-colors"
                  >
                    <Phone size={16} />
                  </button>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      <AnimatePresence>
        {showAddContact && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
            onClick={() => setShowAddContact(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:w-96 max-h-[80vh] bg-surface border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-text-primary">Добавить контакт</h2>
                  <button
                    onClick={() => setShowAddContact(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-text-secondary"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    value={addContactQuery}
                    onChange={(e) => setAddContactQuery(e.target.value)}
                    placeholder="Поиск по имени, @username или номеру..."
                    className="w-full h-10 pl-10 pr-4 rounded-xl bg-bg border border-border text-text-primary text-sm placeholder-text-secondary focus:outline-none focus:border-accent/50"
                    autoFocus
                  />
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-96">
                {addContactResults.length === 0 ? (
                  <p className="text-center text-text-secondary text-sm py-8">
                    {addContactQuery.length < 2 ? 'Введите минимум 2 символа' : 'Пользователи не найдены'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {addContactResults.map((u: any) => (
                      <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5">
                        <Avatar src={u.avatar} name={u.name} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{u.name}</p>
                          {u.username && <p className="text-xs text-text-secondary">@{u.username}</p>}
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await api.sendFriendRequest(u.id);
                              setAddContactResults(prev => prev.filter((r: any) => r.id !== u.id));
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className="h-8 px-3 rounded-lg bg-accent/20 text-accent text-xs font-medium hover:bg-accent/30 transition-colors"
                        >
                          Добавить
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
