import type { Message } from './types';

interface CacheEntry {
  messages: Message[];
  timestamp: number;
}

class MessageCache {
  private cache = new Map<string, CacheEntry>();
  private maxAge = 5 * 60 * 1000; // 5 минут
  private maxSize = 50; // Максимум 50 чатов в кэше

  set(chatId: string, messages: Message[]) {
    // Удаляем старые записи если кэш переполнен
    if (this.cache.size >= this.maxSize) {
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0];
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(chatId, {
      messages: [...messages],
      timestamp: Date.now(),
    });
  }

  get(chatId: string): Message[] | null {
    const entry = this.cache.get(chatId);
    if (!entry) return null;

    // Проверяем свежесть кэша
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(chatId);
      return null;
    }

    return entry.messages;
  }

  invalidate(chatId: string) {
    this.cache.delete(chatId);
  }

  clear() {
    this.cache.clear();
  }

  // Добавить новое сообщение в кэш
  addMessage(chatId: string, message: Message) {
    const entry = this.cache.get(chatId);
    if (entry) {
      entry.messages.push(message);
      entry.timestamp = Date.now();
    }
  }

  // Обновить сообщение в кэше
  updateMessage(chatId: string, messageId: string, updater: (msg: Message) => Message) {
    const entry = this.cache.get(chatId);
    if (entry) {
      const index = entry.messages.findIndex(m => m.id === messageId);
      if (index !== -1) {
        entry.messages[index] = updater(entry.messages[index]);
        entry.timestamp = Date.now();
      }
    }
  }
}

export const messageCache = new MessageCache();
