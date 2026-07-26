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
}

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
  // Secret chat
  isSecret?: boolean;
  isE2E?: boolean;
  secretPassword?: string | null;
  // Archive
  isArchived?: boolean;
  // Other member (for private chats)
  otherMember?: UserBasic | null;
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
