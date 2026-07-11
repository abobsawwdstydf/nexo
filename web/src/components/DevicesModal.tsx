import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Monitor, Tablet, Globe, MapPin, Clock, LogOut, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useToastStore } from '../stores/toastStore';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Device {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  platform?: string;
  ipAddress?: string;
  userAgent?: string;
  lastActive: string;
  createdAt: string;
  isCurrent?: boolean;
}

interface DevicesModalProps {
  onClose: () => void;
}

export default function DevicesModal({ onClose }: DevicesModalProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const { success, error } = useToastStore();

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const data = await api.get('/devices');
      setDevices(data || []);
    } catch (err) {
      error('Не удалось загрузить устройства');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async (deviceId: string) => {
    if (!confirm('Выйти с этого устройства?')) return;
    
    try {
      await api.post(`/devices/${deviceId}/logout`, {});
      success('Устройство отключено');
      loadDevices();
    } catch (err) {
      error('Не удалось отключить устройство');
    }
  };

  const getDeviceIcon = (type: string, platform?: string) => {
    if (type === 'mobile' || platform?.toLowerCase().includes('android') || platform?.toLowerCase().includes('ios')) {
      return <Smartphone className="w-5 h-5" />;
    }
    if (type === 'tablet' || platform?.toLowerCase().includes('ipad')) {
      return <Tablet className="w-5 h-5" />;
    }
    return <Monitor className="w-5 h-5" />;
  };

  const getPlatformEmoji = (platform?: string) => {
    if (!platform) return '🖥️';
    const p = platform.toLowerCase();
    if (p.includes('windows')) return '🪟';
    if (p.includes('mac') || p.includes('ios')) return '🍎';
    if (p.includes('linux')) return '🐧';
    if (p.includes('android')) return '🤖';
    return '🖥️';
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl"
        >
          {/* Liquid glass background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[rgba(18,18,24,0.92)] via-[rgba(12,12,18,0.95)] to-[rgba(20,20,28,0.93)] backdrop-blur-3xl backdrop-saturate-150" />
          
          {/* Glow effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/5 pointer-events-none" />
          
          {/* Border shine */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          
          {/* Content */}
          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Smartphone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Устройства</h2>
                  <p className="text-sm text-zinc-400">Управление активными сессиями</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-88px)]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : devices.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-10 h-10 text-zinc-600" />
                  </div>
                  <p className="text-zinc-400">Нет активных устройств</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {devices.map((device) => (
                    <motion.div
                      key={device.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-2xl border transition-all ${
                        device.isCurrent
                          ? 'bg-gradient-to-br from-purple-500/15 to-blue-500/15 border-purple-500/30'
                          : 'bg-white/[0.04] border-white/[0.08] hover:border-white/[0.12] hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          {/* Icon */}
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                            device.isCurrent
                              ? 'bg-gradient-to-br from-purple-500 to-blue-600'
                              : 'bg-white/[0.08] border border-white/[0.1]'
                          }`}>
                            {getDeviceIcon(device.deviceType, device.platform)}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-white truncate">
                                {device.deviceName}
                              </h3>
                              {device.isCurrent && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                                  Текущее
                                </span>
                              )}
                            </div>

                            {/* Platform */}
                            {device.platform && (
                              <div className="flex items-center gap-1.5 text-sm text-zinc-400 mb-2">
                                <span>{getPlatformEmoji(device.platform)}</span>
                                <span>{device.platform}</span>
                              </div>
                            )}

                            {/* IP Address */}
                            {device.ipAddress && (
                              <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                                <Globe className="w-3.5 h-3.5 text-nexo-400" />
                                <span>{device.ipAddress}</span>
                              </div>
                            )}

                            {/* Last Active */}
                            <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                              <Clock className="w-3.5 h-3.5 text-nexo-400" />
                              <span>
                                Активно: {formatDistanceToNow(new Date(device.lastActive), { addSuffix: true, locale: ru })}
                              </span>
                            </div>

                            {/* Created At */}
                            <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>
                                Подключено: {formatDistanceToNow(new Date(device.createdAt), { addSuffix: true, locale: ru })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Logout Button */}
                        {!device.isCurrent && (
                          <button
                            onClick={() => handleLogout(device.deviceId)}
                            className="p-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 transition-all group"
                            title="Выйти с устройства"
                          >
                            <LogOut className="w-4 h-4 text-zinc-400 group-hover:text-red-400" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
