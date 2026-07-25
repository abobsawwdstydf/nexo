import { memo, useCallback } from 'react';
import { MessageSquare, User, Newspaper, Plus, Sparkles } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { TelegramTabBar } from './telegram-ui';

export type MobileView = 'chat' | 'wall' | 'profile' | 'hashtag';

interface MobileBottomNavProps {
  currentView: MobileView;
  onNavigate: (view: MobileView) => void;
  onOpenAI?: () => void;
  onOpenCreate?: () => void;
  onOpenProfile?: () => void;
}

function MobileBottomNav({
  currentView,
  onNavigate,
  onOpenAI,
  onOpenCreate,
  onOpenProfile,
}: MobileBottomNavProps) {
  const { chats } = useChatStore();
  const { user } = useAuthStore();

  const unreadCount = chats.reduce((acc, chat) => acc + (chat.unreadCount || 0), 0);

  const items = [
    { id: 'chat', label: 'Чаты', icon: MessageSquare, badge: unreadCount },
    { id: 'wall', label: 'Стена', icon: Newspaper },
    { id: 'ai', label: 'Нексо AI', icon: Sparkles, accent: true },
    { id: 'profile', label: 'Профиль', icon: User },
  ];

  const handleSelect = useCallback(
    (id: string) => {
      if ('vibrate' in navigator) navigator.vibrate(10);
      if (id === 'ai') {
        onOpenAI?.();
        return;
      }
      if (id === 'profile') {
        onOpenProfile?.();
        return;
      }
      onNavigate(id as MobileView);
    },
    [onNavigate, onOpenAI, onOpenProfile]
  );

  return (
    <TelegramTabBar
      items={items}
      selectedId={currentView}
      onSelect={handleSelect}
    />
  );
}

export default memo(MobileBottomNav);
