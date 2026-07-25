import type { Chat, SmartFolder, ChatNote, CollectedLink, VoiceRoom, AnonymousChat, WebhookConfig } from '../types';
import { ApiClient, getApiBase } from './core';

declare module './core' {
  interface ApiClient {
    // Folders
    getFolders(): Promise<Array<{ id: string; name: string; icon: string; color: string; order: number; chats: Chat[] }>>;
    createFolder(data: { name: string; icon: string; color: string }): Promise<any>;
    updateFolder(id: string, data: { name?: string; icon?: string; color?: string; order?: number }): Promise<any>;
    deleteFolder(id: string): Promise<{ success: boolean }>;
    addChatToFolder(folderId: string, chatId: string): Promise<any>;
    removeChatFromFolder(folderId: string, chatId: string): Promise<{ success: boolean }>;
    shareFolderLink(folderId: string, options?: { expiresIn?: number; maxUses?: number }): Promise<{ token: string; url: string; expiresAt: string | null; maxUses: number | null; folder: { name: string; icon: string; color: string; chatsCount: number } }>;
    getSharedFolder(token: string): Promise<{ folder: { name: string; icon: string; color: string; chats: Array<{ id: string; name: string | null; username: string | null; type: string; avatar: string | null; description: string | null; isVerified: boolean; verifiedBadgeUrl: string | null; verifiedBadgeType: string | null }> }; expiresAt: string | null; usedCount: number; maxUses: number | null }>;
    addSharedFolder(token: string): Promise<{ folder: any; addedChats: number; totalChats: number }>;
    // Video Notes
    uploadVideoNote(formData: FormData): Promise<any>;
    // Profile Music
    uploadProfileMusic(file: File, duration: number): Promise<any>;
    // Secret Chats
    createSecretChat(userId: string, password?: string, selfDestructTimer?: number): Promise<{ chat: Chat; selfDestructTimer?: number }>;
    verifySecretChatPassword(chatId: string, password: string): Promise<{ success: boolean }>;
    setMessageSelfDestruct(messageId: string, timer: number): Promise<{ message: any }>;
    deleteSecretChat(chatId: string): Promise<{ success: boolean }>;
    getSecretChatSettings(chatId: string): Promise<{ isSecret: boolean; isE2E: boolean; hasPassword: boolean }>;
    reportScreenshot(chatId: string): Promise<{ success: boolean; notified: number }>;
    // Hidden Chats
    setHiddenChatPassword(chatId: string, password: string): Promise<{ success: boolean }>;
    verifyHiddenChatPassword(chatId: string, password: string): Promise<{ success: boolean }>;
    removeHiddenChatPassword(chatId: string, password: string): Promise<{ success: boolean }>;
    // Templates
    getTemplates(): Promise<any[]>;
    createTemplate(name: string, content: string): Promise<any>;
    updateTemplate(id: string, name: string, content: string): Promise<any>;
    deleteTemplate(id: string): Promise<any>;
    // Tasks
    getTasks(): Promise<any[]>;
    getChatTasks(chatId: string): Promise<any[]>;
    createTask(data: { chatId: string; title: string; description?: string; priority?: string; deadline?: string; assigneeId?: string }): Promise<any>;
    updateTask(id: string, data: any): Promise<any>;
    deleteTask(id: string): Promise<any>;
    // Calendar
    getCalendarEvents(): Promise<any[]>;
    createCalendarEvent(data: { title: string; description?: string; location?: string; startAt: string; endAt?: string; chatId?: string; inviteeIds?: string[] }): Promise<any>;
    updateCalendarEvent(id: string, data: any): Promise<any>;
    deleteCalendarEvent(id: string): Promise<any>;
    respondToCalendarEvent(id: string, status: 'accepted' | 'declined' | 'maybe'): Promise<any>;
    inviteToCalendarEvent(id: string, inviteeIds: string[]): Promise<any>;
    // Badges
    getBadges(userId: string): Promise<any>;
    getMyBadges(): Promise<any>;
    checkBadges(): Promise<any>;
    // Playlists
    getPlaylists(): Promise<any>;
    getChatPlaylists(chatId: string): Promise<any>;
    // Fake Password
    getFakePasswordSettings(): Promise<any>;
    setFakePassword(data: { currentPassword: string; fakePassword?: string | null; fakeChats?: string[] }): Promise<any>;
    // Achievements
    getAchievements(): Promise<any>;
    getMyAchievements(): Promise<any>;
    claimAchievementReward(achievementId: string): Promise<any>;
    // Premium
    getPremiumStatus(): Promise<{ isPremium: boolean; premiumUntil: string | null }>;
    createPayment(data: { type: 'premium' | 'premium_gift'; premiumMonths: number; giftToUserId?: string }): Promise<{ paymentId: string; confirmationUrl: string; amount: number }>;
    getPremiumPrices(): Promise<{ prices: Record<number, number>; currency: string }>;
    getPaymentHistory(): Promise<any[]>;
    // Smart Folders
    getSmartFolders(): Promise<{ items: SmartFolder[] }>;
    createSmartFolder(data: { name: string; icon?: string; color?: string; rules?: string }): Promise<SmartFolder>;
    updateSmartFolder(id: string, data: { name?: string; icon?: string; color?: string; rules?: string }): Promise<SmartFolder>;
    deleteSmartFolder(id: string): Promise<any>;
    reorderSmartFolders(folderIds: string[]): Promise<any>;
    getSmartFolderChats(id: string): Promise<{ items: Chat[] }>;
    // Notes
    getChatNotes(chatId: string): Promise<{ items: ChatNote[] }>;
    createChatNote(chatId: string, content: string): Promise<ChatNote>;
    updateChatNote(noteId: string, data: { content?: string; pinned?: boolean }): Promise<ChatNote>;
    deleteChatNote(noteId: string): Promise<any>;
    // Links
    getCollectedLinks(params?: { chatId?: string; domain?: string; category?: string; page?: number }): Promise<{ items: CollectedLink[]; total: number; hasMore: boolean }>;
    saveCollectedLink(linkId: string): Promise<any>;
    getLinkDomains(): Promise<{ items: string[] }>;
    // Voice Rooms
    getVoiceRooms(): Promise<{ items: VoiceRoom[] }>;
    createVoiceRoom(data: { chatId: string; name: string; description?: string }): Promise<VoiceRoom>;
    joinVoiceRoom(roomId: string): Promise<any>;
    leaveVoiceRoom(roomId: string): Promise<any>;
    updateVoiceRoomParticipant(roomId: string, data: { isMuted?: boolean; isDeaf?: boolean; isSpeaking?: boolean }): Promise<any>;
    deleteVoiceRoom(roomId: string): Promise<any>;
    // Anonymous
    findAnonymousMatch(topic?: string): Promise<{ chat: AnonymousChat; status: 'waiting' | 'matched' }>;
    rateAnonymousChat(chatId: string, rating: number): Promise<any>;
    getAnonymousChats(): Promise<{ items: AnonymousChat[] }>;
    // Webhooks
    getWebhookConfigs(): Promise<{ items: WebhookConfig[] }>;
    createWebhookConfig(data: { url: string; events: string }): Promise<WebhookConfig>;
    deleteWebhookConfig(webhookId: string): Promise<any>;
    // E2E
    uploadKeyBundle(data: { identityKey: string; signedPreKey: string; signedKeySig: string; oneTimePreKeys: string[]; deviceId: string }): Promise<any>;
    fetchKeyBundle(userId: string): Promise<{ bundles: Array<{ identityKey: string; signedPreKey: string; signedKeySig: string; oneTimePreKeys: string[]; deviceId: string; userId: string }> }>;
    consumeOneTimePreKey(userId: string): Promise<{ oneTimePreKey: string }>;
    initE2ESession(data: { chatId: string; encryptedKey: string }): Promise<{ ok: boolean; sessionId: string; existed: boolean }>;
    getE2ESession(chatId: string): Promise<{ sessionId: string; chatId: string; isActive: boolean; createdAt: string }>;
    deleteE2ESession(chatId: string): Promise<any>;
    // Cloud
    cloudUpload(file: File): Promise<any>;
    cloudList(): Promise<{ files: any[]; total: number; totalSize: number }>;
    cloudDelete(fileId: string): Promise<any>;
    cloudStats(): Promise<{ totalSize: number; fileCount: number; maxSize: number; formatted: string }>;
    // Premium Badge
    uploadPremiumBadge(file: File): Promise<{ premiumBadgeUrl: string }>;
    deletePremiumBadge(): Promise<any>;
  }
}

