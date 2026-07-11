import { useEffect, useRef } from 'react';

interface LaTeXRendererProps {
  formula: string;
  display?: boolean; // block vs inline
}

// Simple LaTeX-to-SVG renderer using basic math symbols
// For production, integrate KaTeX or MathJax
function renderLatex(formula: string): string {
  let f = formula.trim();

  // Greek letters
  const greek: Record<string, string> = {
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
    '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
    '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
    '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ',
    '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
    '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
    '\\Alpha': 'Α', '\\Beta': 'Β', '\\Gamma': 'Γ', '\\Delta': 'Δ',
    '\\Theta': 'Θ', '\\Lambda': 'Λ', '\\Pi': 'Π', '\\Sigma': 'Σ',
    '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
    '\\infty': '∞', '\\partial': '∂', '\\nabla': '∇',
    '\\pm': '±', '\\times': '×', '\\div': '÷', '\\cdot': '·',
    '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\approx': '≈',
    '\\equiv': '≡', '\\in': '∈', '\\notin': '∉', '\\subset': '⊂',
    '\\supset': '⊃', '\\cup': '∪', '\\cap': '∩', '\\emptyset': '∅',
    '\\forall': '∀', '\\exists': '∃', '\\neg': '¬', '\\wedge': '∧',
    '\\vee': '∨', '\\rightarrow': '→', '\\leftarrow': '←',
    '\\Rightarrow': '⇒', '\\Leftarrow': '⇐', '\\leftrightarrow': '↔',
    '\\sqrt': '√', '\\sum': '∑', '\\prod': '∏', '\\int': '∫',
    '\\oint': '∮', '\\lim': 'lim', '\\log': 'log', '\\ln': 'ln',
    '\\sin': 'sin', '\\cos': 'cos', '\\tan': 'tan',
    '\\arcsin': 'arcsin', '\\arccos': 'arccos', '\\arctan': 'arctan',
    '\\ldots': '…', '\\cdots': '⋯', '\\vdots': '⋮', '\\ddots': '⋱',
  };

  for (const [cmd, sym] of Object.entries(greek)) {
    f = f.replaceAll(cmd, sym);
  }

  // Fractions: \frac{a}{b} → a/b (simplified)
  f = f.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)');

  // Superscripts: x^{n} or x^n
  f = f.replace(/\^{([^}]*)}/g, (_, s) => {
    const sup: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', 'n': 'ⁿ', '+': '⁺', '-': '⁻' };
    return s.split('').map((c: string) => sup[c] || `^${c}`).join('');
  });
  f = f.replace(/\^([0-9n])/g, (_, c) => {
    const sup: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', 'n': 'ⁿ' };
    return sup[c] || `^${c}`;
  });

  // Subscripts: x_{n} or x_n
  f = f.replace(/_{([^}]*)}/g, (_, s) => {
    const sub: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', 'n': 'ₙ', 'i': 'ᵢ' };
    return s.split('').map((c: string) => sub[c] || `_${c}`).join('');
  });
  f = f.replace(/_([0-9ni])/g, (_, c) => {
    const sub: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', 'n': 'ₙ', 'i': 'ᵢ' };
    return sub[c] || `_${c}`;
  });

  // sqrt{x}
  f = f.replace(/√\{([^}]*)\}/g, '√($1)');

  // Remove remaining braces
  f = f.replace(/[{}]/g, '');

  return f;
}

export default function LaTeXRenderer({ formula, display }: LaTeXRendererProps) {
  const rendered = renderLatex(formula);

  if (display) {
    return (
      <div className="my-3 px-4 py-3 bg-white/5 rounded-xl border border-white/10 text-center overflow-x-auto">
        <span className="text-lg font-mono text-nexo-300 select-all">{rendered}</span>
      </div>
    );
  }

  return (
    <span className="inline-block px-1.5 py-0.5 bg-white/5 rounded text-sm font-mono text-nexo-300 mx-0.5 select-all">
      {rendered}
    </span>
  );
}

// Parse message text and replace LaTeX blocks
export function parseLatex(text: string): Array<{ type: 'text' | 'latex-inline' | 'latex-block'; content: string }> {
  const parts: Array<{ type: 'text' | 'latex-inline' | 'latex-block'; content: string }> = [];
  // Match \[...\] (block) and $...$ (inline)
  const regex = /\\\[(.+?)\\\]|\$([^$\n]+?)\$/gs;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: 'text', content: text.slice(last, match.index) });
    if (match[1] !== undefined) parts.push({ type: 'latex-block', content: match[1] });
    else parts.push({ type: 'latex-inline', content: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', content: text.slice(last) });
  return parts;
}
