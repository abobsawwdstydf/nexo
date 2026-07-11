import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Smartphone, Monitor, Tablet, X, LogOut, 
  ChevronRight, Check, AlertTriangle, Globe 
} from 'lucide-react';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n';

interface Device {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  addedAt: string;
}

interface DevicesTabProps {
  onClose: () => void;
}

export default function DevicesTab({ onClose }: DevicesTabProps) {
  const { t } = useLang();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const data = await api.getDevices();
      setDevices(data || []);
    } catch {
      setDevices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const terminateDevice = async (deviceId: string) => {
    setTerminatingId(deviceId);
    try {
      await api.terminateDevice(deviceId);
      setDevices(prev => prev.filter(d => d.id !== deviceId));
    } catch {
      setDevices(prev => prev.filter(d => d.id !== deviceId));
    } finally {
      setTerminatingId(null);
    }
  };

  const terminateAll = async () => {
    if (!confirm('Завершить все сессии кроме текущей?')) return;
    try {
      await api.terminateAllDevices();
      setDevices(prev => prev.filter(d => d.isCurrent));
    } catch {
      setDevices(prev => prev.filter(d => d.isCurrent));
    }
  };

  const getDeviceIcon = (os: string) => {
    if (os.toLowerCase().includes('iphone') || os.toLowerCase().includes('ios') || os.toLowerCase().includes('android')) {
      return <Smartphone size={20} className="text-nexo-400" />;
    }
    if (os.toLowerCase().includes('ipad') || os.toLowerCase().includes('tablet')) {
      return <Tablet size={20} className="text-nexo-400" />;
    }
    return <Monitor size={20} className="text-nexo-400" />;
  };

  const getSessionTypeLabel = (device: Device) => {
    if (device.isCurrent) return 'Текущая сессия';
    const lastActive = new Date(device.lastActive);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - lastActive.getTime()) / 60000);
    if (diffMins < 5) return 'Активна сейчас';
    if (diffMins < 60) return 'Недавно активна';
    return 'Неактивна';
  };

  const getSessionTypeColor = (device: Device) => {
    if (device.isCurrent) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25';
    const lastActive = new Date(device.lastActive);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - lastActive.getTime()) / 60000);
    if (diffMins < 5) return 'text-blue-400 bg-blue-500/15 border-blue-500/25';
    if (diffMins < 60) return 'text-amber-400 bg-amber-500/15 border-amber-500/25';
    return 'text-zinc-400 bg-zinc-500/15 border-zinc-500/25';
  };

  const formatLastActive = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Сейчас';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    return `${diffDays} дн. назад`;
  };

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-50 flex flex-col"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-surface/95 backdrop-blur-3xl backdrop-saturate-150" />
      
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-nexo-500/10 via-transparent to-purple-500/5 pointer-events-none" />
      
      {/* Border top shine */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.08] flex-shrink-0">
          <button onClick={onClose} className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
            <X size={20} />
          </button>
          <h3 className="text-sm font-semibold text-white flex-1">Устройства</h3>
          <button 
            onClick={terminateAll}
            className="text-xs text-red-400 hover:text-red-300 font-medium px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-all"
          >
            Завершить все
          </button>
        </div>

        {/* Info */}
        <div className="px-4 py-3 bg-nexo-500/10 border-b border-nexo-500/20">
          <p className="text-xs text-zinc-400">
            Здесь показаны все устройства, на которых выполнен вход в ваш аккаунт
          </p>
        </div>

        {/* Devices List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                <Smartphone size={32} className="opacity-50" />
              </div>
              <p className="text-sm">Нет активных устройств</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {devices.map(device => (
                <motion.div
                  key={device.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4 py-4 hover:bg-white/[0.04] transition-all group"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 group-hover:bg-white/[0.1] transition-all">
                      {getDeviceIcon(device.os)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">{device.deviceName}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${getSessionTypeColor(device)}`}>
                          {getSessionTypeLabel(device)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {device.browser} • {device.os}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Globe size={10} className="text-nexo-400" />
                          {device.location}
                        </span>
                        <span>IP: {device.ip}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Последняя активность: {formatLastActive(device.lastActive)}
                      </p>
                    </div>

                    {/* Action */}
                    {!device.isCurrent && (
                      <button
                        onClick={() => terminateDevice(device.id)}
                        disabled={terminatingId === device.id}
                        className="p-2.5 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0 group/btn"
                      >
                        {terminatingId === device.id ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <LogOut size={16} />
                        )}
                      </button>
                    )}
                    {device.isCurrent && (
                      <div className="p-2.5 text-emerald-400">
                        <Check size={16} />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.02]">
          <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-amber-400/70" />
            Если видите незнакомое устройство — завершите его сессию и смените пароль
          </p>
        </div>
      </div>
    </motion.div>
  );
}
