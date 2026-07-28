import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from './stores/authStore';
import AuthPage from './pages/AuthPage';
import MessengerPage from './pages/MessengerPage';
import LegalPages from './pages/LegalPages';
import CookieConsent from './components/CookieConsent';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AudioClickWrapper } from './lib/useClickSound';
import { ToastContainer } from './components/ToastContainer';

export default function App() {
  const { user, checkAuth } = useAuthStore();
  const [showLegal, setShowLegal] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | 'cookies'>('privacy');

  // Auth check on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const openLegal = (tab: 'privacy' | 'terms' | 'cookies') => {
    setLegalTab(tab);
    setShowLegal(true);
  };

  return (
    <ErrorBoundary>
    <AudioClickWrapper>
    <div className="h-full w-full flex flex-col relative">
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
            <MessengerPage />
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
            <AuthPage onLegalClick={openLegal} />
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
            <LegalPages
              initialTab={legalTab}
              onBack={() => setShowLegal(false)}
            />
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
