import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail } from 'lucide-react';
import { api } from '../lib/api';
import Avatar from './Avatar';
import BottomSheet from './BottomSheet';

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

interface ContactCardModalProps {
  chatId: string;
  onClose: () => void;
  onSend: (contact: any) => void;
}

interface Contact {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  isVerified: boolean;
}

export default function ContactCardModal({ chatId, onClose, onSend }: ContactCardModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/contacts/chat/${chatId}`);
      setContacts(response);
    } catch (error) {
      console.error('Load contacts error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    if (selectedContact) {
      onSend({
        type: 'contact',
        contact: selectedContact,
      });
      onClose();
    }
  };

  const header = (
    <div className="flex items-center justify-between p-4 border-b border-white/5">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <User size={20} />
        Контакты
      </h2>
      <button
        onClick={onClose}
        className="p-2 hover:bg-white/10 rounded-lg transition"
      >
        <X size={20} className="text-white/60" />
      </button>
    </div>
  );

  const content = !selectedContact ? (
    <>
      <div className="flex-1 overflow-y-auto p-4">
        {contacts.length === 0 && !loading && (
          <button
            onClick={loadContacts}
            className="w-full py-3 bg-nexo-500 hover:bg-nexo-600 text-white rounded-lg transition"
          >
            Загрузить контакты
          </button>
        )}

        {loading && (
          <div className="text-center text-white/60 py-8">Загрузка...</div>
        )}

        <div className="space-y-2">
          {contacts.map(contact => (
            <button
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className="w-full p-3 bg-white/10 hover:bg-white/20 rounded-lg transition text-left"
            >
              <div className="flex items-center gap-3">
                <Avatar
                  src={contact.avatar}
                  name={contact.displayName}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">
                    {contact.displayName}
                  </div>
                  <div className="text-white/60 text-sm truncate">
                    @{contact.username}
                  </div>
                </div>
                {contact.isVerified && (
                  <div className="text-nexo-500">✓</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  ) : (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="text-center">
          <Avatar
            src={selectedContact.avatar}
            name={selectedContact.displayName}
            size="lg"
          />
          <h3 className="text-lg font-semibold text-white mt-3">
            {selectedContact.displayName}
          </h3>
          <p className="text-white/60 text-sm">@{selectedContact.username}</p>
          {selectedContact.bio && (
            <p className="text-white/60 text-sm mt-2">{selectedContact.bio}</p>
          )}
        </div>

      </div>

      <div className="flex items-center gap-3 p-4 border-t border-white/5">
        <button
          onClick={() => setSelectedContact(null)}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-sm"
        >
          Назад
        </button>

        <button
          onClick={handleSend}
          className="ml-auto px-4 py-2 bg-nexo-500 hover:bg-nexo-600 text-white rounded-lg transition text-sm"
        >
          Отправить контакт
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet
        isOpen
        onClose={onClose}
        showCloseButton={false}
      >
        {header}
        {content}
      </BottomSheet>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 sm:inset-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[500px] sm:h-[600px] bg-[#1a1a1a] backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col z-50"
    >
      {header}
      {content}
    </motion.div>
  );
}
