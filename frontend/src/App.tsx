import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from './stores/authStore';
import AuthPage from './pages/AuthPage';
import MessengerPage from './pages/MessengerPage';
import LegalPages from './pages/LegalPages';
import CookieConsent from './components/CookieConsent';
import { ErrorBoundary } from './components/ErrorBoundary';

type Page = 'auth' | 'messenger' | 'legal';

export default function App() {
  const { user, checkAuth } = useAuthStore();
  const [page, setPage] = useState<Page>('auth');
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | 'cookies'>('privacy');

  // Auth check on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Sync page state with auth state
  useEffect(() => {
    if (user) {
      setPage('messenger');
    } else if (page === 'messenger') {
      setPage('auth');
    }
  }, [user]);

  const openLegal = (tab: 'privacy' | 'terms' | 'cookies') => {
    setLegalTab(tab);
    setPage('legal');
  };

  return (
    <ErrorBoundary>
    <div className="h-full w-full flex flex-col">
      <AnimatePresence mode="wait">
        {page === 'messenger' && user ? (
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
        ) : page === 'legal' ? (
          <motion.div
            key="legal"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full"
          >
            <LegalPages
              initialTab={legalTab}
              onBack={() => setPage(user ? 'messenger' : 'auth')}
            />
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
      <CookieConsent />
    </div>
    </ErrorBoundary>
  );
}
