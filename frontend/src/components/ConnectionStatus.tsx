import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { onConnectionStatusChange, getConnectionStatus } from '../lib/socket';

type Status = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export default function ConnectionStatus() {
  const [status, setStatus] = useState<Status>(getConnectionStatus());

  useEffect(() => {
    return onConnectionStatusChange(setStatus);
  }, []);

  const isVisible = status === 'disconnected' || status === 'reconnecting';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium"
          style={{
            background: status === 'disconnected'
              ? '#dc2626'
              : status === 'reconnecting'
              ? '#d97706'
              : '#7B61FF',
          }}
        >
          {status === 'disconnected' ? (
            <>
              <WifiOff size={16} />
              <span>Нет соединения</span>
            </>
          ) : status === 'reconnecting' ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Переподключение...</span>
            </>
          ) : (
            <>
              <Wifi size={16} />
              <span>Подключение...</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
