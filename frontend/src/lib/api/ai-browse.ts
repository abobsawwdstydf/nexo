import { ApiClient } from './core';

declare module './core' {
  interface ApiClient {
    // AI Browsing
    startAIBrowse(query: string, chatId: string, context?: string): Promise<{ taskId: string; status: string }>;
    getAIBrowseStatus(taskId: string): Promise<{ id: string; status: string; result: string; sources: string; pagesViewed: number; error: string | null }>;
    getAIBrowseHistory(): Promise<{ items: Array<{ id: string; query: string; status: string; createdAt: string }> }>;
    // Translation
    translateMessage(messageId: string, text: string, targetLang: string): Promise<{ translated: string; sourceLang: string }>;
    // Moderation
    moderateContent(text: string): Promise<{ verdict: string; score: number; reason: string }>;
    getModerationConfig(chatId: string): Promise<any>;
    setModerationConfig(chatId: string, config: any): Promise<any>;
    // Auto-reply
    setAutoReplyConfig(config: { isEnabled: boolean; persona: string; maxReplies: number; replyDelay: number; activeChats: string[] }): Promise<any>;
    getAutoReplyConfig(): Promise<any>;
    // Voice command
    processVoiceCommand(audioBlob: Blob): Promise<{ command: string; response: string; executed: boolean }>;
    // Smart reminders
    createSmartReminder(data: { chatId: string; messageId?: string; remindAt: string; triggerText?: string }): Promise<any>;
    getSmartReminders(): Promise<any[]>;
    // Privacy audit
    runPrivacyAudit(): Promise<{ issues: Array<{ category: string; issue: string; severity: string; suggestion: string }> }>;
    getPrivacyAuditResults(): Promise<any[]>;
    // Scheduled messages
    createScheduledMessage(data: { chatId: string; content: string; type: string; scheduleAt: string; repeat?: string }): Promise<any>;
    getScheduledMessages(): Promise<any[]>;
    editScheduledMessage(id: string, data: any): Promise<any>;
    cancelScheduledMessage(id: string): Promise<any>;
    // Chat themes
    getChatTheme(chatId: string): Promise<any>;
    setChatTheme(chatId: string, theme: any): Promise<any>;
    deleteChatTheme(chatId: string): Promise<any>;
    // Kanban
    createKanbanBoard(data: { name: string; chatId: string }): Promise<any>;
    getKanbanBoards(): Promise<any[]>;
    getKanbanBoard(boardId: string): Promise<any>;
    createKanbanTask(boardId: string, data: any): Promise<any>;
    updateKanbanTask(taskId: string, data: any): Promise<any>;
    deleteKanbanTask(taskId: string): Promise<any>;
    reorderKanbanBoard(boardId: string, data: any): Promise<any>;
    // Bookmarks
    createBookmark(data: { messageId: string; note?: string; tags?: string }): Promise<any>;
    getBookmarks(): Promise<any[]>;
    updateBookmark(id: string, data: any): Promise<any>;
    deleteBookmark(id: string): Promise<any>;
    // Calendar events
    createCalendarEvent(data: any): Promise<any>;
    getCalendarEvents(): Promise<any[]>;
    updateCalendarEvent(id: string, data: any): Promise<any>;
    deleteCalendarEvent(id: string): Promise<any>;
    rsvpEvent(id: string, status: string): Promise<any>;
    // Photo albums
    createPhotoAlbum(data: { name: string; description?: string }): Promise<any>;
    getPhotoAlbums(): Promise<any[]>;
    getPhotoAlbum(id: string): Promise<any>;
    updatePhotoAlbum(id: string, data: any): Promise<any>;
    deletePhotoAlbum(id: string): Promise<any>;
    addPhotoToAlbum(albumId: string, data: any): Promise<any>;
    // Screen recordings
    uploadScreenRecording(formData: FormData): Promise<any>;
    getScreenRecordings(): Promise<any[]>;
    // Vault
    vaultUpload(file: File): Promise<any>;
    vaultList(): Promise<any>;
    vaultDownload(fileId: string): Promise<any>;
    vaultDelete(fileId: string): Promise<any>;
    vaultStats(): Promise<any>;
    // Incognito chats
    createIncognitoChat(data?: { isEncrypted?: boolean; maxMembers?: number; expiresIn?: number }): Promise<any>;
    joinIncognitoChat(inviteCode: string): Promise<any>;
    getIncognitoChats(): Promise<any[]>;
    leaveIncognitoChat(id: string): Promise<any>;
    // Devices
    getDevices(): Promise<any[]>;
    revokeDevice(id: string): Promise<any>;
    deviceCheckIn(): Promise<any>;
    // Dead man's switch
    createDeadManSwitch(data: { inactivityDays: number; messageTemplate: string; recipientIds: string[] }): Promise<any>;
    getDeadManSwitch(): Promise<any>;
    updateDeadManSwitch(data: any): Promise<any>;
    deleteDeadManSwitch(): Promise<any>;
    deadManSwitchCheckIn(): Promise<any>;
    // Whiteboard
    createWhiteboard(data: { chatId: string; name: string }): Promise<any>;
    getWhiteboard(id: string): Promise<any>;
    updateWhiteboard(id: string, data: any): Promise<any>;
    applyWhiteboardEdit(id: string, data: any): Promise<any>;
    deleteWhiteboard(id: string): Promise<any>;
    // Voice room activities
    startVoiceRoomActivity(roomId: string, data: { type: string; url?: string; title?: string }): Promise<any>;
    stopVoiceRoomActivity(roomId: string): Promise<any>;
    getVoiceRoomActivity(roomId: string): Promise<any>;
  }
}

