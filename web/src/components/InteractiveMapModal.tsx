import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, MapPin, Navigation } from 'lucide-react';

interface InteractiveMapModalProps {
  onClose: () => void;
  onSend: (location: { lat: number; lng: number; transport: string; address: string }) => void;
}

const TRANSPORT_MODES = [
  { id: 'walking', label: 'Пешком', icon: '🚶' },
  { id: 'car', label: 'Авто', icon: '🚗' },
  { id: 'public', label: 'ОТ', icon: '🚌' },
];

export default function InteractiveMapModal({ onClose, onSend }: InteractiveMapModalProps) {
  const [address, setAddress] = useState('');
  const [transport, setTransport] = useState('walking');
  const [lat, setLat] = useState(55.7558);
  const [lng, setLng] = useState(37.6173);

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude);
          setLng(position.coords.longitude);
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  const handleSend = () => {
    if (address.trim()) {
      onSend({
        lat,
        lng,
        transport,
        address,
      });
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 sm:inset-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[500px] sm:h-[600px] bg-surface-secondary/95 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <MapPin size={20} />
          Интерактивная карта
        </h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition"
        >
          <X size={20} className="text-white/60" />
        </button>
      </div>

      {/* Map preview */}
      <div className="flex-1 bg-[#1a1a1a] p-4 border-b border-white/10 flex items-center justify-center">
        <div className="text-center">
          <MapPin size={48} className="text-nexo-500 mx-auto mb-2" />
          <p className="text-white/60 text-sm">
            Координаты: {lat.toFixed(4)}, {lng.toFixed(4)}
          </p>
          <p className="text-white/40 text-xs mt-2">
            Откройте в Google Maps для полной карты
          </p>
        </div>
      </div>

      {/* Address input */}
      <div className="p-4 border-b border-white/10">
        <label className="text-sm text-white/60 block mb-2">Адрес или описание:</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Введите адрес или описание места..."
          className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nexo-500"
        />
      </div>

      {/* Transport mode */}
      <div className="p-4 border-b border-white/10">
        <label className="text-sm text-white/60 block mb-3">Способ доставки:</label>
        <div className="grid grid-cols-3 gap-2">
          {TRANSPORT_MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => setTransport(mode.id)}
              className={`p-3 rounded-lg transition text-center ${
                transport === mode.id
                  ? 'bg-nexo-500 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <div className="text-2xl mb-1">{mode.icon}</div>
              <div className="text-xs">{mode.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={handleGetLocation}
          className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-sm"
        >
          <Navigation size={16} />
          Мое местоположение
        </button>

        <button
          onClick={handleSend}
          disabled={!address.trim()}
          className="ml-auto px-4 py-2 bg-nexo-500 hover:bg-nexo-600 text-white rounded-lg transition text-sm disabled:opacity-50"
        >
          Отправить маршрут
        </button>
      </div>
    </motion.div>
  );
}
