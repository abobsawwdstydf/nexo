import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from './stores/authStore';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import ToastContainer from './components/ToastContainer';
import { НексоLoader } from './components/LoadingStates';
import { ErrorBoundary } from './components/ErrorBoundary';
import ConnectionStatus from './components/ConnectionStatus';

export default function App() {
  const { user, checkAuth, isLoading } = useAuthStore();

  // Auth check on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
          <motion.div key="app" className="h-full w-full flex-1 min-h-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <ChatPage />
          </motion.div>
        ) : (
          <motion.div key="auth" className="h-full w-full flex-1 min-h-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <AuthPage />
          </motion.div>
        )}
      </AnimatePresence>
      <ToastContainer />
    </div>
    </ErrorBoundary>
  );
}
