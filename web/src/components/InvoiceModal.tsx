import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, Receipt, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';

interface InvoiceItem {
  name: string;
  price: number;
}

interface InvoiceModalProps {
  chatId: string;
  onClose: () => void;
}

export default function InvoiceModal({ chatId, onClose }: InvoiceModalProps) {
  const [items, setItems] = useState<InvoiceItem[]>([{ name: '', price: 0 }]);
  const [recipientUsername, setRecipientUsername] = useState('');
  const [isSending, setIsSending] = useState(false);

  const addItem = () => {
    setItems([...items, { name: '', price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: 'name' | 'price', value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const totalAmount = items.reduce((sum, item) => sum + (item.price || 0), 0);

  const handleSend = async () => {
    // Validate
    if (items.some(item => !item.name.trim() || item.price <= 0)) {
      alert('Заполните все поля');
      return;
    }

    if (totalAmount <= 0) {
      alert('Сумма должна быть больше 0');
      return;
    }

    try {
      setIsSending(true);
      
      // Create invoice
      const invoice = await api.post('/invoices', {
        chatId,
        items,
        recipientUsername: recipientUsername.trim() || null,
      });

      // Send as message
      const socket = getSocket();
      if (socket) {
        socket.emit('send_message', {
          chatId,
          content: `Счёт на оплату: ${totalAmount} бобров`,
          type: 'invoice',
          metadata: {
            invoiceId: invoice.id,
            items: invoice.items,
            totalAmount: invoice.totalAmount,
          },
        });
      }

      onClose();
    } catch (e) {
      console.error('Failed to create invoice:', e);
      alert('Ошибка создания счёта');
    } finally {
      setIsSending(false);
    }
  };

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
        className="fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[500px] sm:max-w-[calc(100%-32px)] sm:max-h-[80vh] bg-surface-secondary/95 backdrop-blur-xl rounded-none sm:rounded-2xl border-0 sm:border sm:border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Receipt size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Создать счёт</h2>
              <p className="text-xs text-zinc-500">Выставить счёт на оплату</p>
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
          {/* Recipient (optional) */}
          <div className="mb-4">
            <label className="block text-sm text-zinc-400 mb-2">
              Получатель (опционально)
            </label>
            <input
              type="text"
              value={recipientUsername}
              onChange={e => setRecipientUsername(e.target.value)}
              placeholder="@username"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-tertiary border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500 transition-colors"
            />
            <p className="text-xs text-zinc-600 mt-1">
              Если не указан, счёт может оплатить любой участник чата
            </p>
          </div>

          {/* Items */}
          <div className="mb-4">
            <label className="block text-sm text-zinc-400 mb-2">Товары/услуги</label>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={e => updateItem(index, 'name', e.target.value)}
                    placeholder="Название"
                    className="flex-1 px-3 py-2 rounded-xl bg-surface-tertiary border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500 transition-colors text-sm"
                  />
                  <div className="relative w-32">
                    <input
                      type="number"
                      value={item.price || ''}
                      onChange={e => updateItem(index, 'price', parseInt(e.target.value) || 0)}
                      placeholder="0"
                      min="0"
                      className="w-full px-3 py-2 pr-8 rounded-xl bg-surface-tertiary border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500 transition-colors text-sm"
                    />
                   
                  </div>
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(index)}
                      className="w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addItem}
              className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors text-sm"
            >
              <Plus size={16} />
              Добавить позицию
            </button>
          </div>

          {/* Total */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Итого:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-bold text-white">{totalAmount}</span>
               
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10">
          <button
            onClick={handleSend}
            disabled={isSending || totalAmount <= 0 || items.some(i => !i.name.trim())}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Receipt size={18} />
                Отправить счёт
              </>
            )}
          </button>
        </div>
      </motion.div>
    </>
  );
}
