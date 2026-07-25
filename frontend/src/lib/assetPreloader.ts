/**
 * Smart asset preloader.
 *
 * Background-warms Cache Storage with app assets (logos, icons, sounds, common
 * textures) so the second visit is instant, while doing as little work as
 * possible on the device:
 *  - Skips on 2G / slow-2G / save-data / metered connections.
 *  - Respects navigator.storage quota (skips when >85% full).
 *  - Uses requestIdleCallback with a 3s timeout to avoid blocking the main thread.
 *  - Throttles concurrent fetches to 4 to keep RAM/CPU low.
 *  - Marks each URL with priority: 'low' so the browser de-prioritises them.
 *  - Runs at most once per 24h (timestamped in localStorage).
 *  - All errors are swallowed — this is a best-effort optimisation.
 */

const CACHE_NAME = 'app-shell-prewarm-v1';
const LAST_RUN_KEY = 'nexo_prewarm_last_run';
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_CONCURRENT = 4;
const IDLE_TIMEOUT_MS = 3000;
const MAX_TOTAL_SIZE_MB = 25;
const QUOTA_USAGE_LIMIT = 0.85;

const PREWARM_ASSETS: ReadonlyArray<string> = [
  '/logo.png',
  '/logo1.png',
  '/no_bg.png',
  '/no_bg1.png',
  '/galochcka.png',
  '/beaver-coin.png',
  '/beaver-coin.svg',
  '/favicon.ico',
  '/sounds/computer-keyboard.ogg',
  '/sounds/otpravit_musik.wav',
  '/sounds/uved_musik.mp3',
  '/sounds/call_sound.mp3',
  '/sounds/abonent_nedostupen.mp3',
];

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
    downlink?: number;
  };
}

function isSlowConnection(): boolean {
  if (typeof navigator === 'undefined') return true;
  const nav = navigator as NavigatorWithConnection;
  const conn = nav.connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  const type = conn.effectiveType;
  if (type === 'slow-2g' || type === '2g') return true;
  if (typeof conn.downlink === 'number' && conn.downlink < 1.5) return true;
  return false;
}

async function hasEnoughQuota(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return true;
  try {
    const { quota, usage } = await navigator.storage.estimate();
    if (!quota || !usage) return true;
    return usage / quota < QUOTA_USAGE_LIMIT;
  } catch {
    return true;
  }
}

function shouldSkipRecently(): boolean {
  try {
    const last = Number(localStorage.getItem(LAST_RUN_KEY) || 0);
    return Date.now() - last < RUN_INTERVAL_MS;
  } catch {
    return true;
  }
}

function markRan(): void {
  try {
    localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
  } catch {}
}

async function runWhenIdle(cb: () => void): Promise<void> {
  if (typeof window === 'undefined') return;
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined;
  if (ric) {
    ric(cb, { timeout: IDLE_TIMEOUT_MS });
    return;
  }
  setTimeout(cb, 1500);
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: 'force-cache',
      credentials: 'same-origin',
      priority: 'low',
      signal: controller.signal,
    } as RequestInit);
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const runners: Array<Promise<void>> = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    runners.push(
      (async () => {
        while (true) {
          const idx = cursor++;
          if (idx >= items.length) return;
          const r = await worker(items[idx]);
          if (r !== null && r !== undefined) results.push(r);
        }
      })(),
    );
  }
  await Promise.all(runners);
  return results;
}

async function openCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

async function isAlreadyCached(cache: Cache, url: string): Promise<boolean> {
  try {
    const hit = await cache.match(url);
    return !!hit;
  } catch {
    return false;
  }
}

let scheduled = false;

export function scheduleAssetPrewarm(): void {
  if (scheduled) return;
  if (typeof window === 'undefined') return;
  if (shouldSkipRecently()) return;
  if (isSlowConnection()) return;

  scheduled = true;

  runWhenIdle(async () => {
    try {
      if (!(await hasEnoughQuota())) return;
      const cache = await openCache();
      if (!cache) return;

      const todo = PREWARM_ASSETS.filter(u => !isAlreadyCached(cache, u));
      if (todo.length === 0) {
        markRan();
        return;
      }

      let totalBytes = 0;
      await mapWithConcurrency(todo, MAX_CONCURRENT, async url => {
        const res = await fetchWithTimeout(url, 8000);
        if (!res) return null;
        const blob = await res.clone().blob();
        totalBytes += blob.size;
        if (totalBytes > MAX_TOTAL_SIZE_MB * 1024 * 1024) return null;
        try {
          await cache.put(url, res);
        } catch {}
        return url;
      });

      markRan();
    } catch {}
  });
}

export function isImageCached(url: string): Promise<boolean> {
  return openCache().then(async cache => {
    if (!cache) return false;
    return isAlreadyCached(cache, url);
  });
}

export async function preloadImageInstant(url: string): Promise<boolean> {
  const cache = await openCache();
  if (!cache) return false;
  if (await isAlreadyCached(cache, url)) return true;
  const res = await fetchWithTimeout(url, 6000);
  if (!res) return false;
  try {
    await cache.put(url, res);
    return true;
  } catch {
    return false;
  }
}
