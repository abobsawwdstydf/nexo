import { motion } from 'framer-motion';
import { PlusIcon } from '../lib/appleIcons';
import type { StoryGroup } from '../lib/types';
import { normalizeMediaUrl } from '../lib/mediaUrl';

interface StoriesBarProps {
  myAvatar: string | null;
  myName: string;
  groups: StoryGroup[];
  onCreate: () => void;
  onOpenGroup: (groupIndex: number) => void;
}

export function StoriesBar({ myAvatar, myName, groups, onCreate, onOpenGroup }: StoriesBarProps) {
  return (
    <div className="flex-shrink-0 px-3 py-2 border-b border-white/[0.04]">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
        <motion.button
          onClick={onCreate}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex flex-col items-center gap-1 min-w-[64px]"
        >
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center border-2 border-dashed border-white/20">
              {myAvatar ? (
                <img
                  src={normalizeMediaUrl(myAvatar)}
                  alt=""
                  className="w-full h-full rounded-full object-cover border-2 border-[#0a0a0f]"
                />
              ) : (
                <PlusIcon size={20} className="text-white/70" />
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent border-2 border-[#0a0a0f] flex items-center justify-center">
              <PlusIcon size={10} className="text-white" />
            </div>
          </div>
          <span className="text-[10px] text-white/50">Моя история</span>
        </motion.button>

        {groups.slice(0, 20).map((group, idx) => {
          const gradient = group.hasUnviewed
            ? 'bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500'
            : 'bg-white/[0.12]';
          return (
            <motion.button
              key={group.user.id}
              onClick={() => onOpenGroup(idx)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1 min-w-[64px]"
            >
              <div className={`w-14 h-14 rounded-full ${gradient} p-0.5`}>
                {group.user.avatar ? (
                  <img
                    src={normalizeMediaUrl(group.user.avatar)}
                    alt={group.user.displayName || group.user.username || ''}
                    className="w-full h-full rounded-full object-cover border-2 border-[#0a0a0f]"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-white/[0.08] flex items-center justify-center border-2 border-[#0a0a0f]">
                    <span className="text-sm font-medium text-white/50">
                      {(group.user.displayName || group.user.username || '?').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-white/50 truncate max-w-[64px]">
                {(group.user.displayName || group.user.username || '').split(' ')[0]}
              </span>
            </motion.button>
          );
        })}

        {groups.length === 0 && (
          <p className="text-[11px] text-white/30 pl-1">
            Истории друзей появятся здесь
          </p>
        )}
      </div>
    </div>
  );
}