import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  LayoutGrid, Plus, GripVertical, Calendar, User, Tag, X, Loader, Check, Trash2, Edit3,
  ChevronDown, Filter, AlertCircle, Clock,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface KanbanBoardProps {
  onClose: () => void;
}

type Priority = 'low' | 'medium' | 'high' | 'urgent';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  assignee: string;
  deadline: string;
  labels: string[];
  columnId: string;
}

interface Column {
  id: string;
  title: string;
  color: string;
}

const PRIORITY_COLORS: Record<Priority, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-blue-500/10', text: 'text-blue-400/70', label: 'Низкий' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400/70', label: 'Средний' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400/70', label: 'Высокий' },
  urgent: { bg: 'bg-red-500/10', text: 'text-red-400/70', label: 'Срочный' },
};

const LABELS = ['Баг', 'Фича', 'Документация', 'Дизайн', 'Бэкенд', 'Фронтенд'];

const INITIAL_COLUMNS: Column[] = [
  { id: 'todo', title: 'К выполнению', color: 'bg-blue-500/20' },
  { id: 'progress', title: 'В работе', color: 'bg-yellow-500/20' },
  { id: 'review', title: 'На проверке', color: 'bg-purple-500/20' },
  { id: 'done', title: 'Готово', color: 'bg-green-500/20' },
];

export default function KanbanBoard({ onClose }: KanbanBoardProps) {
  const [columns] = useState<Column[]>(INITIAL_COLUMNS);
  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', title: 'Исправить баг авторизации', description: 'Пользователи не могут войти через Google', priority: 'urgent', assignee: 'Алексей', deadline: '2025-01-20', labels: ['Баг'], columnId: 'progress' },
    { id: '2', title: 'Добавить тёмную тему', description: 'Реализовать переключатель темы', priority: 'high', assignee: 'Мария', deadline: '2025-01-25', labels: ['Фича', 'Дизайн'], columnId: 'todo' },
    { id: '3', title: 'Обновить README', description: 'Добавить документацию по API', priority: 'low', assignee: '', deadline: '', labels: ['Документация'], columnId: 'todo' },
    { id: '4', title: 'Оптимизировать запросы', description: 'Ускорить загрузку страницы', priority: 'medium', assignee: 'Дмитрий', deadline: '2025-01-22', labels: ['Бэкенд'], columnId: 'review' },
  ]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newAssignee, setNewAssignee] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newLabels, setNewLabels] = useState<string[]>([]);

  const resetForm = useCallback(() => {
    setNewTitle('');
    setNewDesc('');
    setNewPriority('medium');
    setNewAssignee('');
    setNewDeadline('');
    setNewLabels([]);
  }, []);

  const handleCreate = useCallback(() => {
    if (!newTitle.trim()) return;
    const task: Task = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      description: newDesc.trim(),
      priority: newPriority,
      assignee: newAssignee.trim(),
      deadline: newDeadline,
      labels: newLabels,
      columnId: 'todo',
    };
    setTasks(prev => [...prev, task]);
    resetForm();
    setShowCreate(false);
    toast.success('Задача создана');
  }, [newTitle, newDesc, newPriority, newAssignee, newDeadline, newLabels, resetForm]);

  const handleDelete = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    toast.success('Задача удалена');
  }, []);

  const handleDragStart = useCallback((taskId: string) => {
    setDraggedTask(taskId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(colId);
  }, []);

  const handleDrop = useCallback((colId: string) => {
    if (!draggedTask) return;
    setTasks(prev => prev.map(t => t.id === draggedTask ? { ...t, columnId: colId } : t));
    setDraggedTask(null);
    setDragOverCol(null);
  }, [draggedTask]);

  const toggleLabel = useCallback((label: string) => {
    setNewLabels(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/20 flex items-center justify-center">
            <LayoutGrid size={15} className="text-amber-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Доска задач</h2>
        </div>
        <div className="flex items-center gap-1">
          <motion.button onClick={() => { setShowCreate(v => !v); resetForm(); }}
            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="Добавить задачу">
            <Plus size={15} className="text-white/40" />
          </motion.button>
          <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <X size={15} className="text-white/40" />
          </motion.button>
        </div>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden border-b border-white/[0.06]">
            <div className="px-3 py-3 space-y-2">
              <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Название задачи..."
                className="w-full h-9 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20" />
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} placeholder="Описание..."
                className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20 resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <select value={newPriority} onChange={e => setNewPriority(e.target.value as Priority)}
                  className="h-8 px-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/60 outline-none">
                  {Object.entries(PRIORITY_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)}
                  className="h-8 px-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/60 outline-none [color-scheme:dark]" />
              </div>
              <input type="text" value={newAssignee} onChange={e => setNewAssignee(e.target.value)} placeholder="Исполнитель..."
                className="w-full h-8 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20" />
              <div className="flex flex-wrap gap-1">
                {LABELS.map(l => (
                  <button key={l} onClick={() => toggleLabel(l)}
                    className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${newLabels.includes(l) ? 'bg-amber-500/15 border-amber-500/20 text-amber-400/70' : 'bg-white/[0.03] border-white/[0.06] text-white/30 hover:bg-white/[0.06]'}`}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl bg-white/[0.04] text-xs text-white/50">Отмена</button>
                <motion.button onClick={handleCreate} disabled={!newTitle.trim()}
                  className="flex-1 py-2 rounded-xl bg-amber-500/20 border border-amber-500/20 text-xs text-amber-400/80 font-medium disabled:opacity-40"
                  whileTap={{ scale: 0.98 }}>
                  Создать
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-3 py-3">
        <div className="flex gap-3 h-full min-w-max">
          {columns.map(col => {
            const colTasks = tasks.filter(t => t.columnId === col.id);
            return (
              <div key={col.id} className="w-64 flex-shrink-0 flex flex-col"
                onDragOver={e => handleDragOver(e, col.id)} onDrop={() => handleDrop(col.id)}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className={`w-2 h-2 rounded-full ${col.color}`} />
                  <span className="text-xs font-medium text-white/60">{col.title}</span>
                  <span className="text-[10px] text-white/25 ml-auto">{colTasks.length}</span>
                </div>
                <div className={`flex-1 space-y-1.5 p-1.5 rounded-xl transition-colors ${dragOverCol === col.id ? 'bg-white/[0.04]' : ''}`}>
                  {colTasks.map(task => (
                    <motion.div key={task.id} layout
                      draggable onDragStart={() => handleDragStart(task.id)} onDragEnd={() => { setDraggedTask(null); setDragOverCol(null); }}
                      className={`p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] cursor-grab active:cursor-grabbing hover:bg-white/[0.06] transition-colors ${draggedTask === task.id ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between mb-1.5">
                        <p className="text-xs text-white/70 font-medium flex-1 pr-1">{task.title}</p>
                        <button onClick={() => handleDelete(task.id)} className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.08]">
                          <Trash2 size={10} className="text-red-400/50" />
                        </button>
                      </div>
                      {task.description && <p className="text-[10px] text-white/30 mb-1.5 line-clamp-2">{task.description}</p>}
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] ${PRIORITY_COLORS[task.priority].bg} ${PRIORITY_COLORS[task.priority].text}`}>
                          {PRIORITY_COLORS[task.priority].label}
                        </span>
                        {task.labels.map(l => (
                          <span key={l} className="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.04] text-white/30">{l}</span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-white/20">
                        {task.assignee && <span className="flex items-center gap-1"><User size={9} />{task.assignee}</span>}
                        {task.deadline && <span className="flex items-center gap-1"><Calendar size={9} />{task.deadline}</span>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}