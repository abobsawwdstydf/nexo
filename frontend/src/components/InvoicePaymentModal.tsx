import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Receipt, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { getSocket } from '../lib/socket';

interface InvoiceItem {
  name: string;
  price: number;
}

interface Invoice {
  id: string;
  items: InvoiceItem[];
  totalAmount: number;
  creatorId: string;
  creator?: {
    username: string;
    displayName?: string;
  };
}

interface InvoicePaymentModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function InvoicePaymentModal({ invoice, onClose, onSuccess }: InvoicePaymentModalProps) {
  const { user } = useAuthStore();
  const [isPaying, setIsPaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(invoice.items.length <= 3);

  const handlePay = async () => {
    if (!user) return;

    // Check balance
    if ((user.beavers || 0) < invoice.totalAmount) {
      alert('Недостаточно бобров на балансе');
      return;
    }

    if (!confirm(`Оплатить ${invoice.totalAmount} бобров?`)) {
      return;
    }

    try {
      setIsPaying(true);
      
      await api.post(`/invoices/${invoice.id}/pay`, {});

      // Notify via socket
      const socket = getSocket();
      if (socket) {
        socket.emit('invoice_paid', {
          invoiceId: invoice.id,
          payerId: user.id,
          creatorId: invoice.creatorId,
          amount: invoice.totalAmount,
        });
      }

      alert('Счёт оплачен!');
      onSuccess?.();
      onClose();
    } catch (e) {
      console.error('Failed to pay invoice:', e);
      alert('Ошибка оплаты счёта');
    } finally {
      setIsPaying(false);
    }
  };

  const creatorName = invoice.creator?.displayName || invoice.creator?.username || 'Пользователь';

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[450px] sm:max-w-[calc(100%-32px)] bg-surface-secondary/95 backdrop-blur-xl rounded-none sm:rounded-2xl border-0 sm:border sm:border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
              <Receipt size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Оплата счёта</h2>
              <p className="text-xs text-zinc-500">От {creatorName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Items list */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-zinc-400">Товары/услуги</label>
              {invoice.items.length > 3 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 text-xs text-nexo-400 hover:text-nexo-300 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      Свернуть <ChevronUp size={14} />
                    </>
                  ) : (
                    <>
                      Развернуть <ChevronDown size={14} />
                    </>
                  )}
                </button>
              )}
            </div>
            
            <div className={`space-y-2 ${!isExpanded && invoice.items.length > 3 ? 'max-h-32 overflow-hidden relative' : ''}`}>
              {invoice.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-tertiary/50"
                >
                  <span className="text-sm text-white">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold text-white">{item.price}</span>
                   
                  </div>
                </div>
              ))}
              
              {!isExpanded && invoice.items.length > 3 && (
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-surface-secondary/80 pointer-events-none" />
              )}
            </div>
          </div>

          {/* Total */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-400">Итого к оплате:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-bold text-white">{invoice.totalAmount}</span>
               
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Ваш баланс:</span>
              <div className="flex items-center gap-1">
                <span className={`font-semibold ${(user?.beavers || 0) >= invoice.totalAmount ? 'text-emerald-400' : 'text-red-400'}`}>
                  {user?.beavers || 0}
                </span>
               
              </div>
            </div>
          </div>

          {/* Insufficient balance warning */}
          {(user?.beavers || 0) < invoice.totalAmount && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
              <p className="text-sm text-red-400">
                Недостаточно бобров на балансе. Пополните баланс в кошельке.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10">
          <button
            onClick={handlePay}
            disabled={isPaying || (user?.beavers || 0) < invoice.totalAmount}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPaying ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Оплата...
              </>
            ) : (
              <>
                <Receipt size={18} />
                Оплатить {invoice.totalAmount}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </>
  );
}
