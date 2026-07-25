import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, Shield, CreditCard, CheckCircle, Coins, HelpCircle, AlertTriangle, Mail, Send, Zap, Lock, Gift, Sparkles } from 'lucide-react';

interface YooKassaInfoPageProps {
  onClose?: () => void;
  standalone?: boolean;
}

export default function YooKassaInfoPage({ onClose, standalone }: YooKassaInfoPageProps) {
  const content = (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#0a0a0f] via-[#0f0f14] to-[#0a0a0f]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600/20 via-purple-600/10 to-transparent border border-violet-500/20 p-8 sm:p-12">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 to-transparent pointer-events-none" />
          <div className="relative flex items-center gap-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/30">
              <Coins size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-white via-violet-200 to-purple-300 bg-clip-text text-transparent">Пополнение бобров</h1>
              <p className="text-sm text-zinc-400 leading-relaxed">Безопасные платежи через YooKassa</p>
            </div>
          </div>
        </div>

        {/* Security banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3">
            <Lock size={20} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-300 mb-1">Защита данных</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                HTTPS + PCI DSS
              </p>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3">
            <Zap size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-300 mb-1">Мгновенно</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Бобры за секунды
              </p>
            </div>
          </div>
          <div className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-violet-500/20 rounded-2xl p-4 flex items-start gap-3">
            <Shield size={20} className="text-violet-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-violet-300 mb-1">Надёжно</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                YooKassa лицензирована
              </p>
            </div>
          </div>
        </div>

        {/* What are beavers */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Coins size={20} className="text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Что такое бобры?</h2>
          </div>
          <p className="text-zinc-300 text-base leading-relaxed mb-6">
            Бобры — это внутренняя валюта Нексо Мессенджера. Используйте их для премиум-функций и подарков.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: '👑', text: 'Нексо НУче', color: 'from-amber-500/20 to-orange-500/10' },
              { icon: '📺', text: 'Платные каналы', color: 'from-blue-500/20 to-cyan-500/10' },
              { icon: '🎁', text: 'Подарки друзьям', color: 'from-pink-500/20 to-rose-500/10' },
              { icon: '✨', text: 'Эксклюзив', color: 'from-purple-500/20 to-violet-500/10' },
            ].map((item, i) => (
              <div key={i} className={`bg-gradient-to-br ${item.color} border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:border-white/20 transition-colors`}>
                <span className="text-3xl">{item.icon}</span>
                <span className="text-sm font-medium text-zinc-200">{item.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/30">
            <p className="text-sm text-amber-200 font-semibold flex items-center gap-2">
              <Zap size={16} />
              1 бобёр = 1 рубль • Минимум 10 бобров (10 ₽)
            </p>
          </div>
        </section>

        {/* How to top up */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle size={20} className="text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Как пополнить?</h2>
          </div>
          <div className="space-y-4">
            {[
              {
                step: '1',
                title: 'Откройте кошелёк',
                desc: 'Нажмите на иконку кошелька в меню',
                icon: '💰',
              },
              {
                step: '2',
                title: 'Выберите сумму',
                desc: 'Минимум 10 бобров (10 ₽)',
                icon: '💵',
              },
              {
                step: '3',
                title: 'Оплатите',
                desc: 'Защищённая страница YooKassa',
                icon: '🔒',
              },
              {
                step: '✓',
                title: 'Готово!',
                desc: 'Бобры зачислены за секунды',
                icon: '✨',
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10 hover:border-white/20 transition-colors">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-nexo-500/30 to-purple-600/30 flex-shrink-0 text-lg font-bold text-white">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-white mb-1">{item.title}</p>
                  <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Payment methods */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <CreditCard size={20} className="text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Способы оплаты</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: '💳', text: 'Банковские карты', sub: 'Visa, Mastercard, МИР' },
              { icon: '💰', text: 'Кошелёк YooMoney', sub: 'Быстро и удобно' },
              { icon: '📱', text: 'Мобильный баланс', sub: 'Со счёта оператора' },
              { icon: '🏦', text: 'Интернет-банкинг', sub: 'Через ваш банк' },
            ].map((method, i) => (
              <div key={i} className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{method.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{method.text}</p>
                    <p className="text-xs text-zinc-400">{method.sub}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Refund policy */}
        <section>
          <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 to-red-500/5 border border-orange-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-orange-300 mb-2">Возврат средств</h3>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Бобры — виртуальная валюта и не подлежат возврату. Если произошла ошибка при зачислении, свяжитесь с поддержкой.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security */}
        <section>
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-green-500/5 border border-emerald-500/20">
            <div className="flex items-start gap-3">
              <Shield size={20} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-emerald-300 mb-2">Безопасность платежей</h3>
                <ul className="text-sm text-zinc-300 space-y-1">
                  <li>✓ Защищённое соединение HTTPS</li>
                  <li>✓ YooKassa лицензирована и соответствует PCI DSS</li>
                  <li>✓ Мы не имеем доступа к данным карт</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Contacts */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-nexo-500/20 flex items-center justify-center">
              <Mail size={20} className="text-nexo-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Поддержка</h2>
          </div>
          <p className="text-zinc-300 text-base leading-relaxed mb-4">
            Возникли вопросы? Свяжитесь с нами:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="mailto:nexo.su.support@gmail.com"
              className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-nexo-500/10 to-purple-600/5 border border-nexo-500/20 hover:border-nexo-500/40 transition-colors group"
            >
              <div className="w-12 h-12 rounded-xl bg-nexo-500/20 flex items-center justify-center group-hover:bg-nexo-500/30 transition-colors">
                <Mail size={20} className="text-nexo-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Email</p>
                <p className="text-sm font-medium text-nexo-400 group-hover:text-nexo-300 transition-colors">nexo.su.support@gmail.com</p>
              </div>
            </a>
          </div>
        </section>

        {/* Seller details */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Реквизиты продавца</h2>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Наименование:</span>
              <span className="text-zinc-300">Замякин Денис Витальевич</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">ИНН:</span>
              <span className="text-zinc-300 font-mono">226911329166</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Статус:</span>
              <span className="text-zinc-300">Физическое лицо / самозанятый</span>
            </div>
          </div>
        </section>

        {/* Important notice */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-300/80 leading-relaxed">
            <strong>Важно:</strong> Бобры не являются реальными деньгами и не могут быть обменяны на
            реальную валюту. Они используются исключительно внутри Нексо Мессенджера для доступа к
            дополнительным функциям и контенту.
          </p>
        </div>

        {/* YooMoney link */}
        <div className="text-center pb-4">
          <a
            href="https://yoomoney.ru"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            Узнать больше о YooKassa
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );

  // Standalone page mode (accessed via /yookassainfo)
  if (standalone) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0f0f14] flex-shrink-0">
          <button
            onClick={() => window.history.back()}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h3 className="text-sm font-semibold text-white flex-1">Пополнение через YooKassa</h3>
        </div>
        {content}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col bg-surface"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-semibold text-white flex-1">Пополнение через YooKassa</h3>
      </div>
      {content}
    </motion.div>
  );
}
