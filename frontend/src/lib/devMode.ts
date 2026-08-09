import { getApiBase } from './api/core';
import { useAuthStore } from '../stores/authStore';

const DEV_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

/** true только на локальных хостах разработчика. В проде всегда false. */
export function isDevLocal(): boolean {
  return DEV_HOSTS.includes(window.location.hostname);
}

/** Dev-ключ: сначала localStorage (поле в UI), затем VITE_DEV_LOGIN_KEY из build. */
export function getDevLoginKey(): string | null {
  try {
    const stored = localStorage.getItem('nexo_dev_login_key');
    if (stored) return stored;
  } catch { /* localStorage недоступен */ }
  const envKey = import.meta.env.VITE_DEV_LOGIN_KEY;
  return typeof envKey === 'string' && envKey ? envKey : null;
}

/** Выполняет dev-вход: POST /api/dev/login → сохраняет токены и сессию. */
export async function devLogin(key?: string): Promise<void> {
  const devKey = key ?? getDevLoginKey();
  if (!devKey) {
    throw new Error('Ключ разработчика не задан');
  }

  const response = await fetch(`${getApiBase()}/dev/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Dev-Key': devKey },
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Dev-вход не удался');
  }

  const result = await response.json();
  if (!result.accessToken || !result.user) {
    throw new Error('Неожиданный ответ сервера');
  }

  if (result.refreshToken) {
    try {
      localStorage.setItem('nexo_refresh_token', result.refreshToken);
    } catch { /* localStorage недоступен */ }
  }
  if (key) {
    try {
      localStorage.setItem('nexo_dev_login_key', key);
    } catch { /* localStorage недоступен */ }
  }

  useAuthStore.getState().loginWithToken(result.accessToken, result.user);
}