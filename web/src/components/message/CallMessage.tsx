import { Phone, PhoneMissed, Video } from 'lucide-react';
import type { Message } from '../../lib/types';

interface CallMessageProps {
  message: Message;
  isMine: boolean;
}

function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CallMessage({ message, isMine }: CallMessageProps) {
  if (message.type !== 'call') return null;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
        message.callStatus === 'missed' || message.callStatus === 'declined' 
          ? 'bg-red-500/20' 
          : 'bg-emerald-500/20'
      }`}>
        {message.callStatus === 'missed' ? (
          <PhoneMissed size={18} className="text-red-400" />
        ) : message.callStatus === 'declined' ? (
          <PhoneMissed size={18} className="text-red-400" />
        ) : message.callType === 'video' ? (
          <Video size={18} className="text-emerald-400" />
        ) : (
          <Phone size={18} className="text-emerald-400" />
        )}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${
          message.callStatus === 'missed' || message.callStatus === 'declined'
            ? 'text-red-400'
            : 'text-zinc-200'
        }`}>
          {message.callStatus === 'missed' 
            ? 'Пропущенный вызов'
            : message.callStatus === 'declined'
            ? 'Отменённый вызов'
            : message.callStatus === 'completed'
            ? `${message.callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок'} (${formatCallDuration(message.callDuration || 0)})`
            : message.callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок'
          }
        </p>
      </div>
    </div>
  );
}
