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
import { BetaEnded } from './components/BetaEnded';
import { BetaNotStarted } from './components/BetaNotStarted';

// Lazy load heavy pages for better initial load
const AuthPage = lazy(() => import('./pages/AuthPage'));
const MessengerPage = lazy(() => import('./pages/MessengerPage'));
const LegalPages = lazy(() => import('./pages/LegalPages'));

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

  // Auth + beta check on mount
  useEffect(() => {
    checkAuth();
    fetchBeta();
  }, [checkAuth, fetchBeta]);

  const openLegal = (tab: 'privacy' | 'terms' | 'cookies') => {
    setLegalTab(tab);
    setShowLegal(true);
  };

  // Beta ended — block everything
  if (beta?.ended) {
    return (
      <ErrorBoundary>
        <AudioClickWrapper>
          <div className="h-full w-full flex flex-col relative">
            <BetaEnded />
          </div>
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
          contactTg={beta.contactTg}
          contactTt={beta.contactTt}
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
                <MessengerPage />
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
              <AuthPage onLegalClick={openLegal} />
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

      <CookieConsent />
      <ToastContainer />
    </div>
    </AudioClickWrapper>
    </ErrorBoundary>
  );
}
