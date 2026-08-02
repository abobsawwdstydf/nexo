import type { Message } from '../types';
import { api } from './index';

const AI_KEY = 'nexo_ai_messages';
const CHAT_ID = '_nexo_ai_';

export const AI_CHANGED_EVENT = 'nexo:ai-changed';

export const AI_SENDER = {
  id: '_nexo_ai_',
  username: 'nexo_ai',
  displayName: 'Нексо AI',
};

export interface AIChatResponse {
  reply: string;
  provider?: string;
  used?: number;
  limit?: number;
  remaining?: number;
  premium?: boolean;
}

export function notifyAIChanged() {
  try {
    window.dispatchEvent(new CustomEvent(AI_CHANGED_EVENT));
  } catch {}
}

export function getAIMessages(): Message[] {
  try {
    const raw = localStorage.getItem(AI_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAIMessage(msg: Message) {
  const all = getAIMessages();
  const idx = all.findIndex(m => m.id === msg.id);
  if (idx >= 0) {
    all[idx] = msg;
  } else {
    all.push(msg);
  }
  // Keep history bounded (last 100 messages)
  const trimmed = all.slice(-100);
  try {
    localStorage.setItem(AI_KEY, JSON.stringify(trimmed));
  } catch {}
  notifyAIChanged();
}

export function clearAIMessages() {
  try {
    localStorage.removeItem(AI_KEY);
  } catch {}
  notifyAIChanged();
}

/** Builds the message history payload for the backend (last 20 messages). */
export function buildAIHistory(messages: Message[]): Array<{ role: string; content: string }> {
  return messages
    .filter(m => !m.isDeleted && m.content)
    .slice(-20)
    .map(m => ({
      role: m.senderId === AI_SENDER.id ? 'assistant' : 'user',
      content: m.content as string,
    }));
}

/** Sends a message to Нексо AI and returns the assistant reply. */
export async function sendAIMessage(messages: Message[]): Promise<AIChatResponse> {
  const history = buildAIHistory(messages);
  return api.post<AIChatResponse>('/ai/chat', { messages: history });
}

export const AI_CHAT_ID = CHAT_ID;
