import type { UploadedMedia } from '../types';
import { ApiClient, getApiBase } from './core';

declare module './core' {
  interface ApiClient {
    /**
     * Uploads a single file with progress reporting, backed by XMLHttpRequest
     * (fetch cannot report upload progress). Rejects with DOMException
     * 'AbortError' when `signal` is aborted. Resolves like `uploadFile`.
     */
    uploadFileWithProgress(
      file: File,
      onProgress?: (pct: number) => void,
      signal?: AbortSignal
    ): Promise<UploadedMedia>;
  }
}

type UploadResponse = Partial<UploadedMedia> & { files?: UploadedMedia[] };

function normalizeUploadResponse(result: UploadResponse): UploadedMedia {
  if (result.files && result.files.length) return result.files[0];
  if (result.fileId || result.url) return result;
  throw new Error('Неожиданный ответ сервера при загрузке');
}

export function installUpload(api: ApiClient): void {
  api.uploadFileWithProgress = (file, onProgress, signal) =>
    new Promise<UploadedMedia>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${getApiBase()}/upload`);
      xhr.timeout = 300_000; // mirrors the fetch timeout used by api.uploadFile

      const token = api.getStoredAccessToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (api.csrfToken) xhr.setRequestHeader('X-CSRF-Token', api.csrfToken);

      const onAbort = () => xhr.abort();
      if (signal) {
        if (signal.aborted) {
          reject(new DOMException('Загрузка отменена', 'AbortError'));
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }
      const cleanup = () => {
        if (signal) signal.removeEventListener('abort', onAbort);
      };

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          onProgress?.(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        cleanup();
        try {
          const result = JSON.parse(xhr.responseText) as UploadResponse;
          resolve(normalizeUploadResponse(result));
        } catch (err) {
          reject(new Error('Неожиданный ответ сервера при загрузке'));
        }
      };

      xhr.onerror = () => {
        cleanup();
        reject(new Error('Сервер недоступен. Проверьте подключение к интернету и повторите попытку.'));
      };

      xhr.ontimeout = () => {
        cleanup();
        reject(new Error('Время ожидания запроса истекло'));
      };

      xhr.onabort = () => {
        cleanup();
        reject(new DOMException('Загрузка отменена', 'AbortError'));
      };

      const formData = new FormData();
      formData.append('file', file, file.name);
      xhr.send(formData);
    });
}