import { ApiClient, getApiBase } from './core';

export interface ImportZipResult {
  ok: boolean;
  importedMessages: number;
  skippedMessages: number;
  importedMedia: number;
  mediaUnavailable: number;
}

declare module './core' {
  interface ApiClient {
    /** Экспорт данных в зашифрованный ZIP-архив (AES-256-GCM, пароль). */
    exportDataZip(password: string): Promise<Blob>;
    /** Импорт сообщений из зашифрованного ZIP-архива. */
    importDataZip(file: File, password: string): Promise<ImportZipResult>;
  }
}

export function installBackup(api: ApiClient): void {
  // Формат ответа — бинарный ZIP, поэтому не используем api.request (он ждёт JSON).
  api.exportDataZip = async (password) => {
    const token = api.getStoredAccessToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (api.csrfToken) headers['X-CSRF-Token'] = api.csrfToken;

    const res = await fetch(`${getApiBase()}/account/export2`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
      throw new Error(err.error || 'Ошибка экспорта');
    }
    return res.blob();
  };

  api.importDataZip = async (file, password) => {
    const form = new FormData();
    form.append('file', file);
    form.append('password', password);
    return api.request<ImportZipResult>('/account/import', {
      method: 'POST',
      body: form,
    });
  };
}