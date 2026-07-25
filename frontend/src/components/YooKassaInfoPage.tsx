import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, Shield, CreditCard, CheckCircle } from 'lucide-react';

interface YooMoneyInfoPageProps {
  onClose: () => void;
}

export default function YooMoneyInfoPage({ onClose }: YooMoneyInfoPageProps) {
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-2xl mx-auto prose prose-invert">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <CreditCard size={24} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text mb-0">Пополнение бобров</h1>
              <p className="text-zinc-500 text-sm mt-1">Через платёжную систему YooKassa</p>
            </div>
          </div>

          <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Shield size={20} className="text-violet-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-violet-300 mb-1">Безопасные платежи</p>
                <p className="text-xs text-zinc-400">
                  Все платежи обрабатываются через защищённую платёжную систему YooKassa.
                  Мы не храним данные ваших банковских карт.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-white mt-6 mb-3">Что такое бобры?</h2>
          <p className="text-zinc-300 text-sm leading-relaxed mb-4">
            Бобры — это внутренняя валюта Нексо. Они используются для:
          </p>
          <ul className="text-zinc-300 text-sm leading-relaxed mb-4 list-disc pl-6 space-y-1">
            <li>Покупки Нексо НУче</li>
            <li>Подписки на платные каналы</li>
            <li>Отправки подарков другим пользователям</li>
            <li>Доступа к эксклюзивным функциям</li>
          </ul>
          <p className="text-zinc-300 text-sm leading-relaxed mb-4">
            <strong>1 бобёр = 1 рубль</strong>. Минимальная сумма пополнения — 10 бобров (10 ₽).
          </p>

          <h2 className="text-lg font-semibold text-white mt-6 mb-3">Как пополнить баланс?</h2>
          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="w-6 h-6 rounded-full bg-nexo-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-nexo-400">
                1
              </div>
              <div>
                <p className="text-sm font-medium text-white mb-1">Откройте кошелёк</p>
                <p className="text-xs text-zinc-400">
                  Нажмите на иконку кошелька в меню или в настройках профиля
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="w-6 h-6 rounded-full bg-nexo-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-nexo-400">
                2
              </div>
              <div>
                <p className="text-sm font-medium text-white mb-1">Выберите сумму</p>
                <p className="text-xs text-zinc-400">
                  Укажите количество бобров для пополнения (минимум 10)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="w-6 h-6 rounded-full bg-nexo-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-nexo-400">
                3
              </div>
              <div>
                <p className="text-sm font-medium text-white mb-1">Оплатите через YooKassa</p>
                <p className="text-xs text-zinc-400">
                  Вы будете перенаправлены на защищённую страницу оплаты YooKassa
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={14} className="text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white mb-1">Получите бобров</p>
                <p className="text-xs text-zinc-400">
                  После успешной оплаты бобры будут зачислены автоматически в течение нескольких секунд
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-white mt-6 mb-3">Способы оплаты</h2>
          <p className="text-zinc-300 text-sm leading-relaxed mb-4">
            YooKassa поддерживает следующие способы оплаты:
          </p>
          <ul className="text-zinc-300 text-sm leading-relaxed mb-4 list-disc pl-6 space-y-1">
            <li>Банковские карты (Visa, Mastercard, МИР)</li>
            <li>Кошелёк YooKassa</li>
            <li>Мобильный баланс</li>
            <li>Интернет-банкинг</li>
            <li>СБП (Система быстрых платежей)</li>
          </ul>

          <h2 className="text-lg font-semibold text-white mt-6 mb-3">Возврат средств</h2>
          <p className="text-zinc-300 text-sm leading-relaxed mb-4">
            Бобры являются виртуальной валютой и не подлежат возврату после пополнения.
            Однако, если произошла ошибка при зачислении, свяжитесь с нами через раздел поддержки.
          </p>

          <h2 className="text-lg font-semibold text-white mt-6 mb-3">Безопасность</h2>
          <p className="text-zinc-300 text-sm leading-relaxed mb-4">
            Все платежи обрабатываются через защищённое соединение (HTTPS). YooKassa — лицензированная
            платёжная система, соответствующая стандартам PCI DSS. Мы не имеем доступа к данным ваших
            банковских карт.
          </p>

          <h2 className="text-lg font-semibold text-white mt-6 mb-3">Контакты</h2>
          <p className="text-zinc-300 text-sm leading-relaxed mb-4">
            Если у вас возникли вопросы или проблемы с пополнением, свяжитесь с нами:
          </p>
          <ul className="text-zinc-300 text-sm leading-relaxed mb-4 list-none pl-0 space-y-2">
            <li className="flex items-center gap-2">
              <span className="text-zinc-500">Email:</span>
              <a href="mailto:nexo.su.support@gmail.com" className="text-nexo-400 hover:text-nexo-300 transition-colors">
                nexo.su.support@gmail.com
              </a>
            </li>
          </ul>

          <h2 className="text-lg font-semibold text-white mt-6 mb-3">Реквизиты продавца</h2>
          <ul className="text-zinc-400 text-xs leading-relaxed mb-4 list-none pl-0 space-y-1">
            <li><span className="text-zinc-500">Наименование:</span> Замякин Денис Витальевич</li>
            <li><span className="text-zinc-500">ИНН:</span> 226911329166</li>
            <li><span className="text-zinc-500">Статус:</span> Физическое лицо / самозанятый</li>
          </ul>

          <div className="mt-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-300/80 leading-relaxed">
              <strong>Важно:</strong> Бобры не являются реальными деньгами и не могут быть обменяны на
              реальную валюту. Они используются исключительно внутри Нексо для доступа к
              дополнительным функциям и контенту.
            </p>
          </div>

          <div className="mt-6 text-center">
            <a
              href="https://yookassa.ru"
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
    </motion.div>
  );
}
