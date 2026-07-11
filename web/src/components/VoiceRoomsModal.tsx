import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Mic, MicOff, Users, Lock, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useToastStore } from '../stores/toastStore';

interface VoiceRoomsModalProps {
  onClose: () => void;
}

export default function VoiceRoomsModal({ onClose }: VoiceRoomsModalProps) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const { error } = useToastStore();

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const data = await api.getVoiceRooms();
      setRooms(data as any[]);
    } catch (err) {
      console.error('Error loading rooms:', err);
      error('Не удалось загрузить комнаты');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    try {
      await api.joinVoiceRoom(roomId);
      // Открыть интерфейс комнаты
    } catch (err) {
      console.error('Error joining room:', err);
      error('Не удалось войти в комнату');
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 sm:inset-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[500px] sm:rounded-2xl z-50 bg-surface-secondary border border-border flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Mic size={20} />Голосовые комнаты</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCreate(true)} className="p-2 hover:bg-nexo-500/20 text-nexo-400 rounded-lg"><Plus size={20} /></button>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-zinc-500">Загрузка...</div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">Нет активных комнат</div>
          ) : (
            <div className="space-y-3">
              {rooms.map((room) => (
                <div key={room.id} className="p-4 bg-surface rounded-xl border border-border hover:border-nexo-500/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{room.name}</h3>
                        {!room.isPublic && <Lock size={14} className="text-zinc-500" />}
                      </div>
                      {room.description && <p className="text-sm text-zinc-500 mt-1">{room.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Users size={16} />
                      <span>{room.participants?.length || 0}/{room.maxUsers}</span>
                    </div>
                    <button onClick={() => handleJoinRoom(room.id)} className="px-4 py-2 bg-nexo-500 hover:bg-nexo-600 rounded-lg text-sm font-medium">Войти</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
