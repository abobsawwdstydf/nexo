import React from 'react';
import { motion } from 'framer-motion';
import { ChatBubbleIcon, UsersIcon, GearIcon, MagnifierIcon, PersonIcon } from '../lib/appleIcons';

interface MobileBottomNavProps {
  active: 'chats' | 'friends' | 'settings' | 'search' | 'profile';
  onChats: () => void;
  onFriends: () => void;
  onSettings: () => void;
  onSearch: () => void;
  onProfile?: () => void;
}

export function MobileBottomNav({
  active,
  onChats,
  onFriends,
  onSettings,
  onSearch,
  onProfile,
}: MobileBottomNavProps) {
  const items = [
    { id: 'friends' as const, label: 'Контакты', icon: UsersIcon, onClick: onFriends },
    { id: 'chats' as const, label: 'Чаты', icon: ChatBubbleIcon, onClick: onChats },
    { id: 'settings' as const, label: 'Настройки', icon: GearIcon, onClick: onSettings },
    { id: 'search' as const, label: 'Поиск', icon: MagnifierIcon, onClick: onSearch },
  ];

  return (
    <div className="md:hidden fixed bottom-3 left-3 right-3 z-40">
      <div className="flex items-center justify-around px-3 py-2 rounded-[26px] liquid-glass-strong border border-white/[0.1] shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        {items.map(item => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              onClick={item.onClick}
              whileTap={{ scale: 0.88 }}
              className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'text-white bg-white/[0.1] shadow-[0_4px_12px_rgba(255,255,255,0.1)]'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <Icon size={21} strokeWidth={isActive ? 2.4 : 1.8} />
              <span className={`text-[10px] font-medium tracking-tight ${isActive ? 'text-white font-semibold' : 'text-white/50'}`}>
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
