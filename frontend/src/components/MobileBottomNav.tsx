import { motion } from 'framer-motion';
import { MessageCircle, Users, Settings, User } from 'lucide-react';

interface MobileBottomNavProps {
  active: 'chats' | 'friends' | 'settings' | 'profile';
  onChats: () => void;
  onFriends: () => void;
  onSettings: () => void;
  onProfile: () => void;
}

export function MobileBottomNav({ active, onChats, onFriends, onSettings, onProfile }: MobileBottomNavProps) {
  const items = [
    { id: 'chats' as const, label: 'Чаты', icon: MessageCircle, onClick: onChats },
    { id: 'friends' as const, label: 'Друзья', icon: Users, onClick: onFriends },
    { id: 'settings' as const, label: 'Настройки', icon: Settings, onClick: onSettings },
    { id: 'profile' as const, label: 'Профиль', icon: User, onClick: onProfile },
  ];

  return (
    <div className="md:hidden absolute bottom-2 left-2 right-2 z-30">
      <div className="flex items-center justify-around px-2 py-1.5 rounded-[24px] liquid-glass-strong border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
        {items.map(item => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              onClick={item.onClick}
              whileTap={{ scale: 0.9 }}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl transition-all duration-200 ${
                isActive ? 'text-white bg-white/[0.08]' : 'text-white/40 hover:text-white/60'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className={`text-[9px] font-medium ${isActive ? 'opacity-90' : 'opacity-60'}`}>{item.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
