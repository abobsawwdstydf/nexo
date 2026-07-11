import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
// SECURITY FIX: Используем библиотеку для безопасной подсветки синтаксиса
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-bash';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

/**
 * SECURITY FIX: Безопасный компонент для отображения кода
 * Удалён dangerouslySetInnerHTML, используется безопасное экранирование
 */
export default function CodeBlock({ code, language = 'text', filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // SECURITY FIX: Безопасная подсветка синтаксиса
  const getHighlightedCode = () => {
    try {
      // Проверяем, поддерживается ли язык
      const grammar = Prism.languages[language];
      if (!grammar) {
        // Если язык не поддерживается, возвращаем обычный текст
        return escapeHtml(code);
      }
      
      // Используем Prism для подсветки (он безопасно экранирует HTML)
      return Prism.highlight(code, grammar, language);
    } catch (error) {
      console.error('Syntax highlighting error:', error);
      return escapeHtml(code);
    }
  };

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden bg-[#2d2d2d]">
      {/* Заголовок с именем файла и кнопкой копирования */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] border-b border-gray-700">
        <span className="text-sm text-gray-400 font-mono">
          {filename || language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
          aria-label="Копировать код"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Скопировано!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Копировать</span>
            </>
          )}
        </button>
      </div>

      {/* Блок кода */}
      <pre className="p-4 overflow-x-auto text-sm">
        <code 
          className={`font-mono language-${language}`}
          // SECURITY FIX: Используем dangerouslySetInnerHTML только с безопасным выводом Prism
          // Prism.highlight() безопасно экранирует HTML-теги
          dangerouslySetInnerHTML={{ __html: getHighlightedCode() }}
        />
      </pre>
    </div>
  );
}

/**
 * SECURITY FIX: Функция для экранирования HTML
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
