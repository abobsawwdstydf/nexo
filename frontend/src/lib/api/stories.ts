import type { Story } from '../types';
import { ApiClient } from './core';

export interface CreateStoryInput {
  type?: 'text' | 'photo' | 'video';
  mediaUrl?: string;
  content?: string;
  bgColor?: string;
  expiresIn?: number;
}

declare module './core' {
  interface ApiClient {
    getStories(): Promise<Story[]>;
    createStory(input: CreateStoryInput): Promise<Story>;
    viewStory(storyId: string): Promise<{ ok: boolean }>;
    addStoryReaction(storyId: string, emoji: string): Promise<{ ok: boolean }>;
    deleteStory(storyId: string): Promise<{ ok: boolean }>;
  }
}

export function installStories(api: ApiClient): void {
  api.getStories = async () => {
    return api.get<Story[]>('/stories');
  };

  api.createStory = async (input: CreateStoryInput) => {
    return api.post<Story>('/stories', input);
  };

  api.viewStory = async (storyId: string) => {
    return api.post<{ ok: boolean }>(`/stories/${storyId}/view`, {});
  };

  api.addStoryReaction = async (storyId: string, emoji: string) => {
    return api.post<{ ok: boolean }>(`/stories/${storyId}/reactions`, { emoji });
  };

  api.deleteStory = async (storyId: string) => {
    return api.request<{ ok: boolean }>(`/stories/${storyId}`, { method: 'DELETE' });
  };
}