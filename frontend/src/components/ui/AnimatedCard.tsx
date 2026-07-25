import React, { useRef, useState, useEffect } from 'react';

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'gradient' | 'neon';
  hover?: 'lift' | 'tilt' | 'glow' | 'scale' | 'none';
  animation?: 'fade' | 'slide' | 'scale' | 'flip' | 'none';
  delay?: number;
  onClick?: () => void;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = '',
  variant = 'glass',
  hover = 'lift',
  animation = 'fade',
  delay = 0,
  onClick,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tiltStyle, setTiltStyle] = useState({});
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  // Intersection Observer для анимации при скролле
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, []);

  // Tilt effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hover !== 'tilt' || !cardRef.current) return;

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;

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

  const variantClasses = {
    default: 'bg-surface-secondary border border-white/10',
    glass: 'glass-card',
    gradient: 'bg-gradient-to-br from-nexo-500/20 to-purple-500/20 border border-white/10',
    neon: 'bg-surface-secondary border-2 border-nexo-500 shadow-lg shadow-nexo-500/50',
  };

  const hoverClasses = {
    lift: 'hover-lift',
    tilt: 'card-tilt',
    glow: 'hover-glow',
    scale: 'hover-scale',
    none: '',
  };

  const animationClasses = {
    fade: isVisible ? 'opacity-100' : 'opacity-0',
    slide: isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
    scale: isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
    flip: isVisible ? 'rotate-0 opacity-100' : 'rotate-12 opacity-0',
    none: '',
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`
        rounded-2xl p-6
        transition-all duration-300 ease-out
        ${variantClasses[variant]}
        ${hoverClasses[hover]}
        ${animationClasses[animation]}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      style={hover === 'tilt' ? tiltStyle : undefined}
    >
      {children}
    </div>
  );
};

// Компонент для grid карточек с staggered анимацией
interface CardGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CardGrid: React.FC<CardGridProps> = ({
  children,
  columns = 3,
  gap = 'md',
  className = '',
}) => {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  const gapClasses = {
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6',
  };

  return (
    <div
      className={`
        grid ${columnClasses[columns]} ${gapClasses[gap]}
        list-stagger
        ${className}
      `}
    >
      {children}
    </div>
  );
};

// Компонент для feature card
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
  onClick?: () => void;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  className = '',
  onClick,
}) => {
  return (
    <AnimatedCard
      variant="glass"
      hover="lift"
      animation="slide"
      onClick={onClick}
      className={className}
    >
      <div className="flex flex-col items-center text-center space-y-4">
        {/* Icon */}
        <div
          className="
            w-16 h-16 rounded-2xl
            bg-gradient-to-br from-nexo-500 to-purple-500
            flex items-center justify-center
            shadow-lg shadow-nexo-500/30
            group-hover:scale-110 transition-transform duration-300
          "
        >
          <div className="text-white">{icon}</div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-white gradient-text">
          {title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-400 leading-relaxed">
          {description}
        </p>
      </div>
    </AnimatedCard>
  );
};

// Компонент для stat card
interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  trendValue,
  className = '',
}) => {
  const trendColors = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-gray-400',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '→',
  };

  return (
    <AnimatedCard
      variant="glass"
      hover="lift"
      animation="scale"
      className={className}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-400 mb-2">{label}</p>
          <p className="text-3xl font-bold text-white gradient-text">
            {value}
          </p>
          {trend && trendValue && (
            <p className={`text-sm mt-2 ${trendColors[trend]}`}>
              {trendIcons[trend]} {trendValue}
            </p>
          )}
        </div>

        {icon && (
          <div
            className="
              w-12 h-12 rounded-xl
              bg-white/5 flex items-center justify-center
              text-nexo-400
            "
          >
            {icon}
          </div>
        )}
      </div>
    </AnimatedCard>
  );
};

// Компонент для profile card
interface ProfileCardProps {
  avatar: string;
  name: string;
  role?: string;
  bio?: string;
  stats?: Array<{ label: string; value: string | number }>;
  actions?: React.ReactNode;
  className?: string;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  avatar,
  name,
  role,
  bio,
  stats,
  actions,
  className = '',
}) => {
  return (
    <AnimatedCard
      variant="glass"
      hover="lift"
      animation="scale"
      className={className}
    >
      <div className="flex flex-col items-center text-center space-y-4">
        {/* Avatar */}
        <div className="relative">
          <img
            src={avatar}
            alt={name}
            className="w-24 h-24 rounded-full object-cover ring-4 ring-nexo-500/30"
          />
          <div
            className="
              absolute -bottom-2 -right-2
              w-6 h-6 rounded-full
              bg-green-400 border-4 border-surface
              connection-pulse
            "
          />
        </div>

        {/* Name & Role */}
        <div>
          <h3 className="text-xl font-semibold text-white">{name}</h3>
          {role && <p className="text-sm text-gray-400 mt-1">{role}</p>}
        </div>

        {/* Bio */}
        {bio && (
          <p className="text-sm text-gray-400 leading-relaxed">{bio}</p>
        )}

        {/* Stats */}
        {stats && stats.length > 0 && (
          <div className="flex items-center gap-6 pt-4 border-t border-white/10 w-full">
            {stats.map((stat, index) => (
              <div key={index} className="flex-1">
                <p className="text-2xl font-bold text-white gradient-text">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {actions && (
          <div className="pt-4 w-full">{actions}</div>
        )}
      </div>
    </AnimatedCard>
  );
};
