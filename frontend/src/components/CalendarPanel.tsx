import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Plus, X, Check, Clock, ChevronLeft, ChevronRight, User, MapPin,
  Trash2, Edit3, Loader, AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface CalendarPanelProps {
  onClose: () => void;
}

type ViewMode = 'month' | 'week' | 'day';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  color: string;
  attendees: string[];
  rsvp: 'accepted' | 'declined' | 'maybe' | 'pending';
}

const EVENT_COLORS = ['#6366f1', '#22c55e', '#f97316', '#ef4444', '#eab308', '#8b5cf6', '#06b6d4', '#ec4899'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export default function CalendarPanel({ onClose }: CalendarPanelProps) {
  const [view, setView] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([
    { id: '1', title: 'Встреча команды', description: 'Обсуждение спринта', location: 'Офис', startAt: '2025-01-15T10:00:00', endAt: '2025-01-15T11:00:00', color: '#6366f1', attendees: ['Алексей', 'Мария'], rsvp: 'accepted' },
    { id: '2', title: 'Дедлайн проекта', description: 'Финальная сдача', location: '', startAt: '2025-01-20T09:00:00', endAt: '2025-01-20T18:00:00', color: '#ef4444', attendees: [], rsvp: 'pending' },
  ]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndDate, setNewEndDate] = useState('');
  const [newEndTime, setNewEndTime] = useState('10:00');
  const [newColor, setNewColor] = useState('#6366f1');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (d: Date) => (new Date(d.getFullYear(), d.getMonth(), 1).getDay() + 6) % 7;

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const handleCreate = useCallback(() => {
    if (!newTitle.trim() || !newStartDate) return;
    const event: CalendarEvent = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      description: newDesc.trim(),
      location: newLocation.trim(),
      startAt: `${newStartDate}T${newStartTime}:00`,
      endAt: newEndDate ? `${newEndDate}T${newEndTime}:00` : `${newStartDate}T${newEndTime}:00`,
      color: newColor,
      attendees: [],
      rsvp: 'pending',
    };
    setEvents(prev => [...prev, event]);
    setNewTitle(''); setNewDesc(''); setNewLocation(''); setNewStartDate(''); setNewEndDate('');
    setShowCreate(false);
    toast.success('Событие создано');
  }, [newTitle, newDesc, newLocation, newStartDate, newStartTime, newEndDate, newEndTime, newColor]);

  const handleDelete = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    setSelectedEvent(null);
    toast.success('Событие удалено');
  }, []);

  const handleRSVP = useCallback((id: string, status: 'accepted' | 'declined' | 'maybe') => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, rsvp: status } : e));
  }, []);

  const renderMonthView = () => {
    const days = daysInMonth(currentDate);
    const start = firstDayOfMonth(currentDate);
    const cells = [];

    for (let i = 0; i < start; i++) {
      cells.push(<div key={`empty-${i}`} className="h-8" />);
    }
    for (let d = 1; d <= days; d++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.startAt.startsWith(dateStr));
      const isToday = new Date().toISOString().slice(0, 10) === dateStr;
      cells.push(
        <button key={d} onClick={() => setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), d))}
          className={`h-8 rounded-lg flex flex-col items-center justify-center text-[10px] transition-colors relative ${isToday ? 'bg-indigo-500/20 text-indigo-400 font-bold' : 'text-white/50 hover:bg-white/[0.04]'}`}>
          {d}
          {dayEvents.length > 0 && (
            <div className="flex gap-0.5 absolute bottom-0.5">
              {dayEvents.slice(0, 3).map((e, i) => (
                <div key={i} className="w-1 h-1 rounded-full" style={{ backgroundColor: e.color }} />
              ))}
            </div>
          )}
        </button>
      );
    }
    return cells;
  };

  const selectedDayEvents = selectedDate ? events.filter(e => e.startAt.startsWith(selectedDate.toISOString().slice(0, 10))) : [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center">
            <Calendar size={15} className="text-indigo-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Календарь</h2>
        </div>
        <div className="flex items-center gap-1">
          <motion.button onClick={() => setShowCreate(v => !v)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileTap={{ scale: 0.95 }}>
            <Plus size={15} className="text-white/40" />
          </motion.button>
          <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileTap={{ scale: 0.95 }}>
            <X size={15} className="text-white/40" />
          </motion.button>
        </div>
      </div>

      {/* View switcher */}
      <div className="flex-shrink-0 flex gap-1 px-3 py-2 border-b border-white/[0.06]">
        {(['month', 'week', 'day'] as ViewMode[]).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${view === v ? 'bg-white/[0.08] text-white/80' : 'text-white/40 hover:bg-white/[0.04]'}`}>
            {v === 'month' ? 'Месяц' : v === 'week' ? 'Неделя' : 'День'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {view === 'month' && (
          <>
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/[0.06]"><ChevronLeft size={14} className="text-white/40" /></button>
              <span className="text-xs text-white/70 font-medium">{MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/[0.06]"><ChevronRight size={14} className="text-white/40" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_NAMES.map(d => <div key={d} className="text-[9px] text-white/25 text-center py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">{renderMonthView()}</div>
          </>
        )}

        {/* Selected day events */}
        {selectedDate && (
          <div className="mt-3">
            <p className="text-[10px] text-white/30 uppercase mb-2 px-1">
              {selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </p>
            {selectedDayEvents.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-4">Нет событий</p>
            ) : (
              <div className="space-y-1.5">
                {selectedDayEvents.map(ev => (
                  <div key={ev.id} onClick={() => setSelectedEvent(ev)} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
                      <p className="text-xs text-white/70 font-medium">{ev.title}</p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/25">
                      <span className="flex items-center gap-1"><Clock size={9} />{new Date(ev.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                      {ev.location && <span className="flex items-center gap-1"><MapPin size={9} />{ev.location}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event detail */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}
            className="absolute bottom-0 left-0 right-0 p-3 bg-black/90 backdrop-blur-xl border-t border-white/10 rounded-t-2xl z-50">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedEvent.color }} />
                <h3 className="text-sm font-semibold text-white/90">{selectedEvent.title}</h3>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-1 rounded-lg hover:bg-white/[0.1]"><X size={14} className="text-white/40" /></button>
            </div>
            {selectedEvent.description && <p className="text-xs text-white/50 mb-2">{selectedEvent.description}</p>}
            <div className="flex items-center gap-3 text-[10px] text-white/30 mb-3">
              <span className="flex items-center gap-1"><Clock size={9} />{new Date(selectedEvent.startAt).toLocaleString('ru-RU')}</span>
              {selectedEvent.location && <span className="flex items-center gap-1"><MapPin size={9} />{selectedEvent.location}</span>}
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => handleRSVP(selectedEvent.id, 'accepted')} className={`flex-1 py-1.5 rounded-lg text-[10px] transition-colors ${selectedEvent.rsvp === 'accepted' ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-white/[0.04] text-white/40'}`}>Принять</button>
              <button onClick={() => handleRSVP(selectedEvent.id, 'maybe')} className={`flex-1 py-1.5 rounded-lg text-[10px] transition-colors ${selectedEvent.rsvp === 'maybe' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20' : 'bg-white/[0.04] text-white/40'}`}>Возможно</button>
              <button onClick={() => handleRSVP(selectedEvent.id, 'declined')} className={`flex-1 py-1.5 rounded-lg text-[10px] transition-colors ${selectedEvent.rsvp === 'declined' ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-white/[0.04] text-white/40'}`}>Отклонить</button>
            </div>
            <button onClick={() => handleDelete(selectedEvent.id)} className="w-full mt-2 py-1.5 rounded-lg bg-red-500/10 text-[10px] text-red-400/50 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1">
              <Trash2 size={10} />Удалить
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}
            className="absolute bottom-0 left-0 right-0 p-3 bg-black/90 backdrop-blur-xl border-t border-white/10 rounded-t-2xl z-50 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white/80">Новое событие</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-white/[0.1]"><X size={14} className="text-white/40" /></button>
            </div>
            <div className="space-y-2">
              <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Название..."
                className="w-full h-9 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20" />
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} placeholder="Описание..."
                className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none resize-none" />
              <input type="text" value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="Место..."
                className="w-full h-8 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-white/25 block mb-0.5">Начало</label>
                  <input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)}
                    className="w-full h-7 px-2 text-[10px] bg-white/[0.04] border border-white/[0.06] rounded-lg text-white/60 outline-none [color-scheme:dark]" />
                  <input type="time" value={newStartTime} onChange={e => setNewStartTime(e.target.value)}
                    className="w-full h-7 px-2 text-[10px] bg-white/[0.04] border border-white/[0.06] rounded-lg text-white/60 outline-none mt-1 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="text-[9px] text-white/25 block mb-0.5">Конец</label>
                  <input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)}
                    className="w-full h-7 px-2 text-[10px] bg-white/[0.04] border border-white/[0.06] rounded-lg text-white/60 outline-none [color-scheme:dark]" />
                  <input type="time" value={newEndTime} onChange={e => setNewEndTime(e.target.value)}
                    className="w-full h-7 px-2 text-[10px] bg-white/[0.04] border border-white/[0.06] rounded-lg text-white/60 outline-none mt-1 [color-scheme:dark]" />
                </div>
              </div>
              <div className="flex gap-1.5">
                {EVENT_COLORS.map(c => (
                  <button key={c} onClick={() => setNewColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${newColor === c ? 'border-white/60 scale-110' : 'border-white/10'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl bg-white/[0.04] text-xs text-white/50">Отмена</button>
                <motion.button onClick={handleCreate} disabled={!newTitle.trim() || !newStartDate}
                  className="flex-1 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/20 text-xs text-indigo-400/80 font-medium disabled:opacity-40"
                  whileTap={{ scale: 0.98 }}>Создать</motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}