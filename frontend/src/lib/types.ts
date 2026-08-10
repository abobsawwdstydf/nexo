// ─── User types ────────────────────────────────────────────────────────

export interface UserBasic {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  isVerified?: boolean;
  verifiedBadgeUrl?: string | null;
  verifiedBadgeType?: string | null;
  tagText?: string | null;
  tagColor?: string | null;
  tagStyle?: string | null;
}

// A GIF result returned by the GIF search/trending endpoints.
export interface GifItem {
  id: string;
  url: string;
  originalUrl?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
}

export interface UserPresence extends UserBasic {
  isOnline: boolean;
  lastSeen: string;
}

export interface Channel {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  description: string | null;
  members: Array<{ userId: string }>;
}

export interface User extends UserPresence {
  email?: string;
  bio: string | null;
  birthday?: string;
  createdAt: string;
  hideStoryViews?: boolean;
  pushSubscription?: string | null;
  pinnedChannelId?: string | null;
  notifyAll?: boolean;
  notifyMessages?: boolean;
  notifyCalls?: boolean;
  notifyFriends?: boolean;
  pinnedChannel?: Channel | null;
  // Verification
  verifiedAt?: string | null;
  // Premium
  isPremium?: boolean;
  premiumBadgeUrl?: string | null;
  premiumUntil?: string | null;
  premiumType?: string | null;
  beavers?: number;
  totalSpent?: number;
  totalEarned?: number;
  subscribersCount?: number;
  postsCount?: number;
  profileMusic?: string | null;
  isAdmin?: boolean;
}

// ─── Premium types ─────────────────────────────────────────────────────

export interface PremiumStatus {
  isPremium: boolean;
  premiumUntil: string | null;
  premiumType: string | null;
  beavers: number;
}

export interface PremiumPrices {
  '1month': number;
  '3months': number;
  '6months': number;
  '12months': number;
}

export interface PremiumPurchase {
  id: string;
  userId: string;
  months: number;
  beavers: number;
  purchasedAt: string;
  expiresAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'purchase' | 'admin_add' | 'admin_remove' | 'premium' | 'gift' | 'refund';
  description: string | null;
  relatedId: string | null;
  createdAt: string;
}

export interface Balance {
  beavers: number;
  totalSpent: number;
  totalEarned: number;
}

// ─── Chat types ────────────────────────────────────────────────────────

export interface ChatMember {
  id: string;
  userId: string;
  role: string;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  clearedAt?: string | null;
  user: UserPresence;
}

export interface MediaItem {
  id: string;
  type: string;
  url: string;
  filename: string | null;
  thumbnail: string | null;
  size: number | null;
  duration: number | null;
  width?: number | null;
  height?: number | null;
}

/** Result of POST /api/upload — a single media item (fields may vary by endpoint). */
export interface UploadedMedia {
  id?: string;
  fileId?: string;
  type?: string;
  url?: string;
  filename?: string | null;
  thumbnail?: string | null;
  size?: number | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
}

/** A username alias bound to a user account. */
export interface UserAlias {
  subjectType: string;
  subjectId: string;
  alias: string;
  isValid: boolean;
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  user: { id: string; username: string; displayName: string };
}

export interface MessageSender {
  id: string;
  username: string;
  displayName: string;
  avatar?: string | null;
  isVerified?: boolean;
  verifiedBadgeUrl?: string | null;
  verifiedBadgeType?: string | null;
  tagText?: string | null;
  tagColor?: string | null;
  tagStyle?: string | null;
  isBot?: boolean;
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: { url: string };
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface ReplyKeyboardMarkup {
  keyboard: Array<Array<{ text: string }>>;
  one_time_keyboard?: boolean;
  resize_keyboard?: boolean;
}

export type ReplyMarkup = InlineKeyboardMarkup | ReplyKeyboardMarkup | { remove_keyboard?: boolean } | { force_reply?: boolean };

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string | null;
  type: string;
  replyToId: string | null;
  quote?: string | null;
  forwardedFromId?: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  selfDestructTimer?: number;
  selfDestructAt?: string | null;
  scheduledAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  threadId?: string | null;
  sender: MessageSender;
  replyTo?: {
    id: string;
    content: string | null;
    quote?: string | null;
    sender: { id: string; username: string; displayName: string };
  } | null;
  forwardedFrom?: UserBasic | null;
  media: MediaItem[];
  reactions: Reaction[];
  readBy: Array<{ userId: string }>;
  viewCount?: number;
  // Call fields
  callType?: 'voice' | 'video';
  callStatus?: 'completed' | 'missed' | 'declined' | 'failed';
  callDuration?: number;
  // Video note fields
  videoUrl?: string | null;
  duration?: number | null;
  thumbnail?: string | null;
  // E2E encryption fields
  isEncrypted?: boolean;
  encryptedContent?: string;
  encryptedIv?: string;
  // Bot API inline keyboard
  replyMarkup?: ReplyMarkup | null;
  // Optimistic send state (client-side only)
  _isSending?: boolean;
  _isFailed?: boolean;
}

