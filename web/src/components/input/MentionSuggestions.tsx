import { AnimatePresence, motion } from 'framer-motion';

interface MentionMember {
  user: {
    username: string;
    displayName: string;
    avatar?: string | null;
  };
}

interface MentionSuggestionsProps {
  members: MentionMember[];
  mentionIndex: number;
  onSelect: (member: MentionMember) => void;
}

export default function MentionSuggestions({ members, mentionIndex, onSelect }: MentionSuggestionsProps) {
  if (members.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="absolute bottom-full left-0 right-0 mb-2 max-w-3xl mx-auto z-30"
      >
        <div className="bg-[#1a1a1f]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden mx-6">
          {members.map((member, i) => (
            <button
              key={member.user.username}
              onClick={() => onSelect(member)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${
                i === mentionIndex ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              {member.user.avatar ? (
                <img src={member.user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-nexo-500/30 flex items-center justify-center text-nexo-300 text-sm font-semibold">
                  {member.user.displayName[0]}
                </div>
              )}
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-white">{member.user.displayName}</p>
                <p className="text-xs text-zinc-400">@{member.user.username}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
