import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone, Monitor, Globe, Trash2, X, Check, Loader, Clock, MapPin,
  Shield, AlertTriangle, Wifi, Battery, Info,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface DeviceManagerProps {
  onClose: () => void;
}

interface Device {
  id: string;
  name: string;
  type: 'web' | 'android' | 'ios' | 'desktop';
  browser: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  web: Globe,
  android: Smartphone,
  ios: Smartphone,
  desktop: Monitor,
};

const DEVICE_COLORS: Record<string, string> = {
  web: 'bg-blue-500/20 border-blue-500/20 text-blue-400/70',
  android: 'bg-green-500/20 border-green-500/20 text-green-400/70',
  ios: 'bg-slate-500/20 border-slate-500/20 text-slate-400/70',
  desktop: 'bg-purple-500/20 border-purple-500/20 text-purple-400/70',
};

export default function DeviceManager({ onClose }: DeviceManagerProps) {
  const [devices, setDevices] = useState<Device[]>([
    { id: '1', name: 'Chrome на Windows', type: 'web', browser: 'Chrome 120', ip: '192.168.1.1', location: 'Москва, Россия', lastActive: new Date().toISOString(), isCurrent: true },
    { id: '2', name: 'Android Pixel 8', type: 'android', browser: 'Nexo App', ip: '10.0.0.1', location: 'Москва, Россия', lastActive: '2025-01-14T18:30:00', isCurrent: false },
    { id: '3', name: 'iPhone 15', type: 'ios', browser: 'Nexo App', ip: '10.0.0.2', location: 'Санкт-Петербург', lastActive: '2025-01-12T10:00:00', isCurrent: false },
    { id: '4', name: 'Firefox на macOS', type: 'desktop', browser: 'Firefox 121', ip: '172.16.0.1', location: 'Казань', lastActive: '2025-01-10T09:00:00', isCurrent: false },
  ]);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [showSecurityTips, setShowSecurityTips] = useState(false);

  const handleRevoke = useCallback((id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id));
    setConfirmRevoke(null);
    toast.success('Сессия отозвана');
  }, []);

  const handleRevokeAll = useCallback(() => {
    setDevices(prev => prev.filter(d => d.isCurrent));
    toast.success('Все остальные сессии отозваны');
  }, []);

  const formatLastActive = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'Сейчас';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    return `${Math.floor(diff / 86400000)} дн назад`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/20 flex items-center justify-center">
            <Smartphone size={15} className="text-violet-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Устройства</h2>
        </div>
        <div className="flex items-center gap-1">
          <motion.button onClick={() => setShowSecurityTips(v => !v)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileTap={{ scale: 0.95 }} title="Советы">
            <Shield size={15} className="text-white/40" />
          </motion.button>
          <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileTap={{ scale: 0.95 }}>
            <X size={15} className="text-white/40" />
          </motion.button>
        </div>
      </div>

      {/* Active count */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-xs text-white/40">Активных сессий: <span className="text-white/60 font-medium">{devices.length}</span></span>
        {devices.length > 1 && (
          <button onClick={handleRevokeAll} className="text-[10px] text-red-400/50 hover:text-red-400/80 transition-colors">
            Отозвать все
          </button>
        )}
      </div>

      {/* Security tips */}
      <AnimatePresence>
        {showSecurityTips && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden border-b border-white/[0.06]">
            <div className="px-3 py-3 space-y-1.5">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Советы по безопасности</p>
              {['Используйте уникальные пароли для каждого устройства', 'Включите двухфакторную аутентификацию', 'Регулярно проверяйте список активных сессий'].map((tip, i) => (
                <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02]">
                  <Shield size={10} className="text-emerald-400/40 mt-0.5 flex-shrink-0" />
                  <span className="text-[10px] text-white/40">{tip}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Device list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-1.5">
          {devices.map(device => {
            const Icon = DEVICE_ICONS[device.type] || Monitor;
            return (
              <motion.div key={device.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl border transition-colors ${device.isCurrent ? 'bg-white/[0.05] border-white/[0.08]' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${DEVICE_COLORS[device.type]}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-white/70 font-medium truncate">{device.name}</p>
                      {device.isCurrent && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-emerald-500/15 text-emerald-400/70 border border-emerald-500/20 flex-shrink-0">ТЕКУЩЕЕ</span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/30 mt-0.5">{device.browser}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/20">
                      <span className="flex items-center gap-1"><Wifi size={9} />{device.ip}</span>
                      <span className="flex items-center gap-1"><MapPin size={9} />{device.location}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[9px] text-white/15">
                      <Clock size={8} />
                      <span>Последняя активность: {formatLastActive(device.lastActive)}</span>
                    </div>
                  </div>
                  {!device.isCurrent && (
                    <div className="flex-shrink-0">
                      {confirmRevoke === device.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleRevoke(device.id)}
                            className="px-2 py-1 rounded-lg bg-red-500/20 text-[10px] text-red-400/70 hover:bg-red-500/30 transition-colors">
                            Да
                          </button>
                          <button onClick={() => setConfirmRevoke(null)}
                            className="px-2 py-1 rounded-lg bg-white/[0.04] text-[10px] text-white/40">
                            Нет
                          </button>
                        </div>
                      ) : (
                        <motion.button onClick={() => setConfirmRevoke(device.id)}
                          className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors" whileTap={{ scale: 0.9 }} title="Отозвать">
                          <Trash2 size={12} className="text-red-400/40" />
                        </motion.button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}