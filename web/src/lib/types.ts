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
  isVerified?: boolean;
  verifiedBadgeUrl?: string | null;
  verifiedBadgeType?: string | null;
  tagText?: string | null;
  tagColor?: string | null;
  tagStyle?: string | null;
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
  isVerified?: boolean;
  verifiedBadgeUrl?: string | null;
  verifiedBadgeType?: string | null;
  verifiedAt?: string | null;
  // Tag
  tagText?: string | null;
  tagColor?: string | null;
  tagStyle?: string | null;
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
  isVerified?: boolean;
  verifiedBadgeUrl?: string | null;
  verifiedBadgeType?: string | null;
  tagText?: string | null;
  tagColor?: string | null;
  tagStyle?: string | null;
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
