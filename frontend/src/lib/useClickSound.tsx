/**
 * Hook for warm, deep click sounds on buttons.
 * Uses Web Audio API — no audio files needed.
 */

import { playClick } from './sounds';

/**
 * AudioClickWrapper — wraps children so all child buttons play a click sound.
 * Uses event delegation on mousedown for performance.
 */
export function AudioClickWrapper({ children }: { children: React.ReactNode }) {
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]') || target.closest('a')) {
      playClick();
    }
  };

  return (
    <div onMouseDown={handleMouseDown} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
