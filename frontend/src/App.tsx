import { useEffect, useState, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from './stores/authStore';
import { useChatStore } from './stores/chatStore';
import { useToastStore } from './stores/toastStore';
import { useNavigationStore } from './stores/navigationStore';
import { api } from './lib/api';
import { getSocket } from './lib/socket';
import { playClickSound } from './hooks/useClickSound';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import ToastContainer from './components/ToastContainer';
import MusicPlayer from './components/MusicPlayer';
import VoicePlayerBar from './components/VoicePlayerBar';
import Sidebar from './components/Sidebar';
import MobileBottomNav, { MobileView } from './components/MobileBottomNav';
import FriendsBottomSheet from './components/FriendsBottomSheet';

import { НексоLoader } from './components/LoadingStates';
import { ErrorBoundary } from './components/ErrorBoundary';
import ConnectionStatus from './components/ConnectionStatus';
import FriendsPage from './pages/FriendsPage';
import UserProfile from './components/UserProfile';
import LegalPage, { type LegalPageType } from './components/LegalPage';

// Lazy-loaded pages (code-split)
const WallPage = lazy(() => import('./pages/WallPage'));
const HashtagPage = lazy(() => import('./pages/HashtagPage'));
const DeviceAuthPage = lazy(() => import('./pages/DeviceAuthPage'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'));
const YooKassaInfoPage = null; // Removed
const AcceptSharedFolderModal = lazy(() => import('./components/AcceptSharedFolderModal'));

type AppView = 'chat' | 'wall' | 'friends' | 'profile' | 'hashtag';

const LEGAL_ROUTES: Record<string, LegalPageType> = {
  terms: 'terms',
  privacy: 'privacy',
  cookies: 'cookies',
  offer: 'offer',
  'personal-data': 'personal-data',
  marketing: 'marketing',
};

export default function App() {
  const { user, checkAuth, isLoading, updateUser } = useAuthStore();
  const { success } = useToastStore();
  const { activeChat } = useChatStore();
  const { currentView, profileUserId, hashtagTag, highlightPostId, showAI, navigateTo, openProfile, openHashtag, openWallPost, openAI, closeAI, openFriends, closeFriends, clearHighlight } = useNavigationStore();
  const [sharedFolderToken, setSharedFolderToken] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileFriendsOpen, setMobileFriendsOpen] = useState(false);


  // Определяем мобильное устройство
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Глобальный звук клика по кнопкам
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, [role="button"], a[href]')) {
        playClickSound();
      }
    };
    document.addEventListener('click', handler, { passive: true });
    return () => document.removeEventListener('click', handler);
  }, []);

  // Страница успешной оплаты
  if (window.location.pathname === '/payment/success') {
    return <Suspense fallback={<НексоLoader />}><PaymentSuccessPage /></Suspense>;
  }

  // Страница ЮKassa info — removed
  // if (window.location.pathname === '/yookassainfo') {
  //   return <Suspense fallback={<НексоLoader />}><YooKassaInfoPage standalone /></Suspense>;
  // }

  // Device auth page
  if (window.location.pathname.startsWith('/device')) {
    return <Suspense fallback={<НексоLoader />}><DeviceAuthPage /></Suspense>;
  }

  const legalPath = window.location.pathname.match(/^\/legal\/([a-z-]+)$/);
  const legalType = legalPath ? LEGAL_ROUTES[legalPath[1]] : undefined;
  if (legalType) {
    return <LegalPage type={legalType} onClose={() => window.history.length > 1 ? window.history.back() : window.location.assign('/')} />;
  }

  // Shared folder link - только один раз при монтировании
  useEffect(() => {
    const folderMatch = window.location.pathname.match(/^\/folder\/([a-f0-9]+)$/);
    if (folderMatch && user) {
      const folderToken = folderMatch[1];
      setSharedFolderToken(folderToken);
    }
  }, [user]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Settings and backgrounds are loaded via /api/init in checkAuth()
  // No separate calls needed — data arrives in the init response

  useEffect(() => {
    const handleHashRoute = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/@')) {
        const username = hash.slice(3);
        window.location.href = `/?user=${username}`;
      } else if (hash.startsWith('#/channel/')) {
        const channelUsername = hash.slice(10);
        window.location.href = `/?channel=${channelUsername}`;
      }
    };
    handleHashRoute();
    window.addEventListener('hashchange', handleHashRoute);
    return () => window.removeEventListener('hashchange', handleHashRoute);
  }, []);

  // Роутинг по /@username, /wall/post/:postId и ?user=username
  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const usernameMatch = path.match(/^\/@(.+)$/);
    const hashtagMatch = path.match(/^\/wall\/hashtag\/(.+)$/);
    const postMatch = path.match(/^\/wall\/post\/(.+)$/);
    const queryUser = params.get('user');
    
    if (postMatch && user) {
      const postId = postMatch[1];
      openWallPost(postId);
      window.history.replaceState({}, '', '/');
    } else if (hashtagMatch && user) {
      const tag = hashtagMatch[1];
      openHashtag(tag);
      window.history.replaceState({}, '', '/');
    } else if (usernameMatch && user) {
      const username = usernameMatch[1];
      api.searchUsers(username).then(users => {
        const foundUser = users.find(u => u.username === username);
        if (foundUser) {
          openProfile(foundUser.id);
          window.history.replaceState({}, '', '/');
        }
      }).catch(console.error);
    } else if (queryUser && user) {
      api.searchUsers(queryUser).then(users => {
        const foundUser = users.find(u => u.username === queryUser);
        if (foundUser) {
          openProfile(foundUser.id);
          window.history.replaceState({}, '', '/');
        }
      }).catch(console.error);
    }
  }, [user]);

  // Listen for premium notifications via socket
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;

    const handlePremiumGift = (data: { months: number }) => {
      success(`Вам подарена подписка Нексо НУче на ${data.months} мес.!`);
    };

    socket.on('premium:gift_received', handlePremiumGift);

    return () => {
      socket.off('premium:gift_received', handlePremiumGift);
    };
  }, [user?.id]);

  if (isLoading && user) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-full flex items-center justify-center bg-surface"
      >
        <НексоLoader size="lg" />
      </motion.div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="h-full w-full flex flex-col">
      <ConnectionStatus />
      <AnimatePresence mode="wait">
        {user ? (
          <motion.div key="app" className="h-full w-full flex-1 min-h-0 flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {/* Main content */}
            <div className="flex-1 min-h-0 overflow-hidden flex">
              {/* Sidebar - show on all views for consistent layout */}
              {(currentView === 'chat' || currentView === 'wall' || currentView === 'friends') && (
                <div className={`${(isMobile && activeChat) || (isMobile && currentView === 'wall') ? 'hidden' : 'flex'} w-full ${currentView === 'wall' ? 'sm:w-[56px]' : 'sm:w-[380px]'} flex-shrink-0 border-r border-border sm:rounded-2xl overflow-hidden transition-all duration-300`}>
                  <Sidebar 
                    onOpenAI={() => openAI()}
                    onOpenFriends={() => openFriends()}
                    onOpenWall={() => navigateTo('wall')}
                  />
                </div>
              )}
              
              <div className={`${isMobile && currentView === 'chat' && !activeChat ? 'hidden' : 'flex'} flex-1 min-h-0 overflow-hidden`}>
                <AnimatePresence mode="wait">
                  {currentView === 'hashtag' && hashtagTag ? (
                    <motion.div
                      key="hashtag"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="flex-1 min-h-0"
                    >
                      <HashtagPage
                        tag={hashtagTag}
                        onClose={() => navigateTo('wall')}
                      />
                    </motion.div>
                  ) : currentView === 'profile' && profileUserId ? (
                    <motion.div
                      key="profile"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex-1 min-h-0 flex items-center justify-center relative"
                    >
                      {/* Backdrop */}
                      <div className="absolute inset-0 bg-black/40" onClick={() => navigateTo('chat')} />
                      {/* Centered profile modal */}
                      <motion.div
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.97, y: 16 }}
                        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
                        className="relative z-10 w-full max-w-2xl h-[88vh] sm:rounded-3xl rounded-none overflow-hidden liquid-glass border border-white/[0.08]"
                      >
                        <UserProfile
                          userId={profileUserId}
                          isSelf={profileUserId === user.id}
                          onClose={() => navigateTo('chat')}
                        />
                      </motion.div>
                    </motion.div>
                  ) : currentView === 'wall' ? (
                    <motion.div
                      key="wall"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="flex-1 min-h-0"
                    >
                      <WallPage highlightPostId={highlightPostId} onHighlightCleared={() => clearHighlight()} />
                    </motion.div>
                  ) : currentView === 'friends' ? (
                    <motion.div
                      key="friends"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="flex-1 min-h-0"
                    >
                      <FriendsPage onClose={() => navigateTo('chat')} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="chat"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="flex-1 min-h-0"
                    >
                      <ChatPage />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="auth" className="h-full w-full flex-1 min-h-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <AuthPage />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Mobile Bottom Navigation - только на мобильном, скрывается когда открыт чат */}
      {user && isMobile && !(activeChat && currentView === 'chat') && (
        <MobileBottomNav
          currentView={(mobileFriendsOpen ? 'wall' : currentView) as MobileView}
          onNavigate={(view) => {
            setMobileFriendsOpen(false);
            navigateTo(view as AppView);
          }}
          onOpenAI={() => {
            openAI();
          }}
          onOpenCreate={() => {
            useNavigationStore.getState().openNewChat();
          }}
          onOpenProfile={() => {
            setMobileFriendsOpen(false);
            openProfile(user.id);
          }}
        />
      )}

      {/* Mobile Friends Bottom Sheet */}
      <FriendsBottomSheet
        isOpen={mobileFriendsOpen}
        onClose={() => setMobileFriendsOpen(false)}
        isMobile={isMobile}
      />
      
      <ToastContainer />
      <MusicPlayer />
      <VoicePlayerBar />

      {/* Shared Folder Modal */}
      {sharedFolderToken && user && (
        <AcceptSharedFolderModal
          token={sharedFolderToken}
          onClose={() => {
            setSharedFolderToken(null);
            window.history.pushState({}, '', '/');
          }}
          onSuccess={() => {
            success('Папка успешно добавлена!');
            window.location.reload();
          }}
        />
      )}
    </div>
    </ErrorBoundary>
  );
}
