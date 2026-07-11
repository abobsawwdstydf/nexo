import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Loader2, X, ArrowLeft, Trash2, Smile } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api, getApiBase } from '../lib/api';
import CodeBlock from '../components/CodeBlock';
import EmojiPicker from '../components/EmojiPicker';

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export default function NexoAIPage({ onClose }: { onClose?: () => void }) {
  const { } = useAuthStore();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /** Загрузка истории из localStorage при монтировании */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nexo_ai_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        setMessages(parsed);
      }
    } catch (e) {
      console.error('Failed to load AI history:', e);
    }

    // Проверяем URL параметры для контекста из сообщения
    const params = new URLSearchParams(window.location.search);
    const messageId = params.get('messageId');
    const chatId = params.get('chatId');
    const context = params.get('context');

    if (messageId && chatId && context) {
      // Автоматически задаём вопрос AI о сообщении
      setInput(`Проанализируй это сообщение: "${decodeURIComponent(context)}"`);
      // Очищаем URL параметры
      window.history.replaceState({}, '', '/nexo-ai');
    }
  }, []);

  /** Сохранение истории в localStorage при изменении */
  useEffect(() => {
    if (messages.length > 0) {
      try {
        // Сохраняем только последние 50 сообщений чтобы не переполнить localStorage
        const toSave = messages.slice(-50).map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }));
        localStorage.setItem('nexo_ai_history', JSON.stringify(toSave));
      } catch (e) {
        console.error('Failed to save AI history:', e);
      }
    }
  }, [messages]);

  /** Определяем мобильное устройство */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /** Автоскролл вниз */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /** Инициализация распознавания речи */
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'ru-RU';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };

      recognitionRef.current.onerror = () => {
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  /** Переключение записи голоса */
  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) {
      console.warn('Speech Recognition not supported');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch {
        // Уже записывает
      }
    }
  }, [isRecording]);

  /** Очистка истории */
  const clearHistory = useCallback(() => {
    if (confirm('Очистить всю историю чата с AI?')) {
      setMessages([]);
      localStorage.removeItem('nexo_ai_history');
    }
  }, []);

  /** Отправка сообщения со стримингом */
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isSending) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = input.trim();
    setInput('');
    setIsSending(true);

    // Создаём placeholder для ответа AI
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }]);

    // Отменяем предыдущий запрос если есть
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      // Формируем историю сообщений
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: userInput });

      const response = await fetch(`${getApiBase()}/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ messages: history }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Network error');
      }

      // Читаем SSE стрим
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let fullText = '';
      let lastChunkTime = Date.now();
      const CHUNK_TIMEOUT = 30000;

      while (true) {
        const result = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Stream timeout')), CHUNK_TIMEOUT)
          ),
        ]);

        const { done, value } = result as { done: boolean; value: Uint8Array | undefined };
        if (done) break;

        lastChunkTime = Date.now();
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.token) {
                fullText += json.token;
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: fullText } : m
                ));
              }
              if (json.done) {
                fullText = json.text || fullText;
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: fullText, isStreaming: false } : m
                ));
              }
              if (json.error) {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: '⚠️ ' + json.error, isStreaming: false } : m
                ));
              }
            } catch {
              // Игнорируем ошибки парсинга
            }
          }
        }
      }

      // Ensure streaming state is cleared
      setMessages(prev => prev.map(m =>
        m.id === assistantId && m.isStreaming ? { ...m, content: fullText || '⚠️ Пустой ответ от AI', isStreaming: false } : m
      ));
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        // Fallback: try non-streaming endpoint
        try {
          const fallbackResp = await fetch(`${getApiBase()}/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: userInput }] }),
          });
          if (fallbackResp.ok) {
            const data = await fallbackResp.json();
            if (data.text) {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: data.text, isStreaming: false } : m
              ));
              return;
            }
          }
        } catch {}
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: '❌ Не удалось получить ответ. Попробуй позже.', isStreaming: false }
            : m
        ));
      }
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  }, [input, isSending, messages]);

  /** Отправка по Enter */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /** Приветственное сообщение */
  const welcomeMessage = "Привет! Я Нексо AI!";

  /** Рендер сообщения ИИ с code blocks + inline markdown */
  const renderAIMessage = (content: string): React.ReactNode => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const segments: React.ReactNode[] = [];
    let lastIdx = 0;
    let match;
    let hasCode = false;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      hasCode = true;
      if (match.index > lastIdx) {
        segments.push(renderInlineAI(content.slice(lastIdx, match.index)));
      }
      segments.push(<CodeBlock key={`cb-${match.index}`} language={match[1] || ''} code={match[2].trimEnd()} />);
      lastIdx = match.index + match[0].length;
    }

    if (hasCode) {
      if (lastIdx < content.length) {
        segments.push(renderInlineAI(content.slice(lastIdx)));
      }
      return segments;
    }

    return renderInlineAI(content);
  };

  /** Inline markdown для ИИ (bold, italic, code, strike) */
  const renderInlineAI = (text: string): React.ReactNode => {
    const tokens = text.split(/(\*\*[\s\S]*?\*\*|~~[\s\S]*?~~|\*[\s\S]*?\*|`[\s\S]*?`)/g);
    return tokens.map((t, i) => {
      if (t.startsWith('**') && t.endsWith('**')) return <strong key={i}>{t.slice(2, -2)}</strong>;
      if (t.startsWith('~~') && t.endsWith('~~')) return <del key={i}>{t.slice(2, -2)}</del>;
      if ((t.startsWith('*') && t.endsWith('*'))) return <em key={i}>{t.slice(1, -1)}</em>;
      if (t.startsWith('`') && t.endsWith('`')) return <code key={i} className="font-mono text-[13px] bg-black/30 px-1.5 py-0.5 rounded">{t.slice(1, -1)}</code>;
      return <span key={i} className="whitespace-pre-wrap">{t}</span>;
    });
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Фон как в чатах */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* ====== HEADER ====== */}
      <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0 relative z-10" style={{ background: '#1a1a1a', borderBottom: '1px solid #222' }}>
        {/* Закрыть (мобилки) */}
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-zinc-400 flex items-center justify-center"
            style={{ background: '#252525' }}
          >
            <ArrowLeft size={18} />
          </button>
        )}

        {/* Логотип и название */}
        <div className="flex items-center gap-2.5 flex-1">
          <img src="/no_bg.png" alt="Нексо AI" className="w-9 h-9 rounded-xl object-cover" />
          <div>
            <h1 className="text-base font-bold text-white">Нексо AI</h1>
            <p className="text-[10px] text-zinc-500">Умный ассистент</p>
          </div>
        </div>

        {/* Очистить историю */}
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="w-9 h-9 rounded-xl text-zinc-400 hover:text-red-400 transition-colors flex items-center justify-center"
            style={{ background: '#252525' }}
            title="Очистить историю"
          >
            <Trash2 size={16} />
          </button>
        )}

        {/* Закрыть (ПК) */}
        {!isMobile && onClose && (
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-zinc-400 flex items-center justify-center"
            style={{ background: '#252525' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ====== СООБЩЕНИЯ ====== */}
      <div className="flex-1 overflow-y-auto px-4 py-4 relative z-10">
        <AnimatePresence>
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center gap-4"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-nexo-500/30 to-purple-600/30 blur-2xl rounded-full" />
                <img src="/no_bg.png" alt="Нексо AI" className="relative w-20 h-20 rounded-xl object-cover animate-float" />
              </div>
              <div className="max-w-xs">
                <h2 className="text-lg font-bold text-white mb-2">Нексо AI</h2>
                <p className="text-sm text-zinc-400 whitespace-pre-line">{welcomeMessage}</p>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm rounded-br-md ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-nexo-500 to-purple-600 text-white'
                        : 'text-zinc-200 rounded-bl-md'
                    }`}
                    style={msg.role !== 'user' ? { background: '#252525', border: '1px solid #2a2a2a' } : undefined}
                  >
                    {msg.role === 'assistant' ? renderAIMessage(msg.content) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-4 bg-nexo-400 ml-0.5 animate-pulse-soft rounded-full" />
                    )}
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ====== ПОЛЕ ВВОДА ====== */}
      <div className="px-3 py-3 flex-shrink-0 relative z-10">
        <div className="rounded-2xl px-3 py-2 flex items-end gap-2 transition-colors" style={{ background: '#1a1a1a', border: '1px solid #222' }}>
          {/* Голос */}
          <button
            onClick={toggleRecording}
            className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
              isRecording ? 'bg-red-500/20 text-red-400' : 'text-zinc-500 hover:text-white'
            }`}
          >
            {isRecording ? <Mic size={16} /> : <MicOff size={16} />}
          </button>

          {/* Emoji */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
              showEmojiPicker ? 'text-nexo-400 bg-nexo-500/20' : 'text-zinc-500 hover:text-white'
            }`}
          >
            <Smile size={16} />
          </button>

          {/* Textarea */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Сообщение..."
            rows={1}
            className="flex-1 bg-transparent text-white text-sm placeholder-zinc-500 resize-none outline-none py-1.5 max-h-24"
            style={{ minHeight: '36px' }}
          />

          {/* Send */}
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isSending}
            className="w-9 h-9 rounded-full bg-nexo-500 flex items-center justify-center flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-nexo-600 transition-colors"
          >
            {isSending ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="text-white" />}
          </button>
        </div>

        {isRecording && (
          <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="text-xs text-red-400 mt-2 text-center">
            🔴 Запись голоса...
          </motion.p>
        )}
      </div>

      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <EmojiPicker
            onSelect={(emoji) => {
              setInput(prev => prev + emoji);
              setShowEmojiPicker(false);
              inputRef.current?.focus();
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
