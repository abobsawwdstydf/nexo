import { useEffect, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from './stores/authStore';
import { useBetaStore } from './stores/betaStore';
import CookieConsent from './components/CookieConsent';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AudioClickWrapper } from './lib/useClickSound';
import { ToastContainer } from './components/ToastContainer';
import { CallProvider } from './lib/callContext';
import { BetaBanner } from './components/BetaBanner';
import { BetaNotStarted } from './components/BetaNotStarted';
import { DevFab } from './components/DevFab';
import { usePerformanceMode } from './hooks/usePerformanceMode';

// Lazy load heavy pages for better initial load
const AuthPage = lazy(() => import('./pages/AuthPage'));
const MessengerPage = lazy(() => import('./pages/MessengerPage'));
const LegalPages = lazy(() => import('./pages/LegalPages'));
const InfoPage = lazy(() => import('./pages/InfoPage'));
const AdminLoginPage = lazy(() => import('./components/AdminLoginPage'));

// Module-level fallback keeps a stable component identity across re-renders
const LoadingFallback = () => (
  <div className="h-full w-full flex items-center justify-center">
    <div className="skeleton skeleton-bubble w-20 h-20 rounded-full" />
  </div>
);

export default function App() {
  const { user, checkAuth } = useAuthStore();
  const { status: beta, fetch: fetchBeta, loaded: betaLoaded } = useBetaStore();
  const [showLegal, setShowLegal] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | 'cookies'>('privacy');
  const [teamLogin, setTeamLogin] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [adminRoute, setAdminRoute] = useState(false);

  // Perf-mode глобально (слабые устройства / reduced motion)
  usePerformanceMode();

  // Auth + beta check on mount
  useEffect(() => {
    checkAuth();
    fetchBeta();
  }, [checkAuth, fetchBeta]);

  // Отдельная админ-панель: путь /admin или хэш #admin — вне бета-гейтов
  useEffect(() => {
    const check = () => {
      const h = window.location.hash;
      setAdminRoute(h === '#admin' || h.startsWith('#admin') || window.location.pathname.startsWith('/admin'));
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  // Open /info on hash (hook must stay above any early returns)
  useEffect(() => {
    if (window.location.hash === '#info') setShowInfo(true);
  }, []);

  if (adminRoute) {
    return (
      <ErrorBoundary>
        <AudioClickWrapper>
          <Suspense fallback={<LoadingFallback />}>
            <AdminLoginPage />
          </Suspense>
        </AudioClickWrapper>
      </ErrorBoundary>
    );
  }

  const openLegal = (tab: 'privacy' | 'terms' | 'cookies') => {
    setLegalTab(tab);
    setShowLegal(true);
  };
  const openInfo = () => {
    history.replaceState(null, '', '#info');
    setShowInfo(true);
  };
  const closeInfo = () => {
    history.replaceState(null, '', window.location.pathname);
    setShowInfo(false);
  };

  // Бета закончилась, релиз ещё не наступил — таймер до релиза (25 августа, 6:00 МСК)
  if (beta?.ended && !beta.releasePassed) {
    return (
      <ErrorBoundary>
        <AudioClickWrapper>
          <BetaNotStarted
            startTime={beta.releaseTime}
            message={beta.blockedMessage || 'Релиз Нексо — 25 августа в 6:00 (МСК)'}
          />
        </AudioClickWrapper>
      </ErrorBoundary>
    );
  }

  // Beta status still loading — show a spinner instead of flashing the main UI
  if (!betaLoaded) {
    return (
      <ErrorBoundary>
        <AudioClickWrapper>
          <LoadingFallback />
        </AudioClickWrapper>
      </ErrorBoundary>
    );
  }

  // Beta not started yet — only the early-access account can use the app
  if (beta && !beta.active && !beta.ended && !user && !teamLogin) {
    return (
      <ErrorBoundary>
        <AudioClickWrapper>
          <BetaNotStarted
            startTime={beta.startTime}
            message={beta.blockedMessage}
            onTeamLogin={() => setTeamLogin(true)}
          />
        </AudioClickWrapper>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
    <AudioClickWrapper>
    <div className="h-full w-full flex flex-col relative">
      {/* Beta banner */}
      {beta?.active && (
        <BetaBanner
          daysLeft={beta.daysLeft}
          message={beta.message}
        />
      )}

      {/* ═══ Main page: messenger or auth ═══ */}
      <AnimatePresence mode="wait">
        {user ? (
          <motion.div
            key="messenger"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full"
          >
            <Suspense fallback={<LoadingFallback />}>
              <CallProvider>
                <MessengerPage onInfoClick={openInfo} />
              </CallProvider>
            </Suspense>
          </motion.div>
        ) : (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full"
          >
            <Suspense fallback={<LoadingFallback />}>
              <AuthPage onLegalClick={openLegal} onInfoClick={openInfo} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Legal overlay (fullscreen) ═══ */}
      <AnimatePresence>
        {showLegal && (
          <motion.div
            key="legal"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-50 h-full w-full"
          >
            <Suspense fallback={<LoadingFallback />}>
              <LegalPages
                initialTab={legalTab}
                onBack={() => setShowLegal(false)}
              />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Info overlay (fullscreen) ═══ */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            key="info"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-50 h-full w-full"
          >
            <Suspense fallback={<LoadingFallback />}>
              <InfoPage onBack={closeInfo} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      <CookieConsent />
      <ToastContainer />
      <DevFab />
    </div>
    </AudioClickWrapper>
    </ErrorBoundary>
  );
}