export function installAIBrowse(api: ApiClient): void {
  // AI Browsing
  api.startAIBrowse = async (query, chatId, context) => {
    return api.request('/ai/browse', { method: 'POST', body: JSON.stringify({ query, chatId, context }) });
  };
  api.getAIBrowseStatus = async (taskId) => {
    return api.request(`/ai/browse/status/${taskId}`);
  };
  api.getAIBrowseHistory = async () => {
    return api.request('/ai/browse/history');
  };
  // Translation
  api.translateMessage = async (messageId, text, targetLang) => {
    return api.request('/ai/translate', { method: 'POST', body: JSON.stringify({ messageId, text, targetLang }) });
  };
  // Moderation
  api.moderateContent = async (text) => {
    return api.request('/ai/moderate', { method: 'POST', body: JSON.stringify({ text }) });
  };
  api.getModerationConfig = async (chatId) => {
    return api.request(`/ai/moderation/config/${chatId}`);
  };
  api.setModerationConfig = async (chatId, config) => {
    return api.request(`/ai/moderation/config/${chatId}`, { method: 'PUT', body: JSON.stringify(config) });
  };
  // Auto-reply
  api.setAutoReplyConfig = async (config) => {
    return api.request('/ai/auto-reply/config', { method: 'POST', body: JSON.stringify(config) });
  };
  api.getAutoReplyConfig = async () => {
    return api.request('/ai/auto-reply/config');
  };
  // Voice command
  api.processVoiceCommand = async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice.webm');
    return api.request('/ai/voice-command', { method: 'POST', body: formData });
  };
  // Smart reminders
  api.createSmartReminder = async (data) => {
    return api.request('/ai/smart-reminder', { method: 'POST', body: JSON.stringify(data) });
  };
  api.getSmartReminders = async () => {
    return api.request('/ai/smart-reminders');
  };
  // Privacy audit
  api.runPrivacyAudit = async () => {
    return api.request('/ai/privacy-audit', { method: 'POST' });
  };
  api.getPrivacyAuditResults = async () => {
    return api.request('/ai/privacy-audit');
  };
  // Scheduled messages
  api.createScheduledMessage = async (data) => {
    return api.request('/scheduled-messages', { method: 'POST', body: JSON.stringify(data) });
  };
  api.getScheduledMessages = async () => {
    return api.request('/scheduled-messages');
  };
  api.editScheduledMessage = async (id, data) => {
    return api.request(`/scheduled-messages/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  };
  api.cancelScheduledMessage = async (id) => {
    return api.request(`/scheduled-messages/${id}`, { method: 'DELETE' });
  };
  // Chat themes
  api.getChatTheme = async (chatId) => {
    return api.request(`/chats/${chatId}/theme`);
  };
  api.setChatTheme = async (chatId, theme) => {
    return api.request(`/chats/${chatId}/theme`, { method: 'POST', body: JSON.stringify(theme) });
  };
  api.deleteChatTheme = async (chatId) => {
    return api.request(`/chats/${chatId}/theme`, { method: 'DELETE' });
  };
  // Kanban
  api.createKanbanBoard = async (data) => {
    return api.request('/kanban', { method: 'POST', body: JSON.stringify(data) });
  };
  api.getKanbanBoards = async () => {
    return api.request('/kanban');
  };
  api.getKanbanBoard = async (boardId) => {
    return api.request(`/kanban/${boardId}`);
  };
  api.createKanbanTask = async (boardId, data) => {
    return api.request(`/kanban/${boardId}/tasks`, { method: 'POST', body: JSON.stringify(data) });
  };
  api.updateKanbanTask = async (taskId, data) => {
    return api.request(`/kanban/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) });
  };
  api.deleteKanbanTask = async (taskId) => {
    return api.request(`/kanban/tasks/${taskId}`, { method: 'DELETE' });
  };
  api.reorderKanbanBoard = async (boardId, data) => {
    return api.request(`/kanban/${boardId}/reorder`, { method: 'PUT', body: JSON.stringify(data) });
  };
  // Bookmarks
  api.createBookmark = async (data) => {
    return api.request('/bookmarks', { method: 'POST', body: JSON.stringify(data) });
  };
  api.getBookmarks = async () => {
    return api.request('/bookmarks');
  };
  api.updateBookmark = async (id, data) => {
    return api.request(`/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  };
  api.deleteBookmark = async (id) => {
    return api.request(`/bookmarks/${id}`, { method: 'DELETE' });
  };
  // Calendar
  api.createCalendarEvent = async (data) => {
    return api.request('/calendar/events', { method: 'POST', body: JSON.stringify(data) });
  };
  api.getCalendarEvents = async () => {
    return api.request('/calendar/events');
  };
  api.updateCalendarEvent = async (id, data) => {
    return api.request(`/calendar/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  };
  api.deleteCalendarEvent = async (id) => {
    return api.request(`/calendar/events/${id}`, { method: 'DELETE' });
  };
  api.rsvpEvent = async (id, status) => {
    return api.request(`/calendar/events/${id}/rsvp`, { method: 'POST', body: JSON.stringify({ status }) });
  };
  // Photo albums
  api.createPhotoAlbum = async (data) => {
    return api.request('/albums', { method: 'POST', body: JSON.stringify(data) });
  };
  api.getPhotoAlbums = async () => {
    return api.request('/albums');
  };
  api.getPhotoAlbum = async (id) => {
    return api.request(`/albums/${id}`);
  };
  api.updatePhotoAlbum = async (id, data) => {
    return api.request(`/albums/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  };
  api.deletePhotoAlbum = async (id) => {
    return api.request(`/albums/${id}`, { method: 'DELETE' });
  };
  api.addPhotoToAlbum = async (albumId, data) => {
    return api.request(`/albums/${albumId}/photos`, { method: 'POST', body: JSON.stringify(data) });
  };
  // Screen recordings
  api.uploadScreenRecording = async (formData) => {
    return api.request('/screen-recordings', { method: 'POST', body: formData });
  };
  api.getScreenRecordings = async () => {
    return api.request('/screen-recordings');
  };
  // Vault
  api.vaultUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.request('/vault/upload', { method: 'POST', body: formData });
  };
  api.vaultList = async () => {
    return api.request('/vault/files');
  };
  api.vaultDownload = async (fileId) => {
    return api.request(`/vault/files/${fileId}/download`);
  };
  api.vaultDelete = async (fileId) => {
    return api.request(`/vault/files/${fileId}`, { method: 'DELETE' });
  };
  api.vaultStats = async () => {
    return api.request('/vault/stats');
  };
  // Incognito
  api.createIncognitoChat = async (data) => {
    return api.request('/incognito/create', { method: 'POST', body: JSON.stringify(data || {}) });
  };
  api.joinIncognitoChat = async (inviteCode) => {
    return api.request('/incognito/join', { method: 'POST', body: JSON.stringify({ inviteCode }) });
  };
  api.getIncognitoChats = async () => {
    return api.request('/incognito/chats');
  };
  api.leaveIncognitoChat = async (id) => {
    return api.request(`/incognito/${id}`, { method: 'DELETE' });
  };
  // Devices
  api.getDevices = async () => {
    return api.request('/devices');
  };
  api.revokeDevice = async (id) => {
    return api.request(`/devices/${id}`, { method: 'DELETE' });
  };
  api.deviceCheckIn = async () => {
    return api.request('/devices/check-in', { method: 'POST' });
  };
  // Dead man's switch
  api.createDeadManSwitch = async (data) => {
    return api.request('/dead-man-switch', { method: 'POST', body: JSON.stringify(data) });
  };
  api.getDeadManSwitch = async () => {
    return api.request('/dead-man-switch');
  };
  api.updateDeadManSwitch = async (data) => {
    return api.request('/dead-man-switch', { method: 'PUT', body: JSON.stringify(data) });
  };
  api.deleteDeadManSwitch = async () => {
    return api.request('/dead-man-switch', { method: 'DELETE' });
  };
  api.deadManSwitchCheckIn = async () => {
    return api.request('/dead-man-switch/check-in', { method: 'POST' });
  };
  // Whiteboard
  api.createWhiteboard = async (data) => {
    return api.request('/whiteboard', { method: 'POST', body: JSON.stringify(data) });
  };
  api.getWhiteboard = async (id) => {
    return api.request(`/whiteboard/${id}`);
  };
  api.updateWhiteboard = async (id, data) => {
    return api.request(`/whiteboard/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  };
  api.applyWhiteboardEdit = async (id, data) => {
    return api.request(`/whiteboard/${id}/edit`, { method: 'POST', body: JSON.stringify(data) });
  };
  api.deleteWhiteboard = async (id) => {
    return api.request(`/whiteboard/${id}`, { method: 'DELETE' });
  };
  // Voice room activities
  api.startVoiceRoomActivity = async (roomId, data) => {
    return api.request(`/voice-rooms/${roomId}/activity`, { method: 'POST', body: JSON.stringify(data) });
  };
  api.stopVoiceRoomActivity = async (roomId) => {
    return api.request(`/voice-rooms/${roomId}/activity`, { method: 'DELETE' });
  };
  api.getVoiceRoomActivity = async (roomId) => {
    return api.request(`/voice-rooms/${roomId}/activity`);
  };
}
