import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

interface SyncIndicatorProps {
  status: SyncStatus;
  message?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  status,
  message,
  showLabel = true,
  size = 'md',
  className = '',
}) => {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (status === 'success') {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const icons = {
    idle: <Cloud className={sizeClasses[size]} />,
    syncing: <RefreshCw className={`${sizeClasses[size]} animate-spin`} />,
    success: <Check className={`${sizeClasses[size]} animate-scale-in`} />,
    error: <AlertCircle className={`${sizeClasses[size]} animate-shake`} />,
    offline: <CloudOff className={sizeClasses[size]} />,
  };

  const colors = {
    idle: 'text-gray-400',
    syncing: 'text-blue-400',
    success: 'text-green-400',
    error: 'text-red-400',
    offline: 'text-gray-500',
  };

  const labels = {
    idle: 'Синхронизировано',
    syncing: 'Синхронизация...',
    success: 'Успешно!',
    error: 'Ошибка синхронизации',
    offline: 'Нет подключения',
  };

  const displayStatus = showSuccess ? 'success' : status;

  return (
    <div
      className={`
        inline-flex items-center gap-2
        transition-all duration-300
        ${className}
      `}
    >
      <div className={`${colors[displayStatus]} transition-colors duration-300`}>
        {icons[displayStatus]}
      </div>

      {showLabel && (
        <span
          className={`
            ${textSizeClasses[size]} ${colors[displayStatus]}
            font-medium transition-colors duration-300
          `}
        >
          {message || labels[displayStatus]}
        </span>
      )}

      {/* Pulse ring для syncing */}
      {status === 'syncing' && (
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-blue-400 animate-pulse-ring" />
        </div>
      )}
    </div>
  );
};

// Компонент для отображения прогресса синхронизации
interface SyncProgressProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

export const SyncProgress: React.FC<SyncProgressProps> = ({
  progress,
  label = 'Синхронизация',
  showPercentage = true,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-300 font-medium">{label}</span>
        {showPercentage && (
          <span className="text-gray-400 font-mono">{Math.round(progress)}%</span>
        )}
      </div>

      <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
        {/* Background shimmer */}
        <div className="absolute inset-0 skeleton-shimmer" />

        {/* Progress bar */}
        <div
          className="
            absolute inset-y-0 left-0
            bg-gradient-to-r from-nexo-500 to-nexo-400
            rounded-full
            transition-all duration-300 ease-out
            shadow-lg shadow-nexo-500/50
          "
          style={{ width: `${progress}%` }}
        >
          {/* Shine effect */}
          <div
            className="
              absolute inset-0
              bg-gradient-to-r from-transparent via-white/30 to-transparent
              animate-shimmer
            "
          />
        </div>
      </div>
    </div>
  );
};

// Компонент для отображения статуса подключения
interface ConnectionStatusProps {
  isOnline: boolean;
  lastSync?: Date;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isOnline,
  lastSync,
  className = '',
}) => {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    if (!lastSync) return;

    const updateTimeAgo = () => {
      const now = new Date();
      const diff = now.getTime() - lastSync.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (seconds < 60) {
        setTimeAgo('только что');
      } else if (minutes < 60) {
        setTimeAgo(`${minutes} мин назад`);
      } else if (hours < 24) {
        setTimeAgo(`${hours} ч назад`);
      } else {
        setTimeAgo(lastSync.toLocaleDateString());
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 30000); // Update every 30s

    return () => clearInterval(interval);
  }, [lastSync]);

  return (
    <div
      className={`
        inline-flex items-center gap-2 px-3 py-1.5
        glass-subtle rounded-lg
        ${className}
      `}
    >
      {/* Status indicator */}
      <div className="relative">
        <div
          className={`
            w-2 h-2 rounded-full
            ${isOnline ? 'bg-green-400' : 'bg-gray-500'}
            ${isOnline ? 'connection-pulse' : ''}
          `}
        />
      </div>

      {/* Status text */}
      <div className="flex flex-col">
        <span className="text-xs font-medium text-white">
          {isOnline ? 'Онлайн' : 'Офлайн'}
        </span>
        {lastSync && timeAgo && (
          <span className="text-[10px] text-gray-400">
            Синхронизировано {timeAgo}
          </span>
        )}
      </div>
    </div>
  );
};

// Hook для отслеживания онлайн статуса
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

// Hook для синхронизации с debounce
export const useSyncDebounce = (
  syncFn: () => Promise<void>,
  delay: number = 1000
) => {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const sync = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      setStatus('syncing');
      try {
        await syncFn();
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
      } catch (error) {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      }
    }, delay);
  }, [syncFn, delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { status, sync };
};
