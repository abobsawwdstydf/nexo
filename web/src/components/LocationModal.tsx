import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, MapPin, Navigation, Loader2, Crosshair, RefreshCw } from 'lucide-react';
import BottomSheet from './BottomSheet';

interface LocationModalProps {
  onClose: () => void;
  onSend: (location: { lat: number; lng: number; accuracy: number; name?: string }) => void;
}

export default function LocationModal({ onClose, onSend }: LocationModalProps) {
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string>('Определение...');
  const [retryCount, setRetryCount] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const mountedRef = useRef(true);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Геолокация не поддерживается браузером');
      setLoading(false);
      return;
    }

    let watchId: number | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout>;
    let bestAccuracy = Infinity;

    const reverseGeocode = (latitude: number, longitude: number) => {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ru`,
        { headers: { 'User-Agent': 'Nexo App' } }
      )
        .then(res => res.json())
        .then(data => {
          if (!mountedRef.current) return;
          if (data?.address) {
            const parts: string[] = [];
            if (data.address.road) parts.push(data.address.road);
            if (data.address.house_number) parts.push(data.address.house_number);
            const city = data.address.city || data.address.town || data.address.village;
            if (city) parts.push(city);
            if (data.address.country) parts.push(data.address.country);
            setAddress(parts.join(', ') || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          } else {
            setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          }
        })
        .catch(() => {
          if (mountedRef.current) setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        });
    };

    const onSuccess = (position: GeolocationPosition) => {
      if (!mountedRef.current) return;
      const { latitude, longitude, accuracy } = position.coords;
      // Принимаем позицию только если она точнее предыдущей
      if (accuracy < bestAccuracy) {
        bestAccuracy = accuracy;
        setLocation({ lat: latitude, lng: longitude, accuracy });
        reverseGeocode(latitude, longitude);
      }
      setLoading(false);
      clearTimeout(fallbackTimer);
    };

    const onError = (err: GeolocationPositionError) => {
      if (!mountedRef.current) return;
      setLoading(false);
      switch (err.code) {
        case 1: setError('Доступ к геолокации запрещён. Разрешите в настройках браузера.'); break;
        case 2: setError('Не удалось определить местоположение. Проверьте GPS или интернет.'); break;
        case 3: setError('Превышено время ожидания. Попробуйте ещё раз.'); break;
        default: setError('Ошибка определения местоположения');
      }
    };

    // Сначала быстрый запрос с низкой точностью (работает на ПК)
    navigator.geolocation.getCurrentPosition(onSuccess, () => {}, {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 60000,
    });

    // Параллельно — высокоточный запрос (для мобильных)
    watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });

    // Если через 20 секунд ничего нет — показываем ошибку
    fallbackTimer = setTimeout(() => {
      if (!mountedRef.current) return;
      if (loading) {
        setLoading(false);
        setError('Не удалось определить местоположение. Попробуйте ещё раз.');
      }
    }, 20000);

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(fallbackTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setLocation(null);
    setAddress('Определение...');
    setRetryCount(c => c + 1);
  };

  const handleSend = () => {
    if (!location) return;
    onSend({ ...location, name: address || undefined });
    onClose();
  };

  const formatAccuracy = (meters: number): string => {
    if (meters < 1000) return `±${Math.round(meters)} м`;
    return `±${(meters / 1000).toFixed(1)} км`;
  };

  const getAccuracyColor = (meters: number): string => {
    if (meters <= 50) return 'text-emerald-400';
    if (meters <= 200) return 'text-yellow-400';
    if (meters <= 1000) return 'text-orange-400';
    return 'text-red-400';
  };

  const getAccuracyLabel = (meters: number): string => {
    if (meters <= 50) return 'Хорошая';
    if (meters <= 200) return 'Средняя';
    if (meters <= 1000) return 'Низкая';
    return 'Очень низкая (IP)';
  };

  const mapEmbedUrl = location
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.005},${location.lat - 0.005},${location.lng + 0.005},${location.lat + 0.005}&layer=mapnik&marker=${location.lat},${location.lng}`
    : null;

  const headerContent = (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
        <MapPin size={14} className="text-white" />
      </div>
      <h3 className="text-sm font-semibold text-white">Геолокация</h3>
    </div>
  );

  const bodyContent = (
    <div className="p-4">
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 size={28} className="text-emerald-400 animate-spin" />
          <p className="text-sm text-zinc-400">Определение местоположения...</p>
          <p className="text-xs text-zinc-500">Разрешите доступ к геолокации</p>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
            <Navigation size={20} className="text-red-400" />
          </div>
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-sm transition-colors"
          >
            <RefreshCw size={14} />
            Попробовать снова
          </button>
        </div>
      ) : location ? (
        <div className="space-y-3">
          <div className="relative w-full h-40 rounded-xl overflow-hidden bg-zinc-800/50">
            {mapEmbedUrl ? (
              <iframe
                src={mapEmbedUrl}
                className="w-full h-full border-0 pointer-events-none"
                title="Карта местоположения"
                loading="lazy"
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                <Crosshair size={24} className="animate-pulse" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg shadow-red-500/50" />
            </div>
            <button
              onClick={handleRetry}
              className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
              title="Обновить"
            >
              <RefreshCw size={12} />
            </button>
          </div>

          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-xs text-zinc-500 mb-1">Адрес</p>
            <p className="text-sm text-white leading-snug">{address}</p>
          </div>

          <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500">Точность</p>
              <p className="text-sm text-white font-medium">{formatAccuracy(location.accuracy)}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Crosshair size={14} className={getAccuracyColor(location.accuracy)} />
              <span className={`text-xs font-medium ${getAccuracyColor(location.accuracy)}`}>
                {getAccuracyLabel(location.accuracy)}
              </span>
            </div>
          </div>

          <p className="text-xs text-zinc-600 font-mono text-center">
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </p>

          <button
            onClick={handleSend}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <MapPin size={14} />
            Отправить местоположение
          </button>
        </div>
      ) : null}
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen={true} onClose={onClose} showCloseButton={false}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          {headerContent}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-zinc-400 hover:text-white transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        {bodyContent}
      </BottomSheet>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          {headerContent}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-zinc-400 hover:text-white transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        {bodyContent}
      </motion.div>
    </div>
  );
}
