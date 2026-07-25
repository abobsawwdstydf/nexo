import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowLeft, Crown } from 'lucide-react';

export default function PaymentSuccessPage() {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setStatus(params.get('status'));
  }, []);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="w-full max-w-md bg-surface rounded-3xl border border-white/10 shadow-2xl p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', damping: 15, stiffness: 400 }}
          className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle size={40} className="text-emerald-400" />
        </motion.div>

        <h1 className="text-2xl font-bold text-white mb-2">РћРїР»Р°С‚Р° РїСЂРѕС€Р»Р°!</h1>
        <p className="text-zinc-400 text-sm mb-6">
          Р’Р°С€Р° РїРѕРґРїРёСЃРєР° РќРµРєСЃРѕ РќРЈС‡Рµ Р°РєС‚РёРІРёСЂРѕРІР°РЅР°
        </p>

        <div className="flex items-center justify-center gap-2 mb-6 px-4 py-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
          <Crown size={18} className="text-yellow-400" />
          <span className="text-yellow-300 font-semibold">РќРµРєСЃРѕ РќРЈС‡Рµ Р°РєС‚РёРІРµРЅ</span>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => window.location.href = '/'}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-nexo-500 to-purple-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            Р’РµСЂРЅСѓС‚СЊСЃСЏ РІ РќРµРєСЃРѕ
          </button>
        </div>
      </motion.div>
    </div>
  );
}
