import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Copy, Check } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';

interface CodeBlockEditorProps {
  onClose: () => void;
  onSend: (code: string, language: string) => void;
}

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp', 'php',
  'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala', 'r', 'matlab',
  'sql', 'html', 'css', 'xml', 'json', 'yaml', 'bash', 'shell',
  'dockerfile', 'makefile', 'cmake', 'gradle', 'maven'
];

export default function CodeBlockEditor({ onClose, onSend }: CodeBlockEditorProps) {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    if (code.trim()) {
      onSend(code, language);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 sm:inset-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[600px] sm:h-[500px] bg-surface-secondary/95 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white">Код с подсветкой</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition"
        >
          <X size={20} className="text-white/60" />
        </button>
      </div>

      {/* Language selector */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10">
        <label className="text-sm text-white/60">Язык:</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm"
        >
          {LANGUAGES.map(lang => (
            <option key={lang} value={lang} className="bg-surface-primary">
              {lang}
            </option>
          ))}
        </select>
      </div>

      {/* Editor */}
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Вставьте ваш код здесь..."
        className="flex-1 bg-[#1a1a1a] text-white font-mono text-sm p-4 border-b border-white/10 resize-none focus:outline-none"
      />

      {/* Preview */}
      {code && (
        <div className="max-h-32 overflow-y-auto bg-[#1a1a1a] border-b border-white/10 p-4">
          <Highlight theme={themes.dracula} code={code} language={language}>
            {({ className, style, tokens, getLineProps, getTokenProps }: any) => (
              <pre className={className} style={style}>
                {tokens.map((line: any, i: number) => (
                  <div key={i} {...getLineProps({ line, key: i })}>
                    {line.map((token: any, key: number) => (
                      <span key={key} {...getTokenProps({ token, key })} />
                    ))}
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-sm"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>

        <button
          onClick={handleSend}
          disabled={!code.trim()}
          className="ml-auto px-4 py-2 bg-nexo-500 hover:bg-nexo-600 text-white rounded-lg transition text-sm disabled:opacity-50"
        >
          Отправить
        </button>
      </div>
    </motion.div>
  );
}
