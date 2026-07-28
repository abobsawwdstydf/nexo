import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  color: string;
  rotation: number;
  scale: number;
}

const PARTICLE_COLORS = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bdb',
  '#ff9f43', '#00d2d3', '#a29bfe', '#fd79a8', '#e17055',
];

const PARTICLE_COUNT = 40;

interface ConfettiProps {
  /** Trigger id — change this value to re-trigger */
  trigger: number;
  /** Optional: callback when animation finishes */
  onFinish?: () => void;
}

export function Confetti({ trigger, onFinish }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!trigger) return;

    const newParticles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      rotation: Math.random() * 720 - 360,
      scale: 0.3 + Math.random() * 0.7,
    }));

    setParticles(newParticles);

    const timer = setTimeout(() => {
      setParticles([]);
      onFinish?.();
    }, 3000);

    return () => clearTimeout(timer);
  }, [trigger, onFinish]);

  return (
    <AnimatePresence>
      {particles.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden">
          {particles.map(p => (
            <motion.div
              key={`${trigger}-${p.id}`}
              initial={{
                opacity: 1,
                x: '50vw',
                y: '30vh',
                scale: 0,
                rotate: 0,
              }}
              animate={{
                opacity: [1, 1, 0.8, 0],
                x: `${p.x}vw`,
                y: '100vh',
                scale: p.scale,
                rotate: p.rotation,
              }}
              transition={{
                duration: 2 + Math.random() * 0.5,
                ease: [0.25, 0.46, 0.45, 0.94],
                delay: Math.random() * 0.3,
              }}
              className="absolute w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: p.color }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
