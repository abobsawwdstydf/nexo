import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Crown, Sparkles, Check, Gift, CreditCard, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { NexoLoader } from '../components/LoadingStates';
import { fadeInUp, scaleInBounce } from '../lib/animations';

interface PremiumStatus {
  isPremium: boolean;
  premiumUntil: string | null;
}

interface PremiumPageProps {
  onClose: () => void;
}

const PREMIUM_PERIODS = [
  { months: 1, price: 99, label: '1 месяц', period: 'monthly' },
  { months: 3, price: 249, label: '3 месяца', period: 'quarterly', discount: 17 },
  { months: 6, price: 449, label: '6 месяцев', period: 'half-year', discount: 25 },
  { months: 12, price: 799, label: '1 год', period: 'yearly', discount: 33 },
];

const PREMIUM_FEATURES = [
  { icon: Sparkles, text: 'Неограниченное облачное хранилище', desc: 'Храните файлы без ограничений' },
  { icon: Crown, text: 'Эксклюзивный значок Нексо НУче', desc: 'Выделяйтесь среди других пользователей' },
];

export default function PremiumPage({ onClose }: PremiumPageProps) {
  const { user } = useAuthStore();
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  const [showFeatures, setShowFeatures] = useState(true);
  const [giftUserId, setGiftUserId] = useState('');
  const [isGift, setIsGift] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await api.getPremiumStatus();
      setStatus(data);
    } catch (error) {
      console.error('Failed to load premium status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!status) return;

    const selectedPrice = PREMIUM_PERIODS.find(p => p.months === selectedPeriod);
    if (!selectedPrice) return;

    const confirmMsg = isGift && giftUserId
      ? `Подарить Нексо НУче (${selectedPrice.label}) пользователю за ${selectedPrice.price} ₽?`
      : `Купить Нексо НУче (${selectedPrice.label}) за ${selectedPrice.price} ₽?`;

    if (!confirm(confirmMsg)) return;

    setPurchasing(true);
    try {
      const paymentData: { type: 'premium' | 'premium_gift'; premiumMonths: number; giftToUserId?: string } = {
        type: isGift && giftUserId ? 'premium_gift' : 'premium',
        premiumMonths: selectedPeriod,
      };

      if (isGift && giftUserId) {
        paymentData.giftToUserId = giftUserId;
      }

      const result = await api.createPayment(paymentData);

      if (result.confirmationUrl) {
        window.location.href = result.confirmationUrl;
      }
    } catch (error: any) {
      console.error('Payment failed:', error);
      alert(error.message || 'Ошибка создания платежа');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]"
      >
        <NexoLoader size="lg" />
      </motion.div>
    );
  }

  const isPremiumActive = status?.isPremium && status.premiumUntil && new Date(status.premiumUntil) > new Date();
  const selectedPrice = PREMIUM_PERIODS.find(p => p.months === selectedPeriod);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <motion.div
        {...scaleInBounce}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-strong rounded-3xl scrollbar-hide"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 glass-strong border-b border-white/10">
          <div className="flex items-center gap-3 px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                <Crown size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-white truncate">Нексо НУче</h2>
                <p className="text-xs sm:text-sm text-zinc-400 truncate">Разблокируйте все возможности</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl glass-btn text-zinc-400 hover:text-white transition-colors flex-shrink-0"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Current Status */}
          {isPremiumActive && (
            <motion.div {...fadeInUp} className="glass-card p-4 sm:p-6 rounded-2xl border-2 border-yellow-500/30">
              <div className="flex items-center gap-3 mb-2">
                <Crown size={20} className="text-yellow-500 flex-shrink-0" />
                <h3 className="text-base sm:text-lg font-bold text-white">Нексо НУче активен</h3>
              </div>
              <p className="text-sm text-zinc-400">
                Действует до: {new Date(status!.premiumUntil!).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </motion.div>
          )}

          {/* Pricing Cards */}
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Выберите подписку</h3>
            <div className="space-y-2 sm:space-y-3">
              {PREMIUM_PERIODS.map(({ months, price, label, discount }) => (
                <motion.button
                  key={months}
                  {...fadeInUp}
                  onClick={() => setSelectedPeriod(months)}
                  className={`w-full glass-card p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all relative ${
                    selectedPeriod === months
                      ? 'ring-2 ring-yellow-500 bg-yellow-500/10'
                      : 'hover:bg-white/5'
                  }`}
                >
                  {discount && discount > 0 && (
                    <div className="absolute top-2 right-2 px-1.5 sm:px-2 py-0.5 rounded-lg bg-green-500/20 text-green-400 text-[10px] sm:text-xs font-bold">
                      -{discount}%
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm sm:text-base font-bold text-white mb-1">{label}</p>
                      <p className="text-lg sm:text-xl font-bold text-yellow-500 flex items-center gap-1">
                        {price} ₽
                      </p>
                    </div>
                    {selectedPeriod === months && (
                      <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div>
            <button
              onClick={() => setShowFeatures(!showFeatures)}
              className="w-full flex items-center justify-between mb-3 sm:mb-4 group"
            >
              <h3 className="text-base sm:text-lg font-bold text-white">Возможности Нексо НУче</h3>
              <motion.div
                animate={{ rotate: showFeatures ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-zinc-400 group-hover:text-white transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.div>
            </button>
            
            <AnimatePresence>
              {showFeatures && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3 overflow-hidden"
                >
                  {PREMIUM_FEATURES.map((feature, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="glass-card p-4 rounded-xl hover:bg-white/5 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <feature.icon size={18} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm sm:text-base font-semibold text-white mb-1">{feature.text}</p>
                          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{feature.desc}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Gift toggle */}
          <div>
            <button
              onClick={() => setIsGift(!isGift)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                isGift ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-white/10 bg-white/5 hover:bg-white/8'
              }`}
            >
              <div className="flex items-center gap-3">
                <Gift size={20} className="text-yellow-400" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Подарить другу</p>
                  <p className="text-xs text-zinc-400">Оплати — у друга появится подписка</p>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full transition-all relative ${isGift ? 'bg-yellow-500' : 'bg-zinc-700'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isGift ? 'left-5' : 'left-1'}`} />
              </div>
            </button>
            {isGift && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 overflow-hidden"
              >
                <input
                  type="text"
                  value={giftUserId}
                  onChange={e => setGiftUserId(e.target.value)}
                  placeholder="Username друга"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-500/50 text-sm"
                />
              </motion.div>
            )}
          </div>

          {/* Purchase Button */}
          <div className="space-y-3">
            <motion.button
              {...fadeInUp}
              onClick={handlePurchase}
              disabled={purchasing || (isGift && !giftUserId)}
              className="w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-bold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:shadow-yellow-500/30 transition-all flex items-center justify-center gap-2"
            >
              {purchasing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Создание платежа...</span>
                </>
              ) : (
                <>
                  <CreditCard size={18} />
                  <span className="truncate">
                    {isGift
                      ? `Подарить за ${selectedPrice?.price} ₽`
                      : `Купить за ${selectedPrice?.price} ₽`
                    }
                  </span>
                  <ExternalLink size={14} />
                </>
              )}
            </motion.button>
            <p className="text-[11px] text-zinc-500 text-center">
              Оплата через YooKassa. Безопасно и быстро.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
