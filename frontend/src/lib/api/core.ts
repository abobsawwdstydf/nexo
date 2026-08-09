import { getApiUrl } from '../../config';

export const getApiBase = (): string => {
  const url = getApiUrl();
  return url ? url + '/api' : '/api';
};

export class ApiClient {
  /** @internal */ csrfToken: string | null = null;
  /** @internal */ refreshPromise: Promise<boolean> | null = null;
  /** @internal */ onAuthFailed?: () => void;
  private pendingRequests = new Map<string, Promise<any>>();

  setCsrfToken(token: string | null) {
    this.csrfToken = token;
  }

  setOnAuthFailed(callback: () => void) {
    this.onAuthFailed = callback;
  }

  /** @internal */
  getStoredAccessToken(): string | null {
    try {
      return localStorage.getItem('nexo_access_token');
    } catch {
      return null;
    }
  }

  /** @internal */
  getStoredRefreshToken(): string | null {
    try {
      return localStorage.getItem('nexo_refresh_token');
    } catch {
      return null;
    }
  }

  /** @internal */
  setStoredRefreshToken(token: string | null) {
    try {
      if (token) {
        localStorage.setItem('nexo_refresh_token', token);
      } else {
        localStorage.removeItem('nexo_refresh_token');
      }
    } catch { /* localStorage not available */ }
  }

  /** @internal */
  async doRefresh(): Promise<boolean> {
    try {
      const refreshToken = this.getStoredRefreshToken();

      const refreshController = new AbortController();
      const refreshTimer = setTimeout(() => refreshController.abort(), 10_000);

      const body: Record<string, string> = {};
      if (refreshToken) {
        body.refreshToken = refreshToken;
      }

      const refreshResponse = await fetch(`${getApiBase()}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: refreshController.signal,
      });
      clearTimeout(refreshTimer);

      if (!refreshResponse.ok) return false;

      const data = await refreshResponse.json();

      if (data.accessToken) {
        try {
          localStorage.setItem('nexo_access_token', data.accessToken);
        } catch { /* localStorage not available */ }
      }
      if (data.refreshToken) {
        this.setStoredRefreshToken(data.refreshToken);
      }
      if (data.csrfToken) {
        this.csrfToken = data.csrfToken;
      }

      return true;
    } catch {
      return false;
    }
  }

  /** @internal Core request method — handles auth, CSRF, timeout, refresh, and deduplication. */
  async request<T>(endpoint: string, options: RequestInit & { timeout?: number } = {}): Promise<T> {
    const method = options.method || 'GET';
    if (method === 'GET') {
      const cacheKey = `GET:${endpoint}`;
      const pending = this.pendingRequests.get(cacheKey);
      if (pending) return pending as Promise<T>;
      const promise = this._doRequest<T>(endpoint, options);
      this.pendingRequests.set(cacheKey, promise);
      promise.finally(() => this.pendingRequests.delete(cacheKey));
      return promise;
    }
    return this._doRequest<T>(endpoint, options);
  }

  private async _doRequest<T>(endpoint: string, options: RequestInit & { timeout?: number } = {}, retried = false): Promise<T> {
    const { timeout = 30_000, ...fetchOptions } = options;
    const controller = new AbortController();
    const timer = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : undefined;

    const isFormData = fetchOptions.body instanceof FormData;
    const isMutation = fetchOptions.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(fetchOptions.method);

    const storedToken = this.getStoredAccessToken();
    
    const headers: HeadersInit = {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(this.csrfToken && isMutation ? { 'X-CSRF-Token': this.csrfToken } : {}),
      ...(storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {}),
      ...fetchOptions.headers,
    };

    let response: Response;
    try {
      response = await fetch(`${getApiBase()}${endpoint}`, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
        credentials: 'include',
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Время ожидания запроса истекло');
      }
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        throw new Error('Сервер недоступен. Проверьте подключение к интернету и повторите попытку.');
      }
      throw err;
    }
    clearTimeout(timer);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
      
      // Stale/invalid CSRF token (e.g. after backend restart): fetch a fresh
      // one from the public endpoint and retry the mutation once.
      if (response.status === 403 && error.error?.includes('CSRF') && isMutation && !(fetchOptions.headers as Record<string, string>)?.['X-CSRF-Token-Retry']) {
        try {
          const csrfRes = await fetch(`${getApiBase()}/csrf-token`, { credentials: 'include' });
          if (csrfRes.ok) {
            const csrfData = await csrfRes.json();
            if (csrfData.token) {
              this.csrfToken = csrfData.token;
              return this.request<T>(endpoint, {
                ...options,
                headers: { ...fetchOptions.headers, 'X-CSRF-Token-Retry': '1' },
              });
            }
          }
        } catch { /* fall through to error */ }
      }

      if (response.status === 401) {
        const isAuthEndpoint = endpoint.startsWith('/auth/');

        // Retry after refresh only once, directly through _doRequest to bypass
        // GET deduplication (otherwise the retry reuses its own pending promise
        // and deadlocks) and to avoid an infinite 401→refresh→retry loop.
        if (!isAuthEndpoint && !retried) {
          if (!this.refreshPromise) {
            this.refreshPromise = this.doRefresh().finally(() => {
              this.refreshPromise = null;
            });
          }

          const refreshOk = await this.refreshPromise;

          if (refreshOk) {
            return this._doRequest<T>(endpoint, options, true);
          }

          this.onAuthFailed?.();
        }
      }
      
      throw new Error(error.error || 'Ошибка запроса');
    }

    const data = await response.json();
    
    if (data.csrfToken) {
      this.csrfToken = data.csrfToken;
    }
    
    return data;
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async post<T = any>(endpoint: string, data: any): Promise<T> {
    if (data instanceof FormData) {
      return this.request<T>(endpoint, { method: 'POST', body: data, headers: {} });
    }
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) });
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}
