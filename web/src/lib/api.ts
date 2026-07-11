import type { User, UserBasic, UserPresence, Chat, Message, MediaItem, StoryGroup, FriendRequest, FriendWithId, FriendshipStatus } from './types';
import { getApiUrl } from '../config';

// Use getApiUrl() from config (reads base-url.json)
// For web (localhost): /api
// For production: absolute URL + /api or relative /api
export const getApiBase = (): string => {
  const url = getApiUrl();
  return url ? url + '/api' : '/api';
};

class ApiClient {
  private csrfToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private onAuthFailed?: () => void;

  setCsrfToken(token: string | null) {
    this.csrfToken = token;
  }

  setOnAuthFailed(callback: () => void) {
    this.onAuthFailed = callback;
  }

  private getStoredAccessToken(): string | null {
    try {
      return localStorage.getItem('nexo_access_token');
    } catch {
      return null;
    }
  }

  private async doRefresh(): Promise<boolean> {
    try {
      const refreshController = new AbortController();
      const refreshTimer = setTimeout(() => refreshController.abort(), 10_000);
      const refreshResponse = await fetch(`${getApiBase()}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        signal: refreshController.signal,
      });
      clearTimeout(refreshTimer);
      return refreshResponse.ok;
    } catch {
      return false;
    }
  }

  private async request<T>(endpoint: string, options: RequestInit & { timeout?: number } = {}): Promise<T> {
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
      throw err;
    }
    clearTimeout(timer);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
      
      if (response.status === 401) {
        const isAuthEndpoint = endpoint.startsWith('/auth/');

        if (!isAuthEndpoint) {
          if (!this.refreshPromise) {
            this.refreshPromise = this.doRefresh().finally(() => {
              this.refreshPromise = null;
            });
          }

          const refreshOk = await this.refreshPromise;

          if (refreshOk) {
            return this.request<T>(endpoint, options);
          }
        }

        try {
          localStorage.removeItem('nexo_access_token');
          localStorage.removeItem('nexo_user');
        } catch {}
        if (!isAuthEndpoint) {
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

  // Generic HTTP methods
  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Авторизация
  async login(email: string, password: string) {
    return this.request<{ requiresCode: boolean; expiresAt?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async loginConfirm(email: string, code: string) {
    return this.request<{ user: User; accessToken?: string; csrfToken?: string }>('/auth/login/confirm', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  }

  async setGlobalPassword(password: string) {
    return this.request<{ success: boolean; message: string }>('/users/global-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  async removeGlobalPassword() {
    return this.request<{ success: boolean; message: string }>('/users/global-password', {
      method: 'DELETE',
    });
  }

  async sendEmailCode(email: string) {
    return this.request<{ success: boolean; expiresAt: string }>('/auth/email/send-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async confirmEmailCode(email: string, code: string) {
    return this.request<{ success: boolean; email: string }>('/auth/email/confirm', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  }

  async register(data: {
    username: string;
    displayName?: string;
    password: string;
    bio?: string;
    avatar?: File;
  }) {
    const formData = new FormData();
    formData.append('username', data.username);
    if (data.displayName) formData.append('displayName', data.displayName);
    formData.append('password', data.password);
    if (data.bio) formData.append('bio', data.bio);
    if (data.avatar) formData.append('avatar', data.avatar);

    const response = await fetch(`${getApiBase()}/auth/register`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
      throw new Error(error.error || 'Ошибка регистрации');
    }

    const result = await response.json();
    if (result.csrfToken) {
      this.csrfToken = result.csrfToken;
    }
    return result;
  }

  async checkUsername(username: string) {
    return this.request<{ available: boolean; reason?: string }>(`/auth/check-username?username=${encodeURIComponent(username)}`);
  }

  async getMe() {
    return this.request<{ user: User; accessToken?: string; csrfToken?: string }>('/users/me');
  }

  async logout() {
    return this.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
  }

  // \u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438
  async searchUsers(query: string) {
    return this.request<UserPresence[]>(`/users/search?q=${encodeURIComponent(query)}`);
  }

  async searchChannels(query: string) {
    return this.request<Chat[]>(`/users/channels/search?q=${encodeURIComponent(query)}`);
  }

  async getUser(id: string) {
    return this.request<User>(`/users/${id}`);
  }

  async updateProfile(data: { displayName?: string; bio?: string; username?: string }) {
    return this.request<User>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('avatar', file);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    const storedToken = this.getStoredAccessToken();
    const response = await fetch(`${getApiBase()}/users/avatar`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {}),
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) throw new Error('Ошибка загрузки аватара');
    return response.json() as Promise<User>;
  }

  async removeAvatar() {
    return this.request<User>('/users/avatar', { method: 'DELETE' });
  }

  async searchMessages(query: string, chatId?: string) {
    const params = new URLSearchParams({ q: query });
    if (chatId) params.append('chatId', chatId);
    return this.request<Message[]>(`/users/messages/search?${params}`);
  }

  // \u0427\u0430\u0442\u044b
  async getChats() {
    return this.request<Chat[]>('/chats');
  }

  async getChat(id: string) {
    return this.request<Chat>(`/chats/${id}`);
  }

  async createPersonalChat(userId: string) {
    return this.request<Chat>('/chats/personal', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async createGroupChat(name: string, memberIds: string[]) {
    return this.request<Chat>('/chats/group', {
      method: 'POST',
      body: JSON.stringify({ name, memberIds }),
    });
  }

  async createChannel(name: string, username: string, description?: string, avatarUrl?: string) {
    return this.request<Chat>('/chats/channel', {
      method: 'POST',
      body: JSON.stringify({ name, username, description, avatar: avatarUrl }),
    });
  }

  async getChannelByUsername(username: string) {
    return this.request<Chat>(`/chats/join/${encodeURIComponent(username)}`);
  }

  async joinChannel(username: string) {
    return this.request<Chat>(`/chats/join/${encodeURIComponent(username)}`, {
      method: 'POST',
    });
  }

  // \u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f
  async getMessages(chatId: string, cursor?: string) {
    const params = cursor ? `?cursor=${cursor}` : '';
    return this.request<Message[]>(`/messages/chat/${chatId}${params}`);
  }

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('files', file);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300_000);
    const storedToken = this.getStoredAccessToken();
    const response = await fetch(`${getApiBase()}/messages/upload`, {
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

    // Handle response formats:
    // 1. Array: [{ fileId, url, ... }] (old format)
    // 2. Object: { files: [{ fileId, url, ... }] } (new format)
    // 3. Object: { fileId, url, ... } (single file)
    if (Array.isArray(result)) return result[0];
    if (result.files && Array.isArray(result.files)) return result.files[0];
    if (result.fileId || result.url) return result;

    console.error('[uploadFile] Unexpected response:', result);
    throw new Error('Неожиданный ответ сервера при загрузке');
  }

  // \u0413\u0440\u0443\u043f\u043f\u044b
  async updateGroup(chatId: string, data: { name?: string; description?: string }) {
    return this.request<Chat>(`/chats/${chatId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async uploadGroupAvatar(chatId: string, file: File) {
    const formData = new FormData();
    formData.append('avatar', file);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    const storedToken = this.getStoredAccessToken();
    const response = await fetch(`${getApiBase()}/chats/${chatId}/avatar`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {}),
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) throw new Error('\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u0430\u0432\u0430\u0442\u0430\u0440\u0430');
    return response.json() as Promise<Chat>;
  }

  async removeGroupAvatar(chatId: string) {
    return this.request<Chat>(`/chats/${chatId}/avatar`, { method: 'DELETE' });
  }

  async addGroupMembers(chatId: string, userIds: string[]) {
    return this.request<Chat>(`/chats/${chatId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    });
  }

  async removeGroupMember(chatId: string, userId: string) {
    return this.request<Chat>(`/chats/${chatId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  async clearChat(chatId: string) {
    return this.request<{ message: string }>(`/chats/${chatId}/clear`, { method: 'POST' });
  }

  async deleteChat(chatId: string) {
    return this.request<{ message: string }>(`/chats/${chatId}`, { method: 'DELETE' });
  }

  async togglePinChat(chatId: string) {
    return this.request<{ isPinned: boolean }>(`/chats/${chatId}/pin`, { method: 'POST' });
  }

  async getSharedMedia(chatId: string, type: 'media' | 'files' | 'links') {
    return this.request<Message[]>(`/messages/chat/${chatId}/shared?type=${type}`);
  }

  // Stories
  async getStories() {
    return this.request<StoryGroup[]>('/stories');
  }

  async createStory(data: { type: string; mediaUrl?: string; content?: string; bgColor?: string; audioUrl?: string }) {
    return this.request<{ id: string }>('/stories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async viewStory(storyId: string) {
    return this.request<{ message: string }>(`/stories/${storyId}/view`, { method: 'POST' });
  }

  async deleteStory(storyId: string) {
    return this.request<{ message: string }>(`/stories/${storyId}`, { method: 'DELETE' });
  }

  async getStoryViewers(storyId: string) {
    return this.request<Array<{ userId: string; username: string; displayName: string; avatar: string | null; viewedAt: string }>>(`/stories/${storyId}/viewers`);
  }

  // Favorites chat
  async getOrCreateFavorites() {
    return this.request<Chat>('/chats/favorites', { method: 'POST' });
  }

  // User settings
  async updateSettings(data: { hideStoryViews?: boolean }) {
    return this.request<User>('/users/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Friends
  async getFriends() {
    return this.request<FriendWithId[]>('/friends');
  }

  async getFriendRequests() {
    return this.request<FriendRequest[]>('/friends/requests');
  }

  async getOutgoingRequests() {
    return this.request<FriendRequest[]>('/friends/outgoing');
  }

  async getFriendshipStatus(userId: string) {
    return this.request<FriendshipStatus>(`/friends/status/${userId}`);
  }

  async sendFriendRequest(friendId: string) {
    return this.request<{ status: string }>('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ friendId }),
    });
  }

  async acceptFriendRequest(friendshipId: string) {
    return this.request<{ id: string }>(`/friends/${friendshipId}/accept`, { method: 'POST' });
  }

  async declineFriendRequest(friendshipId: string) {
    return this.request<{ success: boolean }>(`/friends/${friendshipId}/decline`, { method: 'POST' });
  }

  async removeFriend(friendshipId: string) {
    return this.request<{ success: boolean }>(`/friends/${friendshipId}`, { method: 'DELETE' });
  }

  // Call history
  async getCallHistory(limit?: number) {
    return this.request<Array<{
      id: string;
      callerId: string;
      calleeId: string;
      chatId: string | null;
      type: 'voice' | 'video' | 'group';
      status: 'completed' | 'missed' | 'declined' | 'failed';
      duration: number;
      createdAt: string;
      caller: UserBasic;
      callee: UserBasic | null;
    }>>(`/call-logs${limit ? `?limit=${limit}` : ''}`);
  }

  async createCallLog(data: {
    calleeId: string;
    chatId?: string;
    type?: 'voice' | 'video' | 'group';
    status?: 'completed' | 'missed' | 'declined' | 'failed';
    duration?: number;
  }) {
    return this.request<{
      id: string;
      callerId: string;
      calleeId: string;
      chatId: string | null;
      type: 'voice' | 'video' | 'group';
      status: 'completed' | 'missed' | 'declined' | 'failed';
      duration: number;
      createdAt: string;
      caller: UserBasic;
      callee: UserBasic | null;
    }>('/call-logs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Channel post views
  async markPostViewed(messageId: string) {
    return this.request<{ viewCount: number }>(`/messages/${messageId}/view`, {
      method: 'POST',
    });
  }

  // Channel analytics
  async getChannelAnalytics(channelId: string) {
    return this.request<{
      subscribers: number;
      totalViews: number;
      posts: number;
      recentPosts: Array<{
        id: string;
        content: string | null;
        createdAt: string;
        viewCount: number;
        reactions: number;
      }>;
      topPosts: Array<{
        id: string;
        content: string | null;
        createdAt: string;
        viewCount: number;
        reactions: number;
      }>;
    }>(`/chats/${channelId}/analytics`);
  }

  async saveWebPushSubscription(subscription: PushSubscription) {
    return this.request<{ success: boolean }>('/users/push-subscription', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
    });
  }

  async getUserChannels(userId: string) {
    return this.request<Chat[]>(`/users/${userId}/channels`);
  }

  async pinChannel(channelId: string) {
    return this.request<User>('/users/pin-channel', {
      method: 'PUT',
      body: JSON.stringify({ channelId }),
    });
  }

  async unpinChannel() {
    return this.request<User>('/users/pin-channel', {
      method: 'DELETE',
    });
  }

  async getNotificationSettings() {
    return this.request<{
      notifyAll: boolean;
      notifyMessages: boolean;
      notifyCalls: boolean;
      notifyFriends: boolean;
    }>('/users/notifications');
  }

  async updateNotificationSettings(settings: {
    notifyAll?: boolean;
    notifyMessages?: boolean;
    notifyCalls?: boolean;
    notifyFriends?: boolean;
  }) {
    return this.request('/users/notifications', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Devices
  async getDevices() {
    return this.request<Array<{
      id: string;
      deviceName: string;
      browser: string;
      os: string;
      ip: string;
      location: string;
      lastActive: string;
      isCurrent: boolean;
      addedAt: string;
    }>>('/devices');
  }

  async terminateDevice(deviceId: string) {
    return this.request<{ success: boolean }>(`/devices/${deviceId}`, {
      method: 'DELETE',
    });
  }

  async terminateAllDevices() {
    return this.request<{ success: boolean; count: number }>('/devices/terminate-all', {
      method: 'POST',
    });
  }

  // Threads
  async createThread(chatId: string, messageId: string, title?: string) {
    return this.request<{ id: string; messageId: string; chatId: string; title: string | null }>(`/threads/chat/${chatId}/thread`, {
      method: 'POST',
      body: JSON.stringify({ messageId, title }),
    });
  }

  async getThreads(chatId: string) {
    return this.request<Array<{ id: string; messageId: string; chatId: string; title: string | null; replyCount: number; message: Message }>>(`/threads/chat/${chatId}`);
  }

  async getThreadMessages(threadId: string) {
    return this.request<Message[]>(`/threads/thread/${threadId}/messages`);
  }

  async deleteThread(threadId: string) {
    return this.request<{ success: boolean }>(`/threads/thread/${threadId}`, {
      method: 'DELETE',
    });
  }

  // AI endpoints
  async post<T = any>(endpoint: string, data: any): Promise<T> {
    // Handle FormData separately - don't stringify or set Content-Type
    if (data instanceof FormData) {
      return this.request<T>(endpoint, {
        method: 'POST',
        body: data,
        headers: {
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
      });
    }
    
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
    });
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, { 
      method: 'PATCH', 
      body: data ? JSON.stringify(data) : undefined 
    });
  }

  async getAIContext(messageId: string, chatId: string, question?: string) {
    return this.request<{ text: string; context: string }>('/ai/context', {
      method: 'POST',
      body: JSON.stringify({ messageId, chatId, question }),
    });
  }

  async getAISuggestions(chatId: string, lastMessage: string) {
    return this.request<{ suggestions: string[] }>('/ai/suggestions', {
      method: 'POST',
      body: JSON.stringify({ chatId, lastMessage }),
    });
  }

  async getAIAutocomplete(text: string) {
    return this.request<{ completion: string }>('/ai/autocomplete', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async checkGrammar(text: string) {
    return this.request<{ corrected: string; hasChanges: boolean; original: string }>('/ai/grammar', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  // Folders
  async getFolders() {
    return this.request<Array<{
      id: string;
      name: string;
      icon: string;
      color: string;
      order: number;
      chats: Chat[];
    }>>('/folders');
  }

  async createFolder(data: { name: string; icon: string; color: string }) {
    return this.request<any>('/folders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFolder(id: string, data: { name?: string; icon?: string; color?: string; order?: number }) {
    return this.request<any>(`/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFolder(id: string) {
    return this.request<{ success: boolean }>(`/folders/${id}`, {
      method: 'DELETE',
    });
  }

  async addChatToFolder(folderId: string, chatId: string) {
    return this.request<any>(`/folders/${folderId}/chats`, {
      method: 'POST',
      body: JSON.stringify({ chatId }),
    });
  }

  async removeChatFromFolder(folderId: string, chatId: string) {
    return this.request<{ success: boolean }>(`/folders/${folderId}/chats/${chatId}`, {
      method: 'DELETE',
    });
  }

  async shareFolderLink(folderId: string, options?: { expiresIn?: number; maxUses?: number }) {
    return this.request<{
      token: string;
      url: string;
      expiresAt: string | null;
      maxUses: number | null;
      folder: {
        name: string;
        icon: string;
        color: string;
        chatsCount: number;
      };
    }>(`/folders/${folderId}/share`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  }

  async getSharedFolder(token: string) {
    return this.request<{
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
  }

  async addSharedFolder(token: string) {
    return this.request<{
      folder: any;
      addedChats: number;
      totalChats: number;
    }>(`/folders/shared/${token}/add`, {
      method: 'POST',
    });
  }

  // Video Notes
  async uploadVideoNote(formData: FormData) {
    const storedToken = this.getStoredAccessToken();
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
  }

  // Profile Music
  async uploadProfileMusic(file: File, duration: number) {
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('duration', duration.toString());

    const storedToken = this.getStoredAccessToken();
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
  }

  // Secret Chats
  async createSecretChat(userId: string, password?: string, selfDestructTimer?: number) {
    return this.request<{ chat: Chat; selfDestructTimer?: number }>('/secret-chats/create', {
      method: 'POST',
      body: JSON.stringify({ userId, password, selfDestructTimer }),
    });
  }

  async verifySecretChatPassword(chatId: string, password: string) {
    return this.request<{ success: boolean }>('/secret-chats/verify', {
      method: 'POST',
      body: JSON.stringify({ chatId, password }),
    });
  }

  async setMessageSelfDestruct(messageId: string, timer: number) {
    return this.request<{ message: Message }>('/secret-chats/message/self-destruct', {
      method: 'POST',
      body: JSON.stringify({ messageId, timer }),
    });
  }

  async deleteSecretChat(chatId: string) {
    return this.request<{ success: boolean }>(`/secret-chats/${chatId}`, {
      method: 'DELETE',
    });
  }

  async getSecretChatSettings(chatId: string) {
    return this.request<{ isSecret: boolean; isE2E: boolean; hasPassword: boolean }>(`/secret-chats/${chatId}/settings`);
  }

  async reportScreenshot(chatId: string) {
    return this.request<{ success: boolean; notified: number }>(`/secret-chats/${chatId}/screenshot`, {
      method: 'POST',
    });
  }

  // Premium - REMOVED (now using direct YooKassa payments)

  // User Settings
  async getUserSettings() {
    return this.request<{
      defaultChatBackground: string | null;
      settingsSyncEnabled: boolean;
      hideStoryViews: boolean;
      ringtone: any | null;
    }>('/users/settings');
  }

  async updateUserSettings(settings: {
    defaultChatBackground?: string | null;
    settingsSyncEnabled?: boolean;
    hideStoryViews?: boolean;
    ringtone?: any | null;
  }) {
    return this.request<User>('/users/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // ─── Stickers ────────────────────────────────────────────────────────

  async getStickerPacks(limit = 50, offset = 0, search = '') {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set('search', search);
    return this.request<{ packs: any[]; total: number; hasMore: boolean }>(`/stickers/packs?${params}`);
  }

  async getMyStickerPacks() {
    return this.request<any[]>('/stickers/packs/my');
  }

  async getPackStickers(packId: string, limit = 100, offset = 0) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return this.request<{ stickers: any[]; total: number; hasMore: boolean }>(`/stickers/packs/${packId}/stickers?${params}`);
  }

  async createStickerPack(data: { name: string; description?: string; isPublic?: boolean; isAnimated?: boolean }) {
    return this.request<any>('/stickers/packs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addStickerToPack(packId: string, data: { emoji: string; fileUrl: string; isAnimated?: boolean; width?: number; height?: number }) {
    return this.request<any>(`/stickers/packs/${packId}/stickers`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteStickerPack(packId: string) {
    return this.request<any>(`/stickers/packs/${packId}`, { method: 'DELETE' });
  }

  // ─── GIFs ─────────────────────────────────────────────────────────────

  async searchGifs(query: string, limit = 20) {
    return this.request<any[]>(`/stickers/gifs/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async getTrendingGifs(limit = 30) {
    return this.request<any[]>(`/stickers/gifs/trending?limit=${limit}`);
  }

  // ─── ICE Servers ──────────────────────────────────────────────────────

  async getIceServers() {
    return this.request<{ iceServers: RTCIceServer[] }>('/utilities/ice-servers');
  }

  // ─── CAPTCHA ──────────────────────────────────────────────────────────

  async generateCaptcha() {
    return this.request<{ id: string; question: string; expiresAt: string }>('/captcha/generate');
  }

  async verifyCaptcha(id: string, answer: string) {
    return this.request<{ valid: boolean }>('/captcha/verify', {
      method: 'POST',
      body: JSON.stringify({ id, answer }),
    });
  }

  // ─── AI Image Generation ──────────────────────────────────────────────
  async generateImage(prompt: string) {
    return this.request<{ url: string; provider: string }>('/ai/generate-image', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  async aiChat(messages: Array<{ role: string; content: string }>) {
    return this.request<{ text: string }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
  }

  // ─── Chat Summary ─────────────────────────────────────────────────────
  async getChatSummary(chatId: string, limit = 50) {
    return this.request<{ summary: string; messageCount: number }>('/ai/chat-summary', {
      method: 'POST',
      body: JSON.stringify({ chatId, limit }),
    });
  }

  // ─── Hidden Chats ─────────────────────────────────────────────────────
  async setHiddenChatPassword(chatId: string, password: string) {
    return this.request<{ success: boolean }>('/secret-chats/hidden/set-password', {
      method: 'POST',
      body: JSON.stringify({ chatId, password }),
    });
  }

  async verifyHiddenChatPassword(chatId: string, password: string) {
    return this.request<{ success: boolean }>('/secret-chats/hidden/verify-password', {
      method: 'POST',
      body: JSON.stringify({ chatId, password }),
    });
  }

  async removeHiddenChatPassword(chatId: string, password: string) {
    return this.request<{ success: boolean }>('/secret-chats/hidden/remove-password', {
      method: 'POST',
      body: JSON.stringify({ chatId, password }),
    });
  }

  // ─── Video Share (совместный просмотр) ───────────────────────────────
  // Синхронизация через socket, не через API

  // ─── Bookmarks ────────────────────────────────────────────────────────
  async getBookmarks() {
    return this.request<any[]>('/bookmarks');
  }
  async addBookmark(messageId: string, note?: string) {
    return this.request<any>('/bookmarks', { method: 'POST', body: JSON.stringify({ messageId, note }) });
  }
  async updateBookmark(id: string, note: string) {
    return this.request<any>(`/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify({ note }) });
  }
  async removeBookmark(messageId: string) {
    return this.request<any>(`/bookmarks/${messageId}`, { method: 'DELETE' });
  }

  // ─── Templates ────────────────────────────────────────────────────────
  async getTemplates() {
    return this.request<any[]>('/templates');
  }
  async createTemplate(name: string, content: string) {
    return this.request<any>('/templates', { method: 'POST', body: JSON.stringify({ name, content }) });
  }
  async updateTemplate(id: string, name: string, content: string) {
    return this.request<any>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify({ name, content }) });
  }
  async deleteTemplate(id: string) {
    return this.request<any>(`/templates/${id}`, { method: 'DELETE' });
  }

  // ─── Tasks ────────────────────────────────────────────────────────────
  async getTasks() {
    return this.request<any[]>('/tasks');
  }
  async getChatTasks(chatId: string) {
    return this.request<any[]>(`/tasks/chat/${chatId}`);
  }
  async createTask(data: { chatId: string; title: string; description?: string; priority?: string; deadline?: string; assigneeId?: string }) {
    return this.request<any>('/tasks', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateTask(id: string, data: any) {
    return this.request<any>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteTask(id: string) {
    return this.request<any>(`/tasks/${id}`, { method: 'DELETE' });
  }

  // ─── Calendar ─────────────────────────────────────────────────────────
  async getCalendarEvents() {
    return this.request<any[]>('/calendar');
  }
  async createCalendarEvent(data: { title: string; description?: string; location?: string; startAt: string; endAt?: string; chatId?: string; inviteeIds?: string[] }) {
    return this.request<any>('/calendar', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateCalendarEvent(id: string, data: any) {
    return this.request<any>(`/calendar/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteCalendarEvent(id: string) {
    return this.request<any>(`/calendar/${id}`, { method: 'DELETE' });
  }
  async respondToCalendarEvent(id: string, status: 'accepted' | 'declined' | 'maybe') {
    return this.request<any>(`/calendar/${id}/respond`, { method: 'POST', body: JSON.stringify({ status }) });
  }
  async inviteToCalendarEvent(id: string, inviteeIds: string[]) {
    return this.request<any>(`/calendar/${id}/invite`, { method: 'POST', body: JSON.stringify({ inviteeIds }) });
  }

  // ─── Badges ───────────────────────────────────────────────────────────
  async getBadges(userId: string) {
    return this.request<any>(`/badges/user/${userId}`);
  }
  async getMyBadges() {
    return this.request<any>('/badges/my');
  }
  async checkBadges() {
    return this.request<any>('/badges/check', { method: 'POST', body: '{}' });
  }

  // ─── Playlists ────────────────────────────────────────────────────────
  async getPlaylists() {
    return this.request<any>('/playlists');
  }
  async getChatPlaylists(chatId: string) {
    return this.request<any>(`/playlists/chat/${chatId}`);
  }

  // ─── Fake Password ────────────────────────────────────────────────────
  async getFakePasswordSettings() {
    return this.request<any>('/fake-password/settings');
  }
  async setFakePassword(data: { currentPassword: string; fakePassword?: string | null; fakeChats?: string[] }) {
    return this.request<any>('/fake-password/set', { method: 'POST', body: JSON.stringify(data) });
  }

  // ============================================
  // NEW FEATURES - STAGE 2
  // ============================================

  // Reactions
  async addReaction(messageId: string, emoji: string) {
    return this.request(`/reactions/${messageId}`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    });
  }

  async removeReaction(messageId: string, emoji: string) {
    return this.request(`/reactions/${messageId}/${encodeURIComponent(emoji)}`, {
      method: 'DELETE'
    });
  }

  async getReactions(messageId: string) {
    return this.request(`/reactions/${messageId}`);
  }

  // User Status
  async getUserStatus(userId: string) {
    return this.request(`/user-status/${userId}`);
  }

  async setUserStatus(text: string, emoji?: string, duration?: number) {
    return this.request('/user-status', {
      method: 'POST',
      body: JSON.stringify({ text, emoji, duration })
    });
  }

  async deleteUserStatus() {
    return this.request('/user-status', { method: 'DELETE' });
  }

  async getFriendStatuses() {
    return this.request('/user-status/friends/all');
  }

  // Polls
  async createPoll(chatId: string, question: string, options: string[], allowMultiple: boolean, isAnonymous: boolean, duration: number) {
    return this.request('/polls', {
      method: 'POST',
      body: JSON.stringify({ chatId, question, options, allowMultiple, isAnonymous, duration })
    });
  }

  async votePoll(pollId: string, optionIds: string[]) {
    return this.request(`/polls/${pollId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionIds })
    });
  }

  async removePollVote(pollId: string) {
    return this.request(`/polls/${pollId}/vote`, { method: 'DELETE' });
  }

  async getPollResults(pollId: string) {
    return this.request(`/polls/${pollId}/results`);
  }

  // Voice Rooms
  async getVoiceRooms() {
    return this.request('/voice-rooms');
  }

  async createVoiceRoom(name: string, description?: string, chatId?: string, maxUsers?: number, isPublic?: boolean, password?: string) {
    return this.request('/voice-rooms', {
      method: 'POST',
      body: JSON.stringify({ name, description, chatId, maxUsers, isPublic, password })
    });
  }

  async joinVoiceRoom(roomId: string, password?: string) {
    return this.request(`/voice-rooms/${roomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  }

  async leaveVoiceRoom(roomId: string) {
    return this.request(`/voice-rooms/${roomId}/leave`, { method: 'POST' });
  }

  async muteInVoiceRoom(roomId: string, isMuted: boolean) {
    return this.request(`/voice-rooms/${roomId}/mute`, {
      method: 'POST',
      body: JSON.stringify({ isMuted })
    });
  }

  // NFT Collections - REMOVED

  // Achievements
  async getAchievements() {
    return this.request('/achievements');
  }

  async getMyAchievements() {
    return this.request('/achievements/my');
  }

  async claimAchievementReward(achievementId: string) {
    return this.request(`/achievements/${achievementId}/claim`, { method: 'POST' });
  }

  // ─── Payments (YooKassa direct) ────────────────────────────────────

  async getPremiumStatus() {
    return this.request<{
      isPremium: boolean;
      premiumUntil: string | null;
    }>('/premium/status');
  }

  async createPayment(data: { type: 'premium' | 'premium_gift'; premiumMonths: number; giftToUserId?: string }) {
    return this.request<{
      paymentId: string;
      confirmationUrl: string;
      amount: number;
    }>('/premium/payment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPremiumPrices() {
    return this.request<{ prices: Record<number, number>; currency: string }>('/premium/prices');
  }

  async getPaymentHistory() {
    return this.request<any[]>('/premium/history');
  }
}

export const api = new ApiClient();
export default api;
