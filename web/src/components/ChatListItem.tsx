import { useState, useRef, useEffect, memo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { Check, CheckCheck, Pin, Trash2, Bookmark, Archive, ArchiveRestore } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useLang } from '../lib/i18n';
import { stripMarkdown } from '../lib/utils';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import ConfirmModal from './ConfirmModal';
import Avatar from './Avatar';
import UserTag from './UserTag';
import HiddenChatModal from './HiddenChatModal';
import VerifiedBadge from './VerifiedBadge';
import type { Chat } from '../lib/types';

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onClick?: () => void;
}

function ChatListItem({ chat, isActive, onClick }: ChatListItemProps) {
  const { user } = useAuthStore();
  const { setActiveChat, loadMessages, typingUsers, drafts, loadChats, archiveChat, unarchiveChat, archivedChatIds } = useChatStore();
  const { t, lang } = useLang();

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const ctxRef = useRef<HTMLDivElement>(null);

  const myMember = chat.members.find((m) => m.user.id === user?.id);
  const isPinned = myMember?.isPinned ?? false;
  const isArchived = archivedChatIds.has(chat.id);

  const draft = drafts[chat.id] || '';

  const otherMember = chat.members.find((m) => m.user.id !== user?.id);
  const isFavorites = chat.type === 'favorites';
  const isDeletedAccount = chat.type === 'personal' && otherMember && !otherMember.user.username;
  const chatName = isFavorites
    ? t('favorites')
    : chat.type === 'personal'
      ? isDeletedAccount ? '🗑 Удаленный аккаунт' : (otherMember?.user.displayName || otherMember?.user.username || t('chat'))
      : chat.name || t('group');

  const chatAvatar = isFavorites
    ? null
    : chat.type === 'personal'
      ? otherMember?.user.avatar
      : chat.avatar;

  const isOnline = chat.type === 'personal' && otherMember?.user.isOnline;

  // Tag for personal chats (from the other user)
  const otherUserTag = chat.type === 'personal' ? otherMember?.user : null;

  // Verification: for personal chats use other user's verification, for groups/channels use chat's verification
  const isVerified = chat.type === 'personal' ? otherMember?.user.isVerified : chat.isVerified;
  const verifiedBadgeUrl = chat.type === 'personal' ? otherMember?.user.verifiedBadgeUrl : chat.verifiedBadgeUrl;
  const verifiedBadgeType = chat.type === 'personal' ? otherMember?.user.verifiedBadgeType : chat.verifiedBadgeType;

  // Check if someone is typing in this chat
  const typingInChat = typingUsers.filter((t) => t.chatId === chat.id && t.userId !== user?.id);
  const isTyping = typingInChat.length > 0;

  const lastMessage = chat.messages?.[0];
  const lastMessageText = lastMessage
    ? lastMessage.isDeleted
      ? t('messageDeleted')
      : lastMessage.type === 'voice'
        ? t('voice')
        : lastMessage.type === 'file' || lastMessage.type === 'image' || lastMessage.type === 'video'
          ? lastMessage.media?.[0]?.type === 'image'
            ? t('photo')
            : lastMessage.media?.[0]?.type === 'video'
              ? t('video')
              : t('file')
          : lastMessage.content || ''
    : '';

  const previewText = stripMarkdown(lastMessageText);

  const isMine = lastMessage?.senderId === user?.id;

  // Галочки прочтения
  const isRead = lastMessage?.readBy?.some((r) => r.userId !== user?.id);

  const timeStr = lastMessage
    ? formatDistanceToNow(new Date(lastMessage.createdAt), { addSuffix: false, locale: lang === 'ru' ? ru : enUS })
    : '';

  const handleClick = () => {
    // Если чат скрытый (с паролем) и ещё не разблокирован — показываем модал
    if (chat.isSecret && chat.secretPassword && !isUnlocked) {
      setShowUnlockModal(true);
      return;
    }
    if (onClick) {
      onClick();
    } else {
      setActiveChat(chat.id);
      loadMessages(chat.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ctxMenu]);

  const handlePin = async () => {
    setCtxMenu(null);
    try {
      await api.togglePinChat(chat.id);
      loadChats();
    } catch (e) { console.error(e); }
  };

  const handleArchive = () => {
    setCtxMenu(null);
    if (isArchived) {
      unarchiveChat(chat.id);
    } else {
      archiveChat(chat.id);
      if (isActive) setActiveChat(null);
    }
  };

  const handleDelete = async () => {
    setCtxMenu(null);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      await api.deleteChat(chat.id);
      useChatStore.getState().removeChat(chat.id);
    } catch (e) { console.error(e); }
  };

  const initials = chatName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative">
      <button
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('chatId', chat.id);
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mx-1.5 transition-all duration-150 text-left',
          isActive
            ? 'bg-nexo-500/12 border border-nexo-500/25'
            : 'border border-transparent hover:bg-white/[0.04]'
        )}
      >
        {/* Аватар */}
        <div className="relative flex-shrink-0">
          {isFavorites ? (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Bookmark size={18} className="text-white" />
            </div>
          ) : (
            <Avatar
              src={chatAvatar}
              name={chatName}
              size="lg"
              online={isOnline ? true : undefined}
              isVerified={isVerified}
              verifiedBadgeUrl={verifiedBadgeUrl}
              verifiedBadgeType={verifiedBadgeType}
            />
          )}
        </div>

        {/* Инфо */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              {isPinned && <Pin size={11} className="text-nexo-400/60 flex-shrink-0 rotate-45" />}
              <span className={cn(
                'text-[13.5px] font-semibold truncate',
                isDeletedAccount ? 'text-white/30 italic' : 'text-white/90'
              )}>
                {chatName}
              </span>
              {isVerified && (
                <span className="flex-shrink-0 inline-flex items-center justify-center">
                  <VerifiedBadge
                    size="sm"
                    verifiedBadgeUrl={verifiedBadgeUrl}
                    verifiedBadgeType={verifiedBadgeType}
                  />
                </span>
              )}
              {otherUserTag?.tagText && (
                <UserTag
                  text={otherUserTag.tagText}
                  color={otherUserTag.tagColor}
                  style={otherUserTag.tagStyle}
                  size="xs"
                />
              )}
            </div>
            {timeStr && <span className="text-[11px] text-white/30 flex-shrink-0 ml-2">{timeStr}</span>}
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {isMine && lastMessage && !lastMessage.isDeleted && (
                <span className="flex-shrink-0">
                  {isRead ? (
                    <CheckCheck size={13} className="text-nexo-400/70" />
                  ) : (
                    <Check size={13} className="text-white/30" />
                  )}
                </span>
              )}
              <p className={cn(
                'text-[12.5px] truncate',
                isTyping ? 'text-nexo-400 font-medium' : draft ? 'text-red-400/80' : 'text-white/40'
              )}>
                {isTyping
                  ? t('typing')
                  : draft
                    ? <><span className="font-medium">{t('draft')} </span>{stripMarkdown(draft)}</>
                    : previewText}
              </p>
            </div>
            {chat.unreadCount > 0 && !isActive && (
              <span className="ml-2 flex-shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-nexo-500 flex items-center justify-center text-[10px] text-white font-bold">
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Context Menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          role="menu"
          className="fixed z-[70] min-w-[180px] py-1.5 rounded-xl glass-strong shadow-2xl shadow-black/50"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          {!isFavorites && (
            <>
              <button
                onClick={handlePin}
                role="menuitem"
                className="flex items-center gap-3 w-full px-4 py-2.5 text-[13px] text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors duration-150 rounded-lg mx-1"
              >
                <Pin size={15} className={isPinned ? 'rotate-45' : ''} />
                {isPinned ? t('unpinChat') : t('pinChat')}
              </button>
              <button
                onClick={handleArchive}
                role="menuitem"
                className="flex items-center gap-3 w-full px-4 py-2.5 text-[13px] text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors duration-150 rounded-lg mx-1"
              >
                {isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                {isArchived ? 'Разархивировать' : 'Архивировать'}
              </button>
              <div className="border-t border-white/[0.08] my-1 mx-3" />
              <button
                onClick={handleDelete}
                role="menuitem"
                className="flex items-center gap-3 w-full px-4 py-2.5 text-[13px] text-red-400 hover:text-red-300 hover:bg-red-500/[0.1] transition-colors duration-150 rounded-lg mx-1"
              >
                <Trash2 size={15} />
                {t('deleteChat')}
              </button>
            </>
          )}
          {isFavorites && (
            <button
              onClick={handlePin}
              role="menuitem"
              className="flex items-center gap-3 w-full px-4 py-2.5 text-[13px] text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors duration-150 rounded-lg mx-1"
            >
              <Pin size={15} className={isPinned ? 'rotate-45' : ''} />
              {isPinned ? t('unpinChat') : t('pinChat')}
            </button>
          )}
        </div>
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        message={t('deleteChatConfirm')}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {showUnlockModal && (
        <HiddenChatModal
          isOpen={showUnlockModal}
          onClose={() => setShowUnlockModal(false)}
          mode="unlock"
          chatId={chat.id}
          onUnlocked={() => {
            setIsUnlocked(true);
            setShowUnlockModal(false);
            setActiveChat(chat.id);
            loadMessages(chat.id);
          }}
        />
      )}
    </div>
  );
}

export default memo(ChatListItem);
