import React from 'react';
import { motion } from 'framer-motion';
import { PlusIcon } from '../lib/appleIcons';
import type { User } from '../lib/types';

interface StoriesBarProps {
  user: User | null;
  chats: Array<{ id: string; name: string; avatar: string | null }>;
  onOpenProfile: () => void;
}

export function StoriesBar({ user, chats, onOpenProfile }: StoriesBarProps) {
  return (
    <div className="flex-shrink-0 px-3 py-2 border-b border-white/[0.06]">
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
        <motion.button
          onClick={onOpenProfile}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex flex-col items-center gap-1 min-w-[64px]"
        >
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center border-2 border-dashed border-white/20">
              <PlusIcon size={20} className="text-white/70" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent border-2 border-[#0a0a0f] flex items-center justify-center">
              <PlusIcon size={10} className="text-white" />
            </div>
          </div>
          <span className="text-[10px] text-white/50">Моя история</span>
        </motion.button>

        {chats.slice(0, 8).map((chat) => (
          <motion.button
            key={chat.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-1 min-w-[64px]"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500/30 to-pink-500/30 p-0.5">
              {chat.avatar ? (
                <img
                  src={chat.avatar}
                  alt={chat.name || ''}
                  className="w-full h-full rounded-full object-cover border-2 border-[#0a0a0f]"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-white/[0.08] flex items-center justify-center border-2 border-[#0a0a0f]">
                  <span className="text-sm font-medium text-white/50">
                    {(chat.name || '?').slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <span className="text-[10px] text-white/50 truncate max-w-[64px]">
              {chat.name?.split(' ')[0] || ''}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
