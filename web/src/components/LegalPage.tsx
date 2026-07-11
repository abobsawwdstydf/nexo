import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

interface LegalPageProps {
  onClose: () => void;
  type: 'terms' | 'privacy';
}

export default function LegalPage({ onClose, type }: LegalPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col bg-surface"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-semibold text-white flex-1">
          {type === 'terms' ? 'Пользовательское соглашение' : 'Политика конфиденциальности'}
        </h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-2xl mx-auto prose prose-invert">
          {type === 'terms' ? (
            <>
              <h1 className="text-2xl font-bold gradient-text mb-6">Пользовательское соглашение</h1>
              <p className="text-zinc-500 text-sm mb-6">Последнее обновление: 4 апреля 2026 г.</p>

              <h2 className="text-lg font-semibold text-white mt-6 mb-3">1. Общие положения</h2>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                Настоящее Пользовательское соглашение (далее — «Соглашение») является юридически обязывающим документом, 
                регулирующим отношения между Нексо Мессенджер (далее — «Сервис») и пользователем (далее — «Пользователь»). 
                Используя Сервис, Пользователь принимает все условия настоящего Соглашения.
              </p>

              <h2 className="text-lg font-semibold text-white mt-6 mb-3">2. Регистрация и аккаунт</h2>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                2.1. Для использования Сервиса Пользователь должен пройти процедуру регистрации, указав username и пароль.
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                2.2. Пользователь несёт ответственность за сохранность своих учётных данных и за все действия, 
                совершённые с использованием его аккаунта.
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                2.3. Минимальный возраст для регистрации — 5 лет. Пользователи младше 5 лет не могут использовать Сервис.
              </p>

              <h2 className="text-lg font-semibold text-white mt-6 mb-3">3. Использование Сервиса</h2>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                3.1. Сервис предоставляет возможность обмена текстовыми сообщениями, голосовыми и видеозвонками, 
                отправкой файлов и медиафайлов.
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                3.2. Все файлы хранятся на защищённых серверах Нексо с распределённой системой хранения, что обеспечивает надёжность и безопасность.
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                3.3. Запрещается использование Сервиса для рассылки спама, мошенничества, распространения вредоносного ПО 
                или любой другой незаконной деятельности.
              </p>

              <h2 className="text-lg font-semibold text-white mt-6 mb-3">4. Контент Пользователя</h2>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                4.1. Пользователь сохраняет все права на контент, который он создаёт и отправляет через Сервис.
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                4.2. Пользователь гарантирует, что его контент не нарушает права третьих лиц и не содержит 
                незаконных материалов.
              </p>

              <h2 className="text-lg font-semibold text-white mt-6 mb-3">5. Ограничение ответственности</h2>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                5.1. Сервис предоставляется «как есть». Администрация не гарантирует бесперебойную работу Сервиса 
                и не несёт ответственности за любые убытки, возникшие в результате использования Сервиса.
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                5.2. Администрация оставляет за собой право изменять, приостанавливать или прекращать работу Сервиса 
                в любое время без предварительного уведомления.
              </p>

              <h2 className="text-lg font-semibold text-white mt-6 mb-3">6. Блокировка аккаунта</h2>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                6.1. Администрация вправе заблокировать аккаунт Пользователя при нарушении условий настоящего Соглашения.
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                6.2. Блокировка может быть временной или постоянной в зависимости от тяжести нарушения.
              </p>

              <h2 className="text-lg font-semibold text-white mt-6 mb-3">7. Заключительные положения</h2>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                7.1. Настоящее Соглашение вступает в силу с момента регистрации Пользователя и действует до момента 
                удаления аккаунта.
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                7.2. Администрация вправе вносить изменения в Соглашение. Продолжение использования Сервиса после 
                изменений означает согласие с новой редакцией.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold gradient-text mb-6">Политика конфиденциальности</h1>
              <p className="text-zinc-500 text-sm mb-6">Последнее обновление: 4 апреля 2026 г.</p>

              <h2 className="text-lg font-semibold text-white mt-6 mb-3">1. Сбор информации</h2>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                1.1. При регистрации Сервис собирает: username, отображаемое имя, пароль (в хешированном виде), 
                дату рождения (опционально), био (опционально).
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                1.2. Сервис автоматически собирает: IP-адрес, информацию об устройстве и браузере, данные об активности 
                (время входа, последний онлайн).
              </p>

              <h2 className="text-lg font-semibold text-white mt-6 mb-3">2. Хранение данных</h2>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                2.1. Все данные хранятся в защищённой базе данных с использованием шифрования при передаче (SSL).
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                2.2. Файлы (сообщения, медиа, документы) хранятся в распределённой системе хранения Нексо.
                Файлы разбиваются на чанки и распределяются по нескольким серверам для обеспечения надёжности.
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                2.3. Сессии пользователей кэшируются для обеспечения быстрой работы Сервиса.
              </p>

              <h2 className="text-lg font-semibold text-white mt-6 mb-3">3. Использование информации</h2>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                3.1. Собранная информация используется исключительно для:
              </p>
              <ul className="text-zinc-300 text-sm leading-relaxed mb-4 list-disc pl-6">
                <li>Аутентификации и авторизации Пользователя</li>
                <li>Обеспечения работы мессенджера (обмен сообщениями, звонки)</li>
                <li>Улучшения качества Сервиса</li>
                <li>Предотвращения мошенничества и обеспечения безопасности</li>
              </ul>

              <h2 className="text-lg font-semibold text-white mt-6 mb-3">4. Передача данных третьим лицам</h2>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                4.1. Сервис не передаёт персональные данные Пользователей третьим лицам, за исключением случаев, 
                предусмотренных законодательством.
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                4.2. Файлы хранятся в защищенной распределенной системе хранения данных, что обеспечивает высокую надежность и доступность.
              </p>

              <h2 className="text-lg font-semibold text-white mt-6 mb-3">5. Права Пользователя</h2>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                5.1. Пользователь вправе запросить удаление своего аккаунта и всех связанных с ним данных.
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                5.2. Пользователь вправе изменить или удалить свою персональную информацию в настройках аккаунта.
              </p>

              <h2 className="text-lg font-semibold text-white mt-6 mb-3">6. Безопасность</h2>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                6.1. Пароли хранятся в хешированном виде с использованием bcrypt.
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                6.2. Все соединения защищены с использованием TLS/SSL шифрования.
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                6.3. JWT-токены используются для аутентификации API-запросов с ограниченным сроком действия.
              </p>

              <h2 className="text-lg font-semibold text-white mt-6 mb-3">7. Изменения политики</h2>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                7.1. Администрация вправе вносить изменения в настоящую Политику конфиденциальности.
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                7.2. О существенных изменениях Пользователи будут уведомлены через Сервис.
              </p>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