export interface Chat {
  id: string;
  type: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  description: string | null;
  createdAt: string;
  members: ChatMember[];
  messages: Message[];
  unreadCount: number;
  pinnedMessages?: Array<{
    id: string;
    message: Message;
  }>;
  // Verification for channels/groups
  isVerified?: boolean;
  verifiedBadgeUrl?: string | null;
  verifiedBadgeType?: string | null;
  verifiedAt?: string | null;
  // Channels
  subscribersCount?: number;
  isPremium?: boolean;
  // Comments chats (linked to a channel post)
  linkedChatId?: string;
  linkedMessageId?: string;
  // Secret chat
  isSecret?: boolean;
  isE2E?: boolean;
  secretPassword?: string | null;
  // Archive
  isArchived?: boolean;
  // Other member (for private chats)
  otherMember?: (UserBasic & { isOnline?: boolean }) | null;
  subscriptionPrice?: number | null;
  // Last message
  lastMessage?: Message | null;
}

// ─── Socket event types ────────────────────────────────────────────────

export interface TypingUser {
  chatId: string;
  userId: string;
}

export interface CallInfo {
  from: string;
  offer: RTCSessionDescriptionInit;
  callType: 'voice' | 'video';
  chatId: string;
  callerInfo?: UserBasic | null;
}

// ─── Story types ───────────────────────────────────────────────────────

export interface Story {
  id: string;
  type: string;
  mediaUrl: string | null;
  content: string | null;
  bgColor: string | null;
  createdAt: string;
  expiresAt: string;
  viewCount: number;
  viewed: boolean;
}

export interface StoryViewer {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  viewedAt: string;
}

export interface StoryGroup {
  user: UserBasic;
  stories: Story[];
  hasUnviewed: boolean;
}

// ─── Utility types ─────────────────────────────────────────────────

// ─── Friend types ──────────────────────────────────────────────────

