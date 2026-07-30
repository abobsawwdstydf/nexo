/**
 * Smooth page transitions and micro-interactions
 * Using Framer Motion for fluid animations
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

// Page transition variants
export const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.98,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.6, 1],
    },
  },
};

// Slide transitions
export const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.3 },
    },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 1000 : -1000,
    opacity: 0,
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.3 },
    },
  }),
};

// Scale transitions for modals
export const modalVariants = {
  initial: {
    opacity: 0,
    scale: 0.9,
    y: 20,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1],
    },
  },
};

// Overlay transitions
export const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// List item stagger animations
export const listContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const listItemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// Hover animations
export const hoverScale = {
  scale: 1.02,
  transition: { duration: 0.2 },
};

export const tapScale = {
  scale: 0.98,
  transition: { duration: 0.1 },
};

// Pulse animation for notifications
export const pulseAnimation = {
  scale: [1, 1.05, 1],
  transition: {
    duration: 0.3,
    ease: 'easeInOut',
  },
};

// Shake animation for errors
export const shakeAnimation = {
  x: [0, -10, 10, -10, 10, 0],
  transition: {
    duration: 0.5,
    ease: 'easeInOut',
  },
};

// Bounce animation for success
export const bounceAnimation = {
  y: [0, -20, 0],
  transition: {
    duration: 0.5,
    ease: [0.68, -0.55, 0.265, 1.55],
  },
};

// Slide up from bottom (for mobile sheets)
export const slideUpVariants = {
  initial: { y: '100%' },
  animate: { 
    y: 0,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 300,
    },
  },
  exit: { 
    y: '100%',
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 1, 1],
    },
  },
};

// Fade in from different directions
export const fadeInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export const fadeInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
};

export const fadeInDown = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

// Scale up animation
export const scaleUp = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
};

// Rotate animation
export const rotateAnimation = {
  rotate: 360,
  transition: {
    duration: 1,
    ease: 'linear',
  },
};

// Shimmer effect for loading states
export const shimmerAnimation = {
  backgroundPosition: ['200% 0', '-200% 0'],
  transition: {
    duration: 2,
    ease: 'linear',
    repeat: Infinity,
  },
};

// Component wrappers with animations
export function AnimatedPage({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

export function AnimatedModal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      variants={overlayVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        variants={modalVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        onClick={e => e.stopPropagation()}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function AnimatedList({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={listContainerVariants}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

export function AnimatedListItem({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={listItemVariants}
    >
      {children}
    </motion.div>
  );
}

/* ─── Stagger Container with Fade + Slide Up ──────────────────────── */

export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

export const staggerItemFadeUp = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

/* ─── Modal Backdrop Blur Entrance ────────────────────────────────── */

export const modalBackdropVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

export const modalContentVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 20, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 350,
      damping: 28,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    filter: 'blur(4px)',
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1],
    },
  },
};

/* ─── Message Bubble Entrance ─────────────────────────────────────── */

export const messageBubbleVariants = {
  initial: { opacity: 0, y: 16, scale: 0.92 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    transition: { duration: 0.15 },
  },
};

/* ─── Toast / Notification Slide ──────────────────────────────────── */

export const toastVariants = {
  initial: { opacity: 0, x: 80, scale: 0.9, filter: 'blur(4px)' },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    x: 80,
    scale: 0.9,
    filter: 'blur(4px)',
    transition: {
      duration: 0.25,
      ease: [0.4, 0, 1, 1],
    },
  },
};

/* ─── Bounce / Pulse for Notifications ────────────────────────────── */

export const bounceVariants = {
  initial: { scale: 0 },
  animate: {
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 15,
    },
  },
};

export const pulseVariants = {
  initial: { scale: 1 },
  pulse: {
    scale: [1, 1.08, 1],
    transition: {
      duration: 0.6,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatType: 'loop' as const,
    },
  },
};

/* ─── Shake for Errors ────────────────────────────────────────────── */

export const shakeVariants = {
  shake: {
    x: [0, -8, 8, -6, 6, -3, 3, 0],
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

/* ─── Scale on Click (Micro-interaction) ──────────────────────────── */

export const tapScaleVariants = {
  hover: { scale: 1.03 },
  tap: { scale: 0.97 },
};

/* ─── Button Ripple / Pulse ───────────────────────────────────────── */

export const buttonPulseVariants = {
  idle: { boxShadow: '0 0 0 0 rgba(99, 102, 241, 0)' },
  pulse: {
    boxShadow: '0 0 0 8px rgba(99, 102, 241, 0)',
    transition: { duration: 0.8, repeat: Infinity },
  },
};

/* ─── Height Reveal (for expanding sections) ──────────────────────── */

export const expandVariants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
      opacity: { duration: 0.2, delay: 0.1 },
    },
  },
};

/* ─── Chat List Item ──────────────────────────────────────────────── */

export const chatListItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.03,
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  }),
};

/* ─── Floating Element ────────────────────────────────────────────── */

export const floatVariants = {
  animate: {
    y: [0, -10, 0],
    transition: {
      duration: 4,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatType: 'reverse' as const,
    },
  },
};

/* ─── Online Indicator ────────────────────────────────────────────── */

export const onlineIndicatorVariants = {
  animate: {
    scale: [1, 1.1, 1],
    opacity: [0.8, 1, 0.8],
    transition: {
      duration: 2,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },
};
