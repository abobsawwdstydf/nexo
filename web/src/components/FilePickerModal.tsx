import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, File, Music, Image as ImageIcon, Video, FileText } from 'lucide-react';

interface FilePickerModalProps {
  isOpen: boolean;
  title?: string;
  accept?: string;
  multiple?: boolean;
  onSelect: (files: File[]) => void;
  onClose: () => void;
  maxSize?: number; // bytes
  maxFiles?: number;
}

const getFileIcon = (file: File) => {
  const type = file.type;
  if (type.startsWith('image/')) return <ImageIcon size={24} className="text-blue-400" />;
  if (type.startsWith('audio/')) return <Music size={24} className="text-purple-400" />;
  if (type.startsWith('video/')) return <Video size={24} className="text-pink-400" />;
  if (type.includes('pdf') || type.includes('document')) return <FileText size={24} className="text-red-400" />;
  return <File size={24} className="text-zinc-400" />;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export default function FilePickerModal({
  isOpen,
  title = 'Select Files',
  accept = '*',
  multiple = false,
  onSelect,
  onClose,
  maxSize,
  maxFiles,
}: FilePickerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFiles = (files: File[]): boolean => {
    setError(null);

    // Check max files
    if (maxFiles && selectedFiles.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return false;
    }

    // Check file sizes
    if (maxSize) {
      for (const file of files) {
        if (file.size > maxSize) {
          setError(`File "${file.name}" exceeds maximum size of ${formatFileSize(maxSize)}`);
          return false;
        }
      }
    }

    return true;
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    if (!validateFiles(fileArray)) return;

    if (multiple) {
      setSelectedFiles([...selectedFiles, ...fileArray]);
    } else {
      setSelectedFiles([fileArray[0]]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSelect = () => {
    if (selectedFiles.length === 0) return;
    onSelect(selectedFiles);
    setSelectedFiles([]);
    onClose();
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
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
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md z-[9999]"
          >
            <div className="bg-surface-secondary rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Drop zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-2xl p-8 transition-all ${
                    dragActive
                      ? 'border-nexo-500 bg-nexo-500/10'
                      : 'border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={accept}
                    multiple={multiple}
                    onChange={(e) => handleFiles(e.target.files)}
                    className="hidden"
                  />

                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-nexo-500/20 flex items-center justify-center">
                      <Upload size={24} className="text-nexo-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-white mb-1">
                        Drag files here or{' '}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-nexo-400 hover:text-nexo-300 underline"
                        >
                          browse
                        </button>
                      </p>
                      <p className="text-xs text-zinc-500">
                        {maxSize && `Max size: ${formatFileSize(maxSize)}`}
                        {maxFiles && ` • Max files: ${maxFiles}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Selected files */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Selected Files ({selectedFiles.length})
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <motion.div
                          key={`${file.name}-${index}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 group"
                        >
                          <div className="flex-shrink-0">
                            {getFileIcon(file)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{file.name}</p>
                            <p className="text-xs text-zinc-500">{formatFileSize(file.size)}</p>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="flex-shrink-0 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 transition-all"
                          >
                            <X size={16} />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-4 border-t border-white/5 bg-white/[0.02]">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSelect}
                  disabled={selectedFiles.length === 0}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-gradient-to-r from-nexo-500 to-purple-600 hover:from-nexo-600 hover:to-purple-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select {selectedFiles.length > 0 && `(${selectedFiles.length})`}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
