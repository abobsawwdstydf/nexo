import { useState, useCallback } from 'react';

const KEY = 'nexo_sounds_enabled';

export function getSoundsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setSoundsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(KEY, enabled ? 'true' : 'false');
  } catch {}
}

export function useSoundsEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(getSoundsEnabled);
  const set = useCallback((v: boolean) => {
    setSoundsEnabled(v);
    setEnabled(v);
  }, []);
  return [enabled, set];
}