export function installFeatures(api: ApiClient): void {
  // ─── Folders ──────────────────────────────────────────────────────
  api.getFolders = async () => {
    return api.request<Array<{
      id: string;
      name: string;
      icon: string;
      color: string;
      order: number;
      chats: Chat[];
    }>>('/folders');
  };

  api.createFolder = async (data) => {
    return api.request<any>('/folders', { method: 'POST', body: JSON.stringify(data) });
  };

  api.updateFolder = async (id, data) => {
    return api.request<any>(`/folders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  };

  api.deleteFolder = async (id) => {
    return api.request<{ success: boolean }>(`/folders/${id}`, { method: 'DELETE' });
  };

  api.addChatToFolder = async (folderId, chatId) => {
    return api.request<any>(`/folders/${folderId}/chats`, {
      method: 'POST',
      body: JSON.stringify({ chatId }),
    });
  };

  api.removeChatFromFolder = async (folderId, chatId) => {
    return api.request<{ success: boolean }>(`/folders/${folderId}/chats/${chatId}`, { method: 'DELETE' });
  };

  api.shareFolderLink = async (folderId, options?) => {
    return api.request<{
      token: string;
      url: string;
      expiresAt: string | null;
      maxUses: number | null;
      folder: { name: string; icon: string; color: string; chatsCount: number };
    }>(`/folders/${folderId}/share`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  };

  api.getSharedFolder = async (token) => {
    return api.request<{
      folder: {
        name: string;
        icon: string;
        color: string;
        chats: Array<{
          id: string;
          name: string | null;
          username: string | null;
          type: string;
          avatar: string | null;
          description: string | null;
          isVerified: boolean;
          verifiedBadgeUrl: string | null;
          verifiedBadgeType: string | null;
        }>;
      };
      expiresAt: string | null;
      usedCount: number;
      maxUses: number | null;
    }>(`/folders/shared/${token}`);
  };

  api.addSharedFolder = async (token) => {
    return api.request<{
      folder: any;
      addedChats: number;
      totalChats: number;
    }>(`/folders/shared/${token}/add`, { method: 'POST' });
  };

  // ─── Video Notes ──────────────────────────────────────────────────
  api.uploadVideoNote = async (formData: FormData) => {
    const storedToken = api.getStoredAccessToken();
    const response = await fetch(`${getApiBase()}/video-notes`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
      throw new Error(error.error || 'Ошибка загрузки видеокружка');
    }

    return response.json();
  };

  // ─── Profile Music ────────────────────────────────────────────────
  api.uploadProfileMusic = async (file: File, duration: number) => {
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('duration', duration.toString());

    const storedToken = api.getStoredAccessToken();
    const response = await fetch(`${getApiBase()}/profile-music`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
      throw new Error(error.error || 'Ошибка загрузки музыки');
    }

    return response.json();
  };

  // ─── Secret Chats ─────────────────────────────────────────────────
  api.createSecretChat = async (userId, password?, selfDestructTimer?) => {
    return api.request<{ chat: Chat; selfDestructTimer?: number }>('/secret-chats/create', {
      method: 'POST',
      body: JSON.stringify({ userId, password, selfDestructTimer }),
    });
  };

  api.verifySecretChatPassword = async (chatId, password) => {
    return api.request<{ success: boolean }>('/secret-chats/verify', {
      method: 'POST',
      body: JSON.stringify({ chatId, password }),
    });
  };

  api.setMessageSelfDestruct = async (messageId, timer) => {
    return api.request<{ message: any }>('/secret-chats/message/self-destruct', {
      method: 'POST',
      body: JSON.stringify({ messageId, timer }),
    });
  };

  api.deleteSecretChat = async (chatId) => {
    return api.request<{ success: boolean }>(`/secret-chats/${chatId}`, { method: 'DELETE' });
  };

  api.getSecretChatSettings = async (chatId) => {
    return api.request<{ isSecret: boolean; isE2E: boolean; hasPassword: boolean }>(`/secret-chats/${chatId}/settings`);
  };

  api.reportScreenshot = async (chatId) => {
    return api.request<{ success: boolean; notified: number }>(`/secret-chats/${chatId}/screenshot`, {
      method: 'POST',
    });
  };

  // ─── Hidden Chats ─────────────────────────────────────────────────
  api.setHiddenChatPassword = async (chatId, password) => {
    return api.request<{ success: boolean }>('/secret-chats/hidden/set-password', {
      method: 'POST',
      body: JSON.stringify({ chatId, password }),
    });
  };

  api.verifyHiddenChatPassword = async (chatId, password) => {
    return api.request<{ success: boolean }>('/secret-chats/hidden/verify-password', {
      method: 'POST',
      body: JSON.stringify({ chatId, password }),
    });
  };

  api.removeHiddenChatPassword = async (chatId, password) => {
    return api.request<{ success: boolean }>('/secret-chats/hidden/remove-password', {
      method: 'POST',
      body: JSON.stringify({ chatId, password }),
    });
  };

  // ─── Templates ────────────────────────────────────────────────────
  api.getTemplates = async () => {
    return api.request<any[]>('/templates');
  };

  api.createTemplate = async (name, content) => {
    return api.request<any>('/templates', { method: 'POST', body: JSON.stringify({ name, content }) });
  };

  api.updateTemplate = async (id, name, content) => {
    return api.request<any>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify({ name, content }) });
  };

  api.deleteTemplate = async (id) => {
    return api.request<any>(`/templates/${id}`, { method: 'DELETE' });
  };

  // ─── Tasks ────────────────────────────────────────────────────────
  api.getTasks = async () => {
    return api.request<any[]>('/tasks');
  };

  api.getChatTasks = async (chatId) => {
    return api.request<any[]>(`/tasks/chat/${chatId}`);
  };

  api.createTask = async (data) => {
    return api.request<any>('/tasks', { method: 'POST', body: JSON.stringify(data) });
  };

  api.updateTask = async (id, data) => {
    return api.request<any>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  };

  api.deleteTask = async (id) => {
    return api.request<any>(`/tasks/${id}`, { method: 'DELETE' });
  };

  // ─── Calendar ─────────────────────────────────────────────────────
  api.getCalendarEvents = async () => {
    return api.request<any[]>('/calendar');
  };

  api.createCalendarEvent = async (data) => {
    return api.request<any>('/calendar', { method: 'POST', body: JSON.stringify(data) });
  };

  api.updateCalendarEvent = async (id, data) => {
    return api.request<any>(`/calendar/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  };

  api.deleteCalendarEvent = async (id) => {
    return api.request<any>(`/calendar/${id}`, { method: 'DELETE' });
  };

  api.respondToCalendarEvent = async (id, status) => {
    return api.request<any>(`/calendar/${id}/respond`, { method: 'POST', body: JSON.stringify({ status }) });
  };

  api.inviteToCalendarEvent = async (id, inviteeIds) => {
    return api.request<any>(`/calendar/${id}/invite`, { method: 'POST', body: JSON.stringify({ inviteeIds }) });
  };

  // ─── Badges ───────────────────────────────────────────────────────
  api.getBadges = async (userId) => {
    return api.request<any>(`/badges/user/${userId}`);
  };

  api.getMyBadges = async () => {
    return api.request<any>('/badges/my');
  };

  api.checkBadges = async () => {
    return api.request<any>('/badges/check', { method: 'POST', body: '{}' });
  };

  // ─── Playlists ────────────────────────────────────────────────────
  api.getPlaylists = async () => {
    return api.request<any>('/playlists');
  };

  api.getChatPlaylists = async (chatId) => {
    return api.request<any>(`/playlists/chat/${chatId}`);
  };

  // ─── Fake Password ────────────────────────────────────────────────
  api.getFakePasswordSettings = async () => {
    return api.request<any>('/fake-password/settings');
  };

  api.setFakePassword = async (data) => {
    return api.request<any>('/fake-password/set', { method: 'POST', body: JSON.stringify(data) });
  };

  // ─── Achievements ─────────────────────────────────────────────────
  api.getAchievements = async () => {
    return api.request('/achievements');
  };

  api.getMyAchievements = async () => {
    return api.request('/achievements/my');
  };

  api.claimAchievementReward = async (achievementId) => {
    return api.request(`/achievements/${achievementId}/claim`, { method: 'POST' });
  };

  // ─── Premium ──────────────────────────────────────────────────────
  api.getPremiumStatus = async () => {
    return api.request<{ isPremium: boolean; premiumUntil: string | null }>('/premium/status');
  };

  api.createPayment = async (data) => {
    return api.request<{
      paymentId: string;
      confirmationUrl: string;
      amount: number;
    }>('/premium/payment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  api.getPremiumPrices = async () => {
    return api.request<{ prices: Record<number, number>; currency: string }>('/premium/prices');
  };

  api.getPaymentHistory = async () => {
    return api.request<any[]>('/premium/history');
  };

  // ─── Smart Folders ────────────────────────────────────────────────
  api.getSmartFolders = async () => {
    return api.request<{ items: SmartFolder[] }>('/smart-folders');
  };

  api.createSmartFolder = async (data) => {
    return api.request<SmartFolder>('/smart-folders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  api.updateSmartFolder = async (id, data) => {
    return api.request<SmartFolder>(`/smart-folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  };

  api.deleteSmartFolder = async (id) => {
    return api.request(`/smart-folders/${id}`, { method: 'DELETE' });
  };

  api.reorderSmartFolders = async (folderIds) => {
    return api.request('/smart-folders/reorder', {
      method: 'PUT',
      body: JSON.stringify({ folderIds }),
    });
  };

  api.getSmartFolderChats = async (id) => {
    return api.request<{ items: Chat[] }>(`/smart-folders/${id}/chats`);
  };

  // ─── Notes ────────────────────────────────────────────────────────
  api.getChatNotes = async (chatId) => {
    return api.request<{ items: ChatNote[] }>(`/chats/${chatId}/notes`);
  };

  api.createChatNote = async (chatId, content) => {
    return api.request<ChatNote>(`/chats/${chatId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  };

  api.updateChatNote = async (noteId, data) => {
    return api.request<ChatNote>(`/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  };

  api.deleteChatNote = async (noteId) => {
    return api.request(`/notes/${noteId}`, { method: 'DELETE' });
  };

  // ─── Links ────────────────────────────────────────────────────────
  api.getCollectedLinks = async (params?) => {
    const query = new URLSearchParams();
    if (params?.chatId) query.set('chatId', params.chatId);
    if (params?.domain) query.set('domain', params.domain);
    if (params?.category) query.set('category', params.category);
    if (params?.page) query.set('page', String(params.page));
    return api.request<{ items: CollectedLink[]; total: number; hasMore: boolean }>(`/links?${query}`);
  };

  api.saveCollectedLink = async (linkId) => {
    return api.request(`/links/${linkId}/save`, { method: 'POST' });
  };

  api.getLinkDomains = async () => {
    return api.request<{ items: string[] }>('/links/domains');
  };

  // ─── Voice Rooms ──────────────────────────────────────────────────
  api.getVoiceRooms = async () => {
    return api.request<{ items: VoiceRoom[] }>('/voice-rooms');
  };

  api.createVoiceRoom = async (data) => {
    return api.request<VoiceRoom>('/voice-rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  api.joinVoiceRoom = async (roomId) => {
    return api.request(`/voice-rooms/${roomId}/join`, { method: 'POST' });
  };

  api.leaveVoiceRoom = async (roomId) => {
    return api.request(`/voice-rooms/${roomId}/leave`, { method: 'POST' });
  };

  api.updateVoiceRoomParticipant = async (roomId, data) => {
    return api.request(`/voice-rooms/${roomId}/participant`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  };

  api.deleteVoiceRoom = async (roomId) => {
    return api.request(`/voice-rooms/${roomId}`, { method: 'DELETE' });
  };

  // ─── Anonymous ────────────────────────────────────────────────────
  api.findAnonymousMatch = async (topic?) => {
    return api.request<{ chat: AnonymousChat; status: 'waiting' | 'matched' }>('/anonymous/match', {
      method: 'POST',
      body: JSON.stringify({ topic }),
    });
  };

  api.rateAnonymousChat = async (chatId, rating) => {
    return api.request('/anonymous/rate', {
      method: 'POST',
      body: JSON.stringify({ chatId, rating }),
    });
  };

  api.getAnonymousChats = async () => {
    return api.request<{ items: AnonymousChat[] }>('/anonymous/chats');
  };

  // ─── Webhooks ─────────────────────────────────────────────────────
  api.getWebhookConfigs = async () => {
    return api.request<{ items: WebhookConfig[] }>('/webhooks');
  };

  api.createWebhookConfig = async (data) => {
    return api.request<WebhookConfig>('/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  api.deleteWebhookConfig = async (webhookId) => {
    return api.request(`/webhooks/${webhookId}`, { method: 'DELETE' });
  };

  // ─── E2E Encryption ──────────────────────────────────────────────
  api.uploadKeyBundle = async (data) => {
    return api.request('/e2e/keybundle', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  api.fetchKeyBundle = async (userId) => {
    return api.request<{ bundles: Array<{ identityKey: string; signedPreKey: string; signedKeySig: string; oneTimePreKeys: string[]; deviceId: string; userId: string }> }>(`/e2e/keybundle/${userId}`);
  };

  api.consumeOneTimePreKey = async (userId) => {
    return api.request<{ oneTimePreKey: string }>(`/e2e/keybundle/${userId}/consume`, { method: 'POST' });
  };

  api.initE2ESession = async (data) => {
    return api.request<{ ok: boolean; sessionId: string; existed: boolean }>('/e2e/session', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  api.getE2ESession = async (chatId) => {
    return api.request<{ sessionId: string; chatId: string; isActive: boolean; createdAt: string }>(`/e2e/session/${chatId}`);
  };

  api.deleteE2ESession = async (chatId) => {
    return api.request(`/e2e/session/${chatId}`, { method: 'DELETE' });
  };

  // ─── Cloud Storage ────────────────────────────────────────────────
  api.cloudUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.request<any>('/cloud/upload', {
      method: 'POST',
      body: formData,
    });
  };

  api.cloudList = async () => {
    return api.request<{ files: any[]; total: number; totalSize: number }>('/cloud/files');
  };

  api.cloudDelete = async (fileId) => {
    return api.request<any>(`/cloud/${fileId}`, { method: 'DELETE' });
  };

  api.cloudStats = async () => {
    return api.request<{ totalSize: number; fileCount: number; maxSize: number; formatted: string }>('/cloud/stats');
  };

  // ─── Premium Badge ────────────────────────────────────────────────
  api.uploadPremiumBadge = async (file: File) => {
    const formData = new FormData();
    formData.append('badge', file);
    return api.request<{ premiumBadgeUrl: string }>('/premium-badge', {
      method: 'POST',
      body: formData,
    });
  };

  api.deletePremiumBadge = async () => {
    return api.request<any>('/premium-badge', { method: 'DELETE' });
  };
}
