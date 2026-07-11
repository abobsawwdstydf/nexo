import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Copy, Check } from 'lucide-react';

interface LaTeXEditorProps {
  onClose: () => void;
  onSend: (formula: string) => void;
}

const GREEK_LETTERS = [
  { name: 'alpha', symbol: 'α' },
  { name: 'beta', symbol: 'β' },
  { name: 'gamma', symbol: 'γ' },
  { name: 'delta', symbol: 'δ' },
  { name: 'epsilon', symbol: 'ε' },
  { name: 'zeta', symbol: 'ζ' },
  { name: 'eta', symbol: 'η' },
  { name: 'theta', symbol: 'θ' },
  { name: 'iota', symbol: 'ι' },
  { name: 'kappa', symbol: 'κ' },
  { name: 'lambda', symbol: 'λ' },
  { name: 'mu', symbol: 'μ' },
  { name: 'nu', symbol: 'ν' },
  { name: 'xi', symbol: 'ξ' },
  { name: 'omicron', symbol: 'ο' },
  { name: 'pi', symbol: 'π' },
];

export default function LaTeXEditor({ onClose, onSend }: LaTeXEditorProps) {
  const [formula, setFormula] = useState('');
  const [copied, setCopied] = useState(false);

  const insertGreekLetter = (name: string) => {
    setFormula(prev => prev + `\\${name}`);
  };

  const insertFraction = () => {
    setFormula(prev => prev + '\\frac{}{}');
  };

  const insertIntegral = () => {
    setFormula(prev => prev + '\\int_{}^{}');
  };

  const insertSqrt = () => {
    setFormula(prev => prev + '\\sqrt{}');
  };

  const insertSuperscript = () => {
    setFormula(prev => prev + '^{}');
  };

  const insertSubscript = () => {
    setFormula(prev => prev + '_{}');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formula);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    if (formula.trim()) {
      onSend(`$$${formula}$$`);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 sm:inset-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[600px] sm:max-h-[90vh] bg-surface-secondary/95 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white">Математические формулы</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition"
        >
          <X size={20} className="text-white/60" />
        </button>
      </div>

      {/* Formula input */}
      <textarea
        value={formula}
        onChange={(e) => setFormula(e.target.value)}
        placeholder="Введите LaTeX формулу..."
        className="flex-1 bg-[#1a1a1a] text-white font-mono text-sm p-4 border-b border-white/10 resize-none focus:outline-none max-h-32"
      />

      {/* Buttons grid */}
      <div className="grid grid-cols-4 gap-2 p-4 border-b border-white/10 overflow-y-auto max-h-40">
        {/* Greek letters */}
        {GREEK_LETTERS.slice(0, 8).map(letter => (
          <button
            key={letter.name}
            onClick={() => insertGreekLetter(letter.name)}
            className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition"
            title={letter.name}
          >
            {letter.symbol}
          </button>
        ))}

        {/* Math operations */}
        <button
          onClick={insertFraction}
          className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition"
          title="Дробь"
        >
          a/b
        </button>

        <button
          onClick={insertSqrt}
          className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition"
          title="Корень"
        >
          √
        </button>

        <button
          onClick={insertIntegral}
          className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition"
          title="Интеграл"
        >
          ∫
        </button>

        <button
          onClick={insertSuperscript}
          className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition"
          title="Верхний индекс"
        >
          x²
        </button>

        <button
          onClick={insertSubscript}
          className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition"
          title="Нижний индекс"
        >
          x₂
        </button>
      </div>

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
          disabled={!formula.trim()}
          className="ml-auto px-4 py-2 bg-nexo-500 hover:bg-nexo-600 text-white rounded-lg transition text-sm disabled:opacity-50"
        >
          Отправить
        </button>
      </div>
    </motion.div>
  );
}
