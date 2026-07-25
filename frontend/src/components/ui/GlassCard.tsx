import { useRef, useState, useEffect, ReactNode, HTMLAttributes } from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'subtle' | 'strong' | 'gradient' | 'neon';
  hover?: 'lift' | 'tilt' | 'glow' | 'scale' | 'none';
  animation?: 'fade' | 'slide' | 'scale' | 'flip' | 'none';
  delay?: number;
  border?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantStyles: Record<string, string> = {
  default: `
    bg-white/[0.04] backdrop-blur-xl
    border border-white/[0.08]
    shadow-lg shadow-black/20
  `,
  subtle: `
    bg-white/[0.02] backdrop-blur-lg
    border border-white/[0.05]
    shadow-md shadow-black/10
  `,
  strong: `
    bg-white/[0.07] backdrop-blur-2xl
    border border-white/[0.12]
    shadow-xl shadow-black/30
  `,
  gradient: `
    bg-gradient-to-br from-white/[0.06] to-white/[0.02]
    backdrop-blur-xl
    border border-white/[0.08]
    shadow-lg shadow-black/20
  `,
  neon: `
    bg-white/[0.04] backdrop-blur-xl
    border border-[#7B61FF]/40
    shadow-lg shadow-[#7B61FF]/20
  `,
};

const paddingStyles: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
};

export function GlassCard({
  children,
  variant = 'default',
  hover = 'lift',
  animation = 'fade',
  delay = 0,
  border = true,
  padding = 'md',
  className = '',
  onClick,
  ...props
}: GlassCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({});
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setIsVisible(true);
        });
      },
      { threshold: 0.1 }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => {
      if (cardRef.current) observer.unobserve(cardRef.current);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hover !== 'tilt' || !cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;
    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
    });
  };

  const handleMouseLeave = () => {
    if (hover === 'tilt') {
      setTiltStyle({
        transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      });
    }
  };

  const hoverClasses: Record<string, string> = {
    lift: 'transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/30',
    tilt: 'transition-transform duration-150',
    glow: 'transition-all duration-300 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]',
    scale: 'transition-transform duration-200 hover:scale-[1.02]',
    none: '',
  };

  const animationClasses: Record<string, string> = {
    fade: isVisible ? 'opacity-100' : 'opacity-0',
    slide: isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
    scale: isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
    flip: isVisible ? 'rotate-0 opacity-100' : 'rotate-6 opacity-0',
    none: '',
  };

  const baseVariant = variant === 'neon' ? 'default' : variant;
  const borderClass = border ? variantStyles[variant] || variantStyles.default : variantStyles[variant].replace(/border[^ ]*/g, '');

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`
        rounded-2xl relative overflow-hidden
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${hoverClasses[hover]}
        ${animationClasses[animation]}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      style={hover === 'tilt' ? tiltStyle : undefined}
      {...(props as any)}
    >
      {/* Top shine line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

      {children}
    </motion.div>
  );
}

// ─── Compound Components ────────────────────────────────────────────────────

export function GlassCardHeader({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function GlassCardTitle({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={`text-lg font-semibold tracking-tight ${className}`}
      style={{
        background: 'linear-gradient(135deg, #fff, #a5b4fc)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      {children}
    </h3>
  );
}

export function GlassCardBody({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export function GlassCardFooter({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-4 pt-4 border-t border-white/[0.06] ${className}`}>
      {children}
    </div>
  );
}
