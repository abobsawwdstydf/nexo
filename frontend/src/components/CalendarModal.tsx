import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Calendar, MapPin, Users, Check, X as XIcon } from 'lucide-react';
import { api } from '../lib/api';
import Avatar from './Avatar';

interface CalendarModalProps {
  chatId?: string;
  onClose: () => void;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt?: string;
  creator: any;
  invites: any[];
  createdAt: string;
}

export default function CalendarModal({ chatId, onClose }: CalendarModalProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newStartAt, setNewStartAt] = useState('');
  const [newEndAt, setNewEndAt] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/calendar' + (chatId ? '?chatId=' + encodeURIComponent(chatId) : ''));
      setEvents(response);
    } catch (error) {
      console.error('Load events error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newStartAt) return;

    try {
      const event = await api.post('/api/calendar', {
        title: newTitle,
        description: newDescription,
        location: newLocation,
        startAt: newStartAt,
        endAt: newEndAt || null,
        chatId: chatId || null,
      });
      setEvents([event, ...events]);
      setNewTitle('');
      setNewDescription('');
      setNewLocation('');
      setNewStartAt('');
      setNewEndAt('');
      setShowCreate(false);
    } catch (error) {
      console.error('Create event error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/calendar/${id}`);
      setEvents(events.filter(e => e.id !== id));
      setSelectedEvent(null);
    } catch (error) {
      console.error('Delete event error:', error);
    }
  };

  const handleRespond = async (eventId: string, status: string) => {
    try {
      await api.post(`/api/calendar/${eventId}/respond`, { status });
      loadEvents();
    } catch (error) {
      console.error('Respond to invite error:', error);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 sm:inset-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[500px] sm:h-[600px] bg-surface-secondary/95 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Calendar size={20} />
          Календарь
        </h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition"
        >
          <X size={20} className="text-white/60" />
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="p-4 border-b border-white/10 space-y-3 max-h-48 overflow-y-auto">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Название события..."
            className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nexo-500"
          />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Описание..."
            className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nexo-500 resize-none h-12"
          />
          <input
            type="text"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            placeholder="Место..."
            className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nexo-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              value={newStartAt}
              onChange={(e) => setNewStartAt(e.target.value)}
              className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nexo-500"
            />
            <input
              type="datetime-local"
              value={newEndAt}
              onChange={(e) => setNewEndAt(e.target.value)}
              className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nexo-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || !newStartAt}
              className="flex-1 px-3 py-2 bg-nexo-500 hover:bg-nexo-600 text-white rounded-lg transition text-sm disabled:opacity-50"
            >
              Создать
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-sm"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Events list or detail view */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedEvent ? (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <button
              onClick={() => setSelectedEvent(null)}
              className="text-nexo-500 hover:text-nexo-400 text-sm mb-4"
            >
              ← Назад
            </button>

            <div>
              <h3 className="text-lg font-semibold text-white">{selectedEvent.title}</h3>
              {selectedEvent.description && (
                <p className="text-white/60 text-sm mt-2">{selectedEvent.description}</p>
              )}
            </div>

            {selectedEvent.location && (
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <MapPin size={16} />
                {selectedEvent.location}
              </div>
            )}

            <div className="text-white/60 text-sm">
              <div>Начало: {formatDate(selectedEvent.startAt)}</div>
              {selectedEvent.endAt && (
                <div>Конец: {formatDate(selectedEvent.endAt)}</div>
              )}
            </div>

            {selectedEvent.invites.length > 0 && (
              <div>
                <h4 className="text-white/60 text-sm mb-2 flex items-center gap-2">
                  <Users size={16} />
                  Приглашены ({selectedEvent.invites.length})
                </h4>
                <div className="space-y-2">
                  {selectedEvent.invites.map(invite => (
                    <div key={invite.id} className="flex items-center justify-between bg-white/10 rounded p-2">
                      <div className="flex items-center gap-2">
                        <Avatar src={invite.user.avatar} name={invite.user.displayName} size="sm" />
                        <div>
                          <div className="text-white text-sm">{invite.user.displayName}</div>
                          <div className="text-white/60 text-xs">
                            {invite.status === 'accepted' && '✓ Принял'}
                            {invite.status === 'declined' && '✗ Отклонил'}
                            {invite.status === 'tentative' && '? Может быть'}
                            {invite.status === 'pending' && 'Ожидание'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => handleDelete(selectedEvent.id)}
              className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition text-sm"
            >
              Удалить событие
            </button>
          </motion.div>
        ) : (
          <>
            {loading && (
              <div className="text-center text-white/60 py-8">Загрузка...</div>
            )}

            {!loading && events.length === 0 && !showCreate && (
              <div className="text-center text-white/60 py-8">
                Нет событий
              </div>
            )}

            <AnimatePresence>
              {events.map(event => (
                <motion.button
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onClick={() => setSelectedEvent(event)}
                  className="w-full text-left bg-white/10 hover:bg-white/20 rounded-lg p-3 transition mb-2"
                >
                  <h3 className="text-white font-medium text-sm">{event.title}</h3>
                  <p className="text-white/60 text-xs mt-1">
                    {formatDate(event.startAt)}
                  </p>
                </motion.button>
              ))}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-nexo-500 hover:bg-nexo-600 text-white rounded-lg transition text-sm"
        >
          <Plus size={16} />
          Новое событие
        </button>
      </div>
    </motion.div>
  );
}
