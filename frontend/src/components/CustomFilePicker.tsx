import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, File, Image, Video, Music, FileText } from 'lucide-react';
import { useRef } from 'react';

interface CustomFilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (files: FileList) => void;
  accept?: string;
  multiple?: boolean;
  title?: string;
}

export default function CustomFilePicker({
  isOpen,
  onClose,
  onFileSelect,
  accept,
  multiple = false,
  title = 'Выберите файл',
}: CustomFilePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files);
      onClose();
    }
  };

  const getFileTypeIcon = () => {
    if (!accept) return <File size={48} className="text-nexo-500" />;
    if (accept.includes('image')) return <Image size={48} className="text-nexo-500" />;
    if (accept.includes('video')) return <Video size={48} className="text-nexo-500" />;
    if (accept.includes('audio')) return <Music size={48} className="text-nexo-500" />;
    return <FileText size={48} className="text-nexo-500" />;
  };

  const getAcceptText = () => {
    if (!accept) return 'Любые файлы';
    if (accept.includes('image')) return 'Изображения';
    if (accept.includes('video')) return 'Видео';
    if (accept.includes('audio')) return 'Аудио';
    return 'Файлы';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md z-[10001]"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X size={20} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={accept}
                  multiple={multiple}
                  onChange={handleFileChange}
                  className="hidden"
                />

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-nexo-500 dark:hover:border-nexo-500 transition-colors group"
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-full bg-nexo-500/10 group-hover:bg-nexo-500/20 transition-colors">
                      {getFileTypeIcon()}
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                        Нажмите для выбора
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {getAcceptText()} {multiple && '(можно выбрать несколько)'}
                      </p>
                    </div>
                    <Upload size={24} className="text-nexo-500" />
                  </div>
                </motion.button>
              </div>

              {/* Footer */}
              <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
