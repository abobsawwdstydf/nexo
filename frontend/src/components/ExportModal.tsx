import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileText, Image, MessageSquare } from 'lucide-react';
import { api } from '../lib/api';
import { useToastStore } from '../stores/toastStore';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const { success, error } = useToastStore();

  const handleExport = async (type: 'all' | 'messages' | 'media') => {
    setExporting(type);
    try {
      const endpoint = type === 'all' ? '/data-export' : `/data-export/${type}`;
      const response = await api.get(endpoint);
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexo-${type}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success(`Экспорт ${type === 'all' ? 'данных' : type === 'messages' ? 'сообщений' : 'медиа'} завершён`);
      onClose();
    } catch (e: any) {
      error(e.message || 'Ошибка экспорта');
    } finally {
      setExporting(null);
    }
  };

  if (!isOpen) return null;

  const options = [
    {
      type: 'all' as const,
      icon: <FileText className="w-6 h-6" />,
      title: 'Все данные',
      desc: 'Профиль, сообщения, друзья, звонки, задачи',
    },
    {
      type: 'messages' as const,
      icon: <MessageSquare className="w-6 h-6" />,
      title: 'Сообщения',
      desc: 'Все сообщения во всех чатах',
    },
    {
      type: 'media' as const,
      icon: <Image className="w-6 h-6" />,
      title: 'Медиафайлы',
      desc: 'Фото, видео и файлы',
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-primary">Экспорт данных</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition">
              <X className="w-5 h-5 text-secondary" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <p className="text-sm text-secondary">
              Экспортируйте ваши данные в формате JSON
            </p>
            {options.map((opt) => (
              <button
                key={opt.type}
                onClick={() => handleExport(opt.type)}
                disabled={exporting !== null}
                className="flex items-center gap-3 w-full p-4 border border-border rounded-xl hover:border-accent/50 hover:bg-accent/5 transition disabled:opacity-50 text-left"
              >
                <div className="text-accent">{opt.icon}</div>
                <div>
                  <div className="font-medium text-primary">{opt.title}</div>
                  <div className="text-xs text-secondary">{opt.desc}</div>
                </div>
                {exporting === opt.type && (
                  <div className="ml-auto animate-spin w-4 h-4 border-2 border-accent border-t-transparent rounded-full" />
                )}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
