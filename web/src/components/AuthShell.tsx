import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

export function AuthBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.06, 0.12, 0.06] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-[#6366f1] blur-[120px]"
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.04, 0.08, 0.04] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute bottom-1/4 right-1/3 w-[350px] h-[350px] rounded-full bg-[#8b5cf6] blur-[100px]"
      />
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.03, 0.06, 0.03] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-[#a855f7] blur-[80px]"
      />
    </div>
  );
}

export function AuthGrid() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.015]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(99,102,241,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.4) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
      }}
    />
  );
}

interface AuthShellProps {
  children: ReactNode;
  onBack?: () => void;
  showGrid?: boolean;
}

export function AuthShell({ children, onBack, showGrid = false }: AuthShellProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex items-center justify-center bg-[#09090b] overflow-y-auto overflow-x-hidden relative"
    >
      <AuthBackground />
      {showGrid && <AuthGrid />}
      {onBack && (
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="fixed sm:absolute top-3 left-3 sm:top-4 sm:left-4 p-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all duration-200 text-white/50 hover:text-white/80 z-20"
          style={{ marginTop: 'max(0px, env(safe-area-inset-top))' }}
        >
          <ArrowLeft size={18} />
        </motion.button>
      )}
      <div className="relative z-10 w-full flex items-center justify-center py-8 px-4 sm:px-6 sm:py-0 min-h-full">
        {children}
      </div>
    </motion.div>
  );
}

interface AuthCardProps {
  children: ReactNode;
  className?: string;
  scrollable?: boolean;
}

export function AuthCard({ children, className = '', scrollable = false }: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`bg-[#141418]/85 backdrop-blur-2xl rounded-[2rem] p-5 sm:p-7 border border-white/[0.07] shadow-2xl shadow-black/60 relative overflow-hidden max-w-full ${className}`}
    >
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#6366f1]/40 to-transparent" />
      <div className={scrollable ? 'max-h-[calc(100dvh-6rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-hide -mr-2 pr-2' : ''}>
        {children}
      </div>
    </motion.div>
  );
}

export function AuthLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass =
    size === 'sm' ? 'w-14 h-14 rounded-[1.2rem]' : size === 'lg' ? 'w-24 h-24 rounded-[1.8rem]' : 'w-16 h-16 rounded-[1.3rem]';
  const glowClass = size === 'sm' ? '-m-2' : size === 'lg' ? '-m-4 rounded-[2.2rem]' : '-m-2';
  return (
    <motion.div
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      className="relative"
    >
      <div className={`absolute inset-0 ${glowClass} bg-[#6366f1]/30 blur-xl`} />
      <motion.img
        src="/logo.png"
        alt="Нексо"
        className={`relative ${sizeClass} shadow-lg shadow-[#6366f1]/25 object-cover`}
        style={
          size === 'lg'
            ? { boxShadow: '0 0 60px rgba(99,102,241,0.3), 0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)' }
            : undefined
        }
        initial={{ rotate: -180, scale: 0 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}
      />
    </motion.div>
  );
}

export function AuthTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center">
      <h1
        className="text-xl font-bold mt-3 tracking-tight text-center"
        style={{
          background: 'linear-gradient(135deg, #fff, #a5b4fc)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {title}
      </h1>
      {subtitle && <p className="text-[12px] text-white/30 mt-1 text-center">{subtitle}</p>}
    </div>
  );
}

export const authTitleStyle = {
  background: 'linear-gradient(135deg, #fff, #a5b4fc)',
  WebkitBackgroundClip: 'text' as const,
  WebkitTextFillColor: 'transparent' as const,
  backgroundClip: 'text' as const,
};

export const authPrimaryButtonStyle = {
  boxShadow: '0 0 20px rgba(99,102,241,0.3), 0 6px 20px rgba(0,0,0,0.2)',
};
