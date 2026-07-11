import { useState } from 'react';
import { motion } from 'framer-motion';

interface SchedulePickerProps {
  calDate: string;
  setCalDate: (v: string) => void;
  calMonth: number;
  setCalMonth: (v: number) => void;
  calYear: number;
  setCalYear: (v: number) => void;
  hour: string;
  setHour: (v: string) => void;
  minute: string;
  setMinute: (v: string) => void;
  onSend: (iso: string) => void;
  t: (k: any) => any;
}

export default function SchedulePicker({
  calDate, setCalDate, calMonth, setCalMonth, calYear, setCalYear,
  hour, setHour, minute, setMinute, onSend, t,
}: SchedulePickerProps) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d2 = 1; d2 <= daysInMonth; d2++) cells.push(d2);

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };

  const selectDay = (day: number) => {
    const m = String(calMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    setCalDate(`${calYear}-${m}-${d}`);
  };

  const isSelected = (day: number) => {
    const m = String(calMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${calYear}-${m}-${d}` === calDate;
  };

  const isToday = (day: number) => {
    return today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;
  };

  const isPast = (day: number) => {
    const m = String(calMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${calYear}-${m}-${d}` < todayStr;
  };

  const canSend = (() => {
    if (!calDate) return false;
    const dt = new Date(`${calDate}T${hour}:${minute}:00`);
    return dt.getTime() > Date.now();
  })();

  const handleSend = () => {
    if (!canSend) return;
    const m = String(calMonth + 1).padStart(2, '0');
    const d = String(calDate.split('-')[2] || '01').padStart(2, '0');
    onSend(`${calYear}-${m}-${d}T${hour}:${minute}:00`);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => {}}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-sm rounded-2xl bg-surface-secondary border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span className="text-sm font-semibold text-white">
              {new Date(calYear, calMonth).toLocaleString(t('ru-RU' as any) || 'ru-RU', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500 mb-2">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => (
              day ? (
                <button
                  key={i}
                  onClick={() => selectDay(day)}
                  disabled={isPast(day)}
                  className={`aspect-square rounded-lg text-sm transition-colors ${
                    isSelected(day)
                      ? 'bg-nexo-500 text-white font-semibold'
                      : isToday(day)
                        ? 'text-nexo-400 font-semibold ring-1 ring-nexo-500/50'
                        : isPast(day)
                          ? 'text-zinc-600 cursor-not-allowed'
                          : 'text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {day}
                </button>
              ) : (
                <span key={i} className="aspect-square" />
              )
            ))}
          </div>
        </div>

        <div className="px-3 pb-2">
          <label className="text-[11px] text-zinc-500 mb-1 block">{t('scheduleTime')}</label>
          <div className="flex items-center gap-2">
            <select
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-nexo-500/50 appearance-none text-center"
            >
              {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                <option key={h} value={h} className="bg-zinc-800">{h}</option>
              ))}
            </select>
            <span className="text-zinc-400 font-bold">:</span>
            <select
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-nexo-500/50 appearance-none text-center"
            >
              {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                <option key={m} value={m} className="bg-zinc-800">{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-3 pb-3">
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="w-full py-2 rounded-xl bg-accent hover:bg-accent-hover disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium transition-colors"
          >
            {t('scheduleSend')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
