import type { Message, StoryGroup } from '../types';
import { ApiClient, getApiBase } from './core';

declare module './core' {
  interface ApiClient {
    getMessages(chatId: string, cursor?: string): Promise<Message[]>;
    uploadFile(file: File): Promise<any>;
    getSharedMedia(chatId: string, type: 'media' | 'files' | 'links'): Promise<Message[]>;
    // Stories
    getStories(): Promise<StoryGroup[]>;
    createStory(data: { type: string; mediaUrl?: string; content?: string; bgColor?: string; audioUrl?: string }): Promise<{ id: string }>;
    viewStory(storyId: string): Promise<{ message: string }>;
    deleteStory(storyId: string): Promise<{ message: string }>;
    getStoryViewers(storyId: string): Promise<Array<{ userId: string; username: string; displayName: string; avatar: string | null; viewedAt: string }>>;
    // Threads
    createThread(chatId: string, messageId: string, title?: string): Promise<{ id: string; messageId: string; chatId: string; title: string | null }>;
    getThreads(chatId: string): Promise<Array<{ id: string; messageId: string; chatId: string; title: string | null; replyCount: number; message: Message }>>;
    getThreadMessages(threadId: string): Promise<Message[]>;
    deleteThread(threadId: string): Promise<{ success: boolean }>;
    // Reactions
    addReaction(messageId: string, emoji: string): Promise<any>;
    removeReaction(messageId: string, emoji: string): Promise<any>;
    getReactions(messageId: string): Promise<any>;
    // Polls
    createPoll(chatId: string, question: string, options: string[], allowMultiple: boolean, isAnonymous: boolean, duration: number): Promise<any>;
    votePoll(pollId: string, optionIds: string[]): Promise<any>;
    removePollVote(pollId: string): Promise<any>;
    getPollResults(pollId: string): Promise<any>;
  }
}

export function installMessages(api: ApiClient): void {
  // ─── Messages ─────────────────────────────────────────────────────
  api.getMessages = async (chatId: string, cursor?: string) => {
    const params = cursor ? `?cursor=${cursor}` : '';
    return api.request<Message[]>(`/messages/chat/${chatId}${params}`);
  };

  api.uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('files', file);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300_000);
    const storedToken = api.getStoredAccessToken();
    const response = await fetch(`${getApiBase()}/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {}),
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Ошибка загрузки файла' }));
      throw new Error(error.error || `Ошибка загрузки: ${response.status}`);
    }
    const result = await response.json();

    if (Array.isArray(result)) return result[0];
    if (result.files && Array.isArray(result.files)) return result.files[0];
    if (result.fileId || result.url) return result;

    console.error('[uploadFile] Unexpected response:', result);
    throw new Error('Неожиданный ответ сервера при загрузке');
  };

  api.getSharedMedia = async (chatId: string, type) => {
    return api.request<Message[]>(`/messages/chat/${chatId}/shared?type=${type}`);
  };

  // ─── Stories ──────────────────────────────────────────────────────
  api.getStories = async () => {
    return api.request<StoryGroup[]>('/stories');
  };

  api.createStory = async (data) => {
    return api.request<{ id: string }>('/stories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  api.viewStory = async (storyId: string) => {
    return api.request<{ message: string }>(`/stories/${storyId}/view`, { method: 'POST' });
  };

  api.deleteStory = async (storyId: string) => {
    return api.request<{ message: string }>(`/stories/${storyId}`, { method: 'DELETE' });
  };

  api.getStoryViewers = async (storyId: string) => {
    return api.request<Array<{ userId: string; username: string; displayName: string; avatar: string | null; viewedAt: string }>>(`/stories/${storyId}/viewers`);
  };

  // ─── Threads ──────────────────────────────────────────────────────
  api.createThread = async (chatId: string, messageId: string, title?: string) => {
    return api.request<{ id: string; messageId: string; chatId: string; title: string | null }>(`/threads/chat/${chatId}/thread`, {
      method: 'POST',
      body: JSON.stringify({ messageId, title }),
    });
  };

  api.getThreads = async (chatId: string) => {
    return api.request<Array<{ id: string; messageId: string; chatId: string; title: string | null; replyCount: number; message: Message }>>(`/threads/chat/${chatId}`);
  };

  api.getThreadMessages = async (threadId: string) => {
    return api.request<Message[]>(`/threads/thread/${threadId}/messages`);
  };

  api.deleteThread = async (threadId: string) => {
    return api.request<{ success: boolean }>(`/threads/thread/${threadId}`, {
      method: 'DELETE',
    });
  };

  // ─── Reactions ────────────────────────────────────────────────────
  api.addReaction = async (messageId: string, emoji: string) => {
    return api.request(`/reactions/${messageId}`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  };

  api.removeReaction = async (messageId: string, emoji: string) => {
    return api.request(`/reactions/${messageId}/${encodeURIComponent(emoji)}`, {
      method: 'DELETE',
    });
  };

  api.getReactions = async (messageId: string) => {
    return api.request(`/reactions/${messageId}`);
  };

  // ─── Polls ────────────────────────────────────────────────────────
  api.createPoll = async (chatId: string, question: string, options: string[], allowMultiple: boolean, isAnonymous: boolean, duration: number) => {
    return api.request('/polls', {
      method: 'POST',
      body: JSON.stringify({ chatId, question, options, allowMultiple, isAnonymous, duration }),
    });
  };

  api.votePoll = async (pollId: string, optionIds: string[]) => {
    return api.request(`/polls/${pollId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionIds }),
    });
  };

  api.removePollVote = async (pollId: string) => {
    return api.request(`/polls/${pollId}/vote`, { method: 'DELETE' });
  };

  api.getPollResults = async (pollId: string) => {
    return api.request(`/polls/${pollId}/results`);
  };
}