export interface FriendRequest {
  id: string;
  sender: UserBasic;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface FriendshipStatus {
  status: 'none' | 'pending' | 'accepted' | 'blocked' | 'declined' | 'self';
  friendshipId?: string | null;
  direction?: 'incoming' | 'outgoing';
}

export interface FriendWithId extends UserPresence {
  friendshipId: string;
}

export interface CallLog {
  id: string;
  callerId: string;
  calleeId: string | null;
  chatId: string | null;
  type: 'voice' | 'video' | 'group';
  status: 'completed' | 'missed' | 'declined' | 'failed';
  duration: number;
  createdAt: string;
  caller: UserBasic;
  callee: UserBasic | null;
}

// ─── Utility types ─────────────────────────────────────────────────────

/** Audio file extensions recognized by the app. */
export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma'] as const;

/** Max file size for uploads (25GB). */
export const MAX_FILE_SIZE = 25 * 1024 * 1024 * 1024; // 25 GB

/** Max avatar size (5MB). */
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

// ─── Feature 1: Smart Folders ─────────────────────────────────────────

export interface SmartFolderRule {
  type: 'unread' | 'mentions' | 'media' | 'keyword' | 'chat_type' | 'muted' | 'archived' | 'pinned';
  value?: string;
}

export interface SmartFolder {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  order: number;
  rules: string; // JSON string of SmartFolderRule[]
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Feature 2: Shared Notes ──────────────────────────────────────────

export interface ChatNote {
  id: string;
  chatId: string;
  userId: string;
  content: string;
  pinned: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  user?: UserBasic;
}

// ─── Feature 3: Link Collector ────────────────────────────────────────

export interface CollectedLink {
  id: string;
  chatId: string;
  messageId: string;
  userId: string;
  url: string;
  title: string;
  description: string;
  imageUrl: string;
  domain: string;
  category: 'link' | 'image' | 'video' | 'document' | 'other';
  isSaved: boolean;
  createdAt: string;
  chat?: Chat;
  user?: UserBasic;
}

// ─── Feature 4: Voice Rooms ───────────────────────────────────────────

export interface VoiceRoomParticipant {
  id: string;
  roomId: string;
  userId: string;
  isMuted: boolean;
  isDeaf: boolean;
  isSpeaking: boolean;
  joinedAt: string;
  user?: UserPresence;
}

export interface VoiceRoom {
  id: string;
  chatId: string;
  name: string;
  description: string;
  creatorId: string;
  isActive: boolean;
  maxUsers: number;
  createdAt: string;
  updatedAt: string;
  creator?: UserBasic;
  participants?: VoiceRoomParticipant[];
}

// ─── Feature 5: Anonymous Chats ───────────────────────────────────────

export interface AnonymousChat {
  id: string;
  user1Id: string;
  user2Id: string;
  user1Alias: string;
  user2Alias: string;
  isConnected: boolean;
  topic: string;
  startedAt: string;
  endedAt: string | null;
  rating: number;
  messageCount: number;
}

// ─── Feature 6: Gamification ──────────────────────────────────────────

export interface UserXP {
  id: string;
  userId: string;
  totalXP: number;
  level: number;
  streak: number;
  lastActive: string;
  createdAt: string;
  updatedAt: string;
}

export interface Achievement {
  id: string;
  name: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  requiredXP: number;
  isHidden: boolean;
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  progress: number;
  unlockedAt: string | null;
  achievement?: Achievement;
}

// ─── Feature 8: AI Commands ───────────────────────────────────────────

export interface AICommandLog {
  id: string;
  userId: string;
  chatId: string;
  messageId: string;
  command: string;
  prompt: string;
  response: string;
  model: string;
  tokensUsed: number;
  duration: number;
  createdAt: string;
}

// ─── Feature 10: Webhooks ─────────────────────────────────────────────

export interface WebhookConfig {
  id: string;
  userId: string;
  url: string;
  events: string; // JSON array
  secret: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── AI Browsing ───────────────────────────────────────────────────────

export interface AIBrowseTask {
  id: string;
  userId: string;
  chatId: string;
  query: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result: string;
  sources: string;
  pagesViewed: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Kanban ───────────────────────────────────────────────────────────

export interface KanbanBoard {
  id: string;
  chatId: string;
  name: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  columns?: KanbanColumn[];
}

export interface KanbanColumn {
  id: string;
  boardId: string;
  name: string;
  order: number;
  color: string;
  tasks?: KanbanTask[];
}

export interface KanbanTask {
  id: string;
  columnId: string;
  boardId: string;
  title: string;
  description: string;
  assigneeId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: string | null;
  order: number;
  labels: string;
  createdAt: string;
  updatedAt: string;
  assignee?: UserBasic;
}

// ─── Chat Theme ───────────────────────────────────────────────────────

export interface ChatTheme {
  id: string;
  chatId: string;
  backgroundImage: string;
  backgroundColor: string;
  bubbleColor: string;
  bubbleTextColor: string;
  accentColor: string;
}

// ─── Bookmarks ────────────────────────────────────────────────────────

export interface MessageBookmark {
  id: string;
  userId: string;
  messageId: string;
  chatId: string;
  note: string;
  tags: string;
  createdAt: string;
  message?: Message;
  chat?: Chat;
}

// ─── Scheduled Messages ───────────────────────────────────────────────

export interface ScheduledMessage {
  id: string;
  userId: string;
  chatId: string;
  content: string;
  type: string;
  mediaUrl: string;
  scheduleAt: string;
  repeat: string;
  isSent: boolean;
  createdAt: string;
}

// ─── Photo Album ──────────────────────────────────────────────────────

export interface PhotoAlbum {
  id: string;
  userId: string;
  name: string;
  description: string;
  coverUrl: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  photos?: PhotoAlbumItem[];
}

export interface PhotoAlbumItem {
  id: string;
  albumId: string;
  mediaId: string;
  caption: string;
  order: number;
  createdAt: string;
}

// ─── Calendar Event ───────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  userId: string;
  chatId: string;
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  reminder: number;
  recurrence: string;
  createdAt: string;
}

// ─── Screen Recording ─────────────────────────────────────────────────

export interface ScreenRecording {
  id: string;
  userId: string;
  chatId: string;
  url: string;
  duration: number;
  size: number;
  thumbnail: string;
  createdAt: string;
}

// ─── Vault File ───────────────────────────────────────────────────────

export interface VaultFile {
  id: string;
  userId: string;
  filename: string;
  encryptedUrl: string;
  size: number;
  mimeType: string;
  checksum: string;
  createdAt: string;
}

// ─── Incognito Chat ───────────────────────────────────────────────────

export interface IncognitoChat {
  id: string;
  creatorId: string;
  inviteCode: string;
  isEncrypted: boolean;
  maxMembers: number;
  messageCount: number;
  expiresAt: string | null;
  createdAt: string;
}

// ─── Device Session ───────────────────────────────────────────────────

export interface DeviceSession {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  platform: string;
  browser: string;
  ipAddress: string;
  location: string;
  isActive: boolean;
  lastActive: string;
  createdAt: string;
}

// ─── Dead Man's Switch ────────────────────────────────────────────────

export interface DeadManSwitch {
  id: string;
  userId: string;
  isEnabled: boolean;
  inactivityDays: number;
  lastCheckIn: string;
  messageTemplate: string;
  recipientIds: string;
  isTriggered: boolean;
  triggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Whiteboard ───────────────────────────────────────────────────────

export interface Whiteboard {
  id: string;
  chatId: string;
  name: string;
  creatorId: string;
  data: string;
  version: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Smart Reminder ───────────────────────────────────────────────────

export interface SmartReminder {
  id: string;
  userId: string;
  chatId: string;
  messageId: string;
  triggerText: string;
  remindAt: string;
  isCompleted: boolean;
  createdBy: string;
  createdAt: string;
}

// ─── Privacy Audit ────────────────────────────────────────────────────

export interface PrivacyAuditIssue {
  id: string;
  userId: string;
  category: string;
  issue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
  isFixed: boolean;
  createdAt: string;
}

// ─── Voice Room Activity ──────────────────────────────────────────────

export interface VoiceRoomActivity {
  id: string;
  roomId: string;
  type: string;
  url: string;
  title: string;
  isActive: boolean;
  startedBy: string;
}
