import { ApiClient } from './core';

export interface DndSettingsApi {
  enabled: boolean;
  start: string;
  end: string;
  timezoneOffsetMin?: number;
}

declare module './core' {
  interface ApiClient {
    getDndSettings(): Promise<{ ok: boolean; dnd: DndSettingsApi }>;
    updateDndSettings(data: { enabled: boolean; start?: string; end?: string; timezoneOffsetMin?: number }): Promise<{ ok: boolean; dnd: DndSettingsApi }>;
  }
}

export function installDnd(api: ApiClient): void {
  api.getDndSettings = async () => {
    return api.request<{ ok: boolean; dnd: DndSettingsApi }>('/settings/dnd');
  };

  api.updateDndSettings = async (data) => {
    return api.request<{ ok: boolean; dnd: DndSettingsApi }>('/settings/dnd', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  };
}