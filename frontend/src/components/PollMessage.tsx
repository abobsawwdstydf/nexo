import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';

interface PollMessageProps {
  poll: {
    id: string;
    question: string;
    allowMultiple: boolean;
    isAnonymous: boolean;
    endsAt?: string;
    options: Array<{
      id: string;
      text: string;
      votes: any[];
    }>;
  };
}

export default function PollMessage({ poll }: PollMessageProps) {
  const { user } = useAuthStore();
  const { error } = useToastStore();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isVoting, setIsVoting] = useState(false);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    loadResults();
  }, [poll.id]);

  const loadResults = async () => {
    try {
      const data: any = await api.getPollResults(poll.id);
      setResults(data);
      
      // Проверяем за что проголосовал текущий пользователь
      if (!poll.isAnonymous) {
        const myVotes: string[] = [];
        data.options.forEach((opt: any) => {
          if (opt.votes.some((v: any) => v.userId === user?.id)) {
            myVotes.push(opt.id);
          }
        });
        setSelectedOptions(myVotes);
      }
    } catch (err) {
      console.error('Error loading poll results:', err);
    }
  };

  const handleVote = async () => {
    if (selectedOptions.length === 0) {
      error('Выберите хотя бы один вариант');
      return;
    }

    setIsVoting(true);
    try {
      await api.votePoll(poll.id, selectedOptions);
      await loadResults();
    } catch (err) {
      console.error('Error voting:', err);
      error('Не удалось проголосовать');
    } finally {
      setIsVoting(false);
    }
  };

  const toggleOption = (optionId: string) => {
    if (poll.allowMultiple) {
      setSelectedOptions(prev =>
        prev.includes(optionId)
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      setSelectedOptions([optionId]);
    }
  };

  const hasVoted = selectedOptions.length > 0 && results?.options.some((opt: any) =>
    selectedOptions.includes(opt.id) && opt.votes.some((v: any) => v.userId === user?.id)
  );

  const isEnded = poll.endsAt && new Date(poll.endsAt) < new Date();
  const totalVotes = results?.totalVotes || 0;

  return (
    <div className="bg-surface/50 rounded-xl p-4 space-y-3 max-w-md">
      {/* Question */}
      <div className="font-medium">{poll.question}</div>

      {/* Options */}
      <div className="space-y-2">
        {(results?.options || poll.options).map((option: any) => {
          const isSelected = selectedOptions.includes(option.id);
          const percentage = option.percentage || 0;
          const voteCount = option.voteCount || option.votes?.length || 0;

          return (
            <button
              key={option.id}
              onClick={() => !hasVoted && !isEnded && toggleOption(option.id)}
              disabled={hasVoted || isEnded}
              className={`relative w-full text-left p-3 rounded-lg transition-all ${
                hasVoted || isEnded
                  ? 'cursor-default'
                  : 'hover:bg-white/5 cursor-pointer'
              } ${
                isSelected && !hasVoted
                  ? 'bg-nexo-500/20 ring-2 ring-nexo-500'
                  : 'bg-surface'
              }`}
            >
              {/* Progress bar */}
              {(hasVoted || isEnded) && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="absolute inset-0 bg-nexo-500/20 rounded-lg"
                />
              )}

              {/* Content */}
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isSelected && !hasVoted && (
                    <Check size={16} className="text-nexo-400" />
                  )}
                  <span className="text-sm">{option.text}</span>
                </div>
                {(hasVoted || isEnded) && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span>{percentage.toFixed(0)}%</span>
                    <span>({voteCount})</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-1">
          <Users size={14} />
          <span>{totalVotes} {totalVotes === 1 ? 'голос' : 'голосов'}</span>
        </div>
        {poll.endsAt && !isEnded && (
          <span>Завершится {new Date(poll.endsAt).toLocaleString('ru')}</span>
        )}
        {isEnded && <span className="text-red-400">Опрос завершён</span>}
      </div>

      {/* Vote button */}
      {!hasVoted && !isEnded && selectedOptions.length > 0 && (
        <button
          onClick={handleVote}
          disabled={isVoting}
          className="w-full py-2 bg-nexo-500 hover:bg-nexo-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          {isVoting ? 'Голосование...' : 'Проголосовать'}
        </button>
      )}

      {/* Info */}
      <div className="text-xs text-zinc-500">
        {poll.allowMultiple && 'Можно выбрать несколько вариантов'}
        {poll.isAnonymous && ' • Анонимное голосование'}
      </div>
    </div>
  );
}
