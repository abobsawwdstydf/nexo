import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Bot } from 'lucide-react';
import { api } from '../lib/api';
import { useToastStore } from '../stores/toastStore';
import BottomSheet from './BottomSheet';

interface AIAssistantModalProps {
  onClose: () => void;
  messageContext?: string;
  messageId?: string;
  chatId?: string;
}

export default function AIAssistantModal({ 
  onClose, 
  messageContext, 
  messageId, 
  chatId 
}: AIAssistantModalProps) {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { error: showError } = useToastStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!question.trim() || loading) return;

    setLoading(true);
    try {
      const result = await api.post('/ai/chat', {
        message: question,
        context: messageContext,
        messageId,
        chatId
      });
      
      setResponse(result.response || 'Нет ответа от AI');
    } catch (error: any) {
      console.error('AI request failed:', error);
      showError(error.message || 'Ошибка при обращении к AI');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const header = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center">
          <Bot size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">AI Ассистент</h3>
          {messageContext && (
            <p className="text-xs text-zinc-500">Контекст: "{messageContext.slice(0, 50)}..."</p>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );

  const content = (
    <div className="flex flex-col h-full max-h-[60vh] min-h-[300px]">
      {/* Response area */}
      <div className="flex-1 overflow-y-auto p-4">
        {response ? (
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Bot size={16} className="text-nexo-400" />
              <span className="text-sm font-medium text-nexo-400">AI Ответ:</span>
            </div>
            <div className="text-sm text-white whitespace-pre-wrap">
              {response}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-nexo-500/20 to-purple-600/20 flex items-center justify-center mb-4">
              <Bot size={24} className="text-nexo-400" />
            </div>
            <h4 className="text-lg font-semibold text-white mb-2">Задайте вопрос AI</h4>
            <p className="text-sm text-zinc-500 max-w-sm">
              {messageContext 
                ? 'AI поможет разобрать это сообщение или ответить на ваши вопросы о нём'
                : 'AI готов помочь с любыми вопросами'
              }
            </p>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-white/5 p-4">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={messageContext ? "Что вы хотите узнать об этом сообщении?" : "Задайте вопрос AI..."}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-nexo-500/50 transition-colors"
            rows={2}
            disabled={loading}
          />
          <button
            onClick={handleSubmit}
            disabled={!question.trim() || loading}
            className="px-4 py-2 rounded-xl bg-nexo-500 hover:bg-nexo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin text-white" />
            ) : (
              <Send size={16} className="text-white" />
            )}
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          Нажмите Enter для отправки, Shift+Enter для новой строки
        </p>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen onClose={onClose} showCloseButton={false} maxHeight="85vh">
        {header}
        {content}
      </BottomSheet>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-[#1a1a1a] border border-white/10 shadow-2xl overflow-hidden rounded-2xl w-full max-w-2xl max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {header}
        {content}
      </motion.div>
    </motion.div>
  );
}