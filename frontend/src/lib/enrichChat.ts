import type { Chat, UserBasic } from './types';

/**
 * Fills in client-side display fields the backend doesn't compute:
 * - `otherMember` for personal/group chats (the non-current member)
 * - `name` fallback for personal chats (other member's display name)
 * Mutates a shallow copy — the original object is untouched.
 */
export function enrichChat(chat: Chat, currentUser: { id: string }): Chat {
  const clone: Chat = { ...chat, members: chat.members ?? [] };
  const other =
    clone.members.find(m => m.userId !== currentUser.id && m.user) ?? null;

  if (clone.type === 'personal' && other?.user) {
    const u: UserBasic = {
      id: other.user.id,
      username: other.user.username,
      displayName: other.user.displayName,
      avatar: other.user.avatar ?? null,
      ...(other.user.isOnline !== undefined ? { isOnline: other.user.isOnline } : {}),
    };
    clone.otherMember = u;
    if (!clone.name) clone.name = u.displayName;
  } else if (other?.user) {
    clone.otherMember = {
      id: other.user.id,
      username: other.user.username,
      displayName: other.user.displayName,
      avatar: other.user.avatar ?? null,
    };
  }

  return clone;
}
