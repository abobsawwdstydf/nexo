import { getSocket } from '../../lib/socket';
import type { Reaction } from '../../lib/types';
import AnimatedEmoji from '../AnimatedEmoji';

interface ReactionBarProps {
  reactions: Reaction[];
  userId: string | undefined;
  messageId: string;
  chatId: string;
  isMine: boolean;
}

export default function ReactionBar({ reactions, userId, messageId, chatId, isMine }: ReactionBarProps) {
  if (!reactions || reactions.length === 0) return null;

  const reactionGroups: Record<string, { count: number; users: string[]; isMine: boolean }> = {};
  reactions.filter(r => !r.emoji.startsWith('option_')).forEach((r) => {
    if (!reactionGroups[r.emoji]) {
      reactionGroups[r.emoji] = { count: 0, users: [], isMine: false };
    }
    reactionGroups[r.emoji].count++;
    reactionGroups[r.emoji].users.push(r.user?.displayName || r.user?.username || '');
    if (r.userId === userId) reactionGroups[r.emoji].isMine = true;
  });

  if (Object.keys(reactionGroups).length === 0) return null;

  const handleReaction = (emoji: string) => {
    const socket = getSocket();
    if (socket) {
      const existingReaction = reactions.find(
        (r) => r.userId === userId && r.emoji === emoji
      );
      if (existingReaction) {
        socket.emit('remove_reaction', { messageId, chatId, emoji });
      } else {
        socket.emit('add_reaction', { messageId, chatId, emoji });
      }
    }
  };

  return (
    <div className="flex flex-wrap gap-1 mt-1 mx-1">
      {Object.entries(reactionGroups).map(([emoji, data]) => (
        <button
          key={emoji}
          onClick={() => handleReaction(emoji)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${data.isMine
            ? 'bg-nexo-500/30 border border-nexo-500/50'
            : 'bg-surface-tertiary border border-border hover:border-zinc-600'
            }`}
          title={data.users.join(', ')}
        >
          <AnimatedEmoji emoji={emoji} size={18} />
          <span className="text-zinc-400">{data.count}</span>
        </button>
      ))}
    </div>
  );
}
