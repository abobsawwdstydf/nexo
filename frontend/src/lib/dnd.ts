import type { DndSettings } from '../stores/initStore';

function parseHHMM(value: string | undefined | null): number | null {
  if (!value) return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Client-side check: is the daily "Do Not Disturb" window active right now?
 * Mirrors backend/handlers/dnd.go isDndActive. Supports windows crossing
 * midnight (start > end ⇒ active before end or from start onward).
 */
export function isDndActiveNow(settings: { dnd?: DndSettings } | undefined | null): boolean {
  const dnd = settings?.dnd;
  if (!dnd || !dnd.enabled) return false;
  const start = parseHHMM(dnd.start);
  const end = parseHHMM(dnd.end);
  if (start === null || end === null) return false;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  if (start <= end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}

/** Human-readable window label, e.g. «Активен с 22:00 до 08:00». */
export function formatDndWindow(dnd: DndSettings | undefined | null): string {
  const start = dnd?.start || '—';
  const end = dnd?.end || '—';
  return `Активен с ${start} до ${end}`;
}