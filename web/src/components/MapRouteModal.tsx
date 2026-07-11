import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, MapPin, Navigation, Car, PersonStanding, Bus, Loader2, Send } from 'lucide-react';

interface MapRouteModalProps {
  onClose: () => void;
  onSend: (data: { lat: number; lng: number; address: string; destLat?: number; destLng?: number; destAddress?: string; transport?: string }) => void;
}

type Transport = 'walk' | 'car' | 'transit';

export default function MapRouteModal({ onClose, onSend }: MapRouteModalProps) {
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [myAddress, setMyAddress] = useState('Определение...');
  const [destAddress, setDestAddress] = useState('');
  const [destLoc, setDestLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [transport, setTransport] = useState<Transport>('car');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setMyLoc({ lat, lng });
        setLoading(false);
        reverseGeocode(lat, lng).then(setMyAddress);
        initMap(lat, lng);
      },
      () => { setError('Не удалось определить местоположение'); setLoading(false); },
      { timeout: 10000 }
    );
  }, []);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ru`, { headers: { 'User-Agent': 'НексоApp' } });
      const d = await r.json();
      const parts = [d.address?.road, d.address?.house_number, d.address?.city || d.address?.town].filter(Boolean);
      return parts.join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch { return `${lat.toFixed(4)}, ${lng.toFixed(4)}`; }
  };

  const geocode = async (query: string) => {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=ru`, { headers: { 'User-Agent': 'НексоApp' } });
    const d = await r.json();
    if (d[0]) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon), address: d[0].display_name };
    return null;
  };

  const initMap = (lat: number, lng: number) => {
    if (!mapRef.current || mapInstanceRef.current) return;
    // Use Leaflet via CDN (loaded dynamically)
    const L = (window as any).L;
    if (!L) return;
    const map = L.map(mapRef.current).setView([lat, lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    const icon = L.divIcon({ html: '<div style="width:16px;height:16px;background:#6366f1;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
    markerRef.current = L.marker([lat, lng], { icon }).addTo(map).bindPopup('Вы здесь');
    mapInstanceRef.current = map;
  };

  const handleSearchDest = async () => {
    if (!destAddress.trim()) return;
    setSearching(true);
    const result = await geocode(destAddress);
    setSearching(false);
    if (!result) return;
    setDestLoc({ lat: result.lat, lng: result.lng });
    setDestAddress(result.address.split(',').slice(0, 2).join(','));

    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (L && map) {
      if (destMarkerRef.current) destMarkerRef.current.remove();
      const icon = L.divIcon({ html: '<div style="width:16px;height:16px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
      destMarkerRef.current = L.marker([result.lat, result.lng], { icon }).addTo(map).bindPopup('Пункт назначения');
      if (myLoc) {
        map.fitBounds([[myLoc.lat, myLoc.lng], [result.lat, result.lng]], { padding: [40, 40] });
        // Draw simple line
        if (routeLayerRef.current) routeLayerRef.current.remove();
        routeLayerRef.current = L.polyline([[myLoc.lat, myLoc.lng], [result.lat, result.lng]], { color: '#6366f1', weight: 3, dashArray: '8 4' }).addTo(map);
      }
    }
  };

  const handleSend = () => {
    if (!myLoc) return;
    onSend({
      lat: myLoc.lat,
      lng: myLoc.lng,
      address: myAddress,
      destLat: destLoc?.lat,
      destLng: destLoc?.lng,
      destAddress: destLoc ? destAddress : undefined,
      transport: destLoc ? transport : undefined,
    });
    onClose();
  };

  const TRANSPORT_ICONS = { walk: PersonStanding, car: Car, transit: Bus };
  const TRANSPORT_LABELS = { walk: 'Пешком', car: 'Авто', transit: 'ОТ' };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-surface-secondary rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
        style={{ height: '560px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-nexo-400" />
            <span className="text-sm font-semibold text-white">Карта и маршрут</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Map */}
        <div className="flex-1 relative bg-zinc-900">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={24} className="text-nexo-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">{error}</div>
          ) : (
            <div ref={mapRef} className="absolute inset-0" />
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-white/5 shrink-0 space-y-3">
          {/* My location */}
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full bg-nexo-500 shrink-0" />
            <span className="text-zinc-300 truncate">{myAddress}</span>
          </div>

          {/* Destination search */}
          <div className="flex gap-2">
            <input
              value={destAddress}
              onChange={e => setDestAddress(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearchDest()}
              placeholder="Куда? (необязательно)"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50"
            />
            <button onClick={handleSearchDest} disabled={searching}
              className="px-3 py-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50">
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
            </button>
          </div>

          {/* Transport selector */}
          {destLoc && (
            <div className="flex gap-2">
              {(Object.keys(TRANSPORT_ICONS) as Transport[]).map(t => {
                const Icon = TRANSPORT_ICONS[t];
                return (
                  <button key={t} onClick={() => setTransport(t)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs transition-colors ${transport === t ? 'bg-nexo-500/20 text-nexo-400 border border-nexo-500/30' : 'bg-white/5 text-zinc-500 border border-white/10 hover:bg-white/10'}`}>
                    <Icon size={13} /> {TRANSPORT_LABELS[t]}
                  </button>
                );
              })}
            </div>
          )}

          <button onClick={handleSend} disabled={!myLoc}
            className="w-full py-2.5 rounded-xl bg-nexo-500 text-white text-sm font-medium hover:bg-nexo-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            <Send size={14} /> Отправить {destLoc ? 'маршрут' : 'геолокацию'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
