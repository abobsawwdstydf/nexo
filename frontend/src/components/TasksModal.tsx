import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, CheckCircle2, Circle, Trash2, Calendar } from 'lucide-react';
import { api } from '../lib/api';
import Avatar from './Avatar';

interface TasksModalProps {
  chatId?: string;
  onClose: () => void;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  deadline?: string;
  creator: any;
  createdAt: string;
}

const PRIORITIES = [
  { value: 'low', label: 'Низкий', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'medium', label: 'Средний', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'high', label: 'Высокий', color: 'bg-red-500/20 text-red-400' },
];

export default function TasksModal({ chatId, onClose }: TasksModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDeadline, setNewDeadline] = useState('');

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/tasks' + (chatId ? '?chatId=' + encodeURIComponent(chatId) : ''));
      setTasks(response.tasks);
    } catch (error) {
      console.error('Load tasks error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !chatId) return;

    try {
      const task = await api.post('/api/tasks', {
        chatId,
        title: newTitle,
        description: newDescription,
        priority: newPriority,
        deadline: newDeadline || null,
      });
      setTasks([task, ...tasks]);
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      setNewDeadline('');
      setShowCreate(false);
    } catch (error) {
      console.error('Create task error:', error);
    }
  };

  const handleToggleStatus = async (task: Task) => {
    try {
      const newStatus = task.status === 'completed' ? 'open' : 'completed';
      const updated = await api.put(`/api/tasks/${task.id}`, {
        status: newStatus,
      });
      setTasks(tasks.map(t => t.id === task.id ? updated : t));
    } catch (error) {
      console.error('Update task error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/tasks/${id}`);
      setTasks(tasks.filter(t => t.id !== id));
    } catch (error) {
      console.error('Delete task error:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    return PRIORITIES.find(p => p.value === priority)?.color || '';
  };

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Сегодня';
    if (date.toDateString() === tomorrow.toDateString()) return 'Завтра';
    return date.toLocaleDateString('ru-RU');
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
        <h2 className="text-lg font-semibold text-white">Задачи</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition"
        >
          <X size={20} className="text-white/60" />
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="p-4 border-b border-white/10 space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Название задачи..."
            className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nexo-500"
          />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Описание..."
            className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nexo-500 resize-none h-16"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nexo-500"
            >
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value} className="bg-surface-primary">
                  {p.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nexo-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim()}
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

      {/* Tasks list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && (
          <div className="text-center text-white/60 py-8">Загрузка...</div>
        )}

        {!loading && tasks.length === 0 && !showCreate && (
          <div className="text-center text-white/60 py-8">
            Нет задач
          </div>
        )}

        <AnimatePresence>
          {tasks.map(task => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`bg-white/10 rounded-lg p-3 transition ${
                task.status === 'completed' ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => handleToggleStatus(task)}
                  className="mt-1 text-white/60 hover:text-nexo-500 transition"
                >
                  {task.status === 'completed' ? (
                    <CheckCircle2 size={20} className="text-green-400" />
                  ) : (
                    <Circle size={20} />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <h3 className={`font-medium text-sm ${
                    task.status === 'completed'
                      ? 'text-white/60 line-through'
                      : 'text-white'
                  }`}>
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-white/60 text-xs mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(task.priority)}`}>
                      {PRIORITIES.find(p => p.value === task.priority)?.label}
                    </span>
                    {task.deadline && (
                      <span className="text-xs text-white/60 flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDeadline(task.deadline)}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-1 hover:bg-red-500/20 text-red-400 rounded transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {chatId && (
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-nexo-500 hover:bg-nexo-600 text-white rounded-lg transition text-sm"
          >
            <Plus size={16} />
            Новая задача
          </button>
        </div>
      )}
    </motion.div>
  );
}
