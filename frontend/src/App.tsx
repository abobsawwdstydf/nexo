import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from './stores/authStore';
import AuthPage from './pages/AuthPage';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const { user, checkAuth } = useAuthStore();

  // Auth check on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <ErrorBoundary>
    <div className="h-full w-full flex flex-col">
      {user ? (
        <motion.div
          key="nexo-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="h-full w-full flex items-center justify-center"
          style={{ background: '#1a1a1a' }}
        >
          <span style={{
            color: '#666',
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '0.3em',
            userSelect: 'none',
          }}>
            Нексо
          </span>
        </motion.div>
      ) : (
        <AuthPage />
      )}
    </div>
    </ErrorBoundary>
  );
}
