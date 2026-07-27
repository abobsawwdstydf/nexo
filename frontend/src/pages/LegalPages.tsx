import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Shield, FileText, Cookie } from 'lucide-react';

type LegalTab = 'privacy' | 'terms' | 'cookies';

function LegalBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.03, 0.06, 0.03] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[5%] left-[10%] w-[400px] h-[400px] rounded-full bg-white blur-[120px]"
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.02, 0.05, 0.02] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        className="absolute bottom-[10%] right-[5%] w-[350px] h-[350px] rounded-full bg-zinc-400 blur-[100px]"
      />
      <div
        className="absolute inset-0 opacity-[0.01]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}

const navItems: { id: LegalTab; label: string; icon: typeof Shield }[] = [
  { id: 'privacy', label: 'Политика конфиденциальности', icon: Shield },
  { id: 'terms', label: 'Пользовательское соглашение', icon: FileText },
  { id: 'cookies', label: 'Использование Cookie', icon: Cookie },
];

function PrivacyContent() {
  return (
    <div className="space-y-5 text-sm text-white/70 leading-relaxed">
      <h2 className="text-lg font-semibold text-white/90">Политика конфиденциальности</h2>
      <p className="text-xs text-white/40">Последнее обновление: 27 июля 2026 г.</p>

      <Section title="1. Общие положения">
        <p>
          Настоящая Политика конфиденциальности (далее — «Политика») определяет порядок обработки
          и защиты персональных данных пользователей мессенджера «Нексо» (далее — «Сервис»),
          администрируемого ИП Х. (далее — «Администрация»).
        </p>
        <p>
          Используя Сервис, вы выражаете свое безоговорочное согласие с условиями настоящей Политики.
          Если вы не согласны с каким-либо положением Политики, вы обязаны прекратить использование Сервиса.
        </p>
      </Section>

      <Section title="2. Какие данные мы собираем">
        <p>При регистрации и использовании Сервиса мы собираем следующие данные:</p>
        <ul className="list-disc pl-5 space-y-1 text-white/60">
          <li><strong className="text-white/80">Идентификационные данные:</strong> имя пользователя, отображаемое имя, адрес электронной почты, аватар</li>
          <li><strong className="text-white/80">Технические данные:</strong> IP-адрес, тип браузера, операционная система, идентификатор устройства</li>
          <li><strong className="text-white/80">Данные об использовании:</strong> история чатов, отправленные сообщения, медиафайлы, история звонков</li>
          <li><strong className="text-white/80">Cookies и аналогичные технологии:</strong> файлы cookie, localStorage, sessionStorage</li>
        </ul>
      </Section>

      <Section title="3. Правовые основания обработки">
        <p>
          Обработка персональных данных осуществляется на следующих основаниях:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-white/60">
          <li>Согласие пользователя на обработку персональных данных (п. 1 ч. 1 ст. 6 ФЗ-152)</li>
          <li>Исполнение договора — использования Сервиса (п. 5 ч. 1 ст. 6 ФЗ-152)</li>
          <li>Обработка необходима для защиты прав и законных интересов (п. 7 ч. 1 ст. 6 ФЗ-152)</li>
        </ul>
      </Section>

      <Section title="4. Цели сбора данных">
        <ul className="list-disc pl-5 space-y-1 text-white/60">
          <li>Обеспечение функционирования Сервиса (доставка сообщений, управление чатами)</li>
          <li>Идентификация и аутентификация пользователей</li>
          <li>Техническая поддержка и улучшение качества Сервиса</li>
          <li>Предотвращение мошенничества и нарушений</li>
          <li>Соблюдение требований законодательства РФ</li>
        </ul>
      </Section>

      <Section title="5. Хранение и защита данных">
        <p>
          Ваши данные хранятся на защищенных серверах на территории Российской Федерации.
          Мы применяем организационные и технические меры защиты, включая:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-white/60">
          <li>Шифрование данных при передаче (TLS 1.3)</li>
          <li>Шифрование сообщений при хранении (end-to-end encryption для секретных чатов)</li>
          <li>Регулярное резервное копирование</li>
          <li>Контроль доступа к данным</li>
        </ul>
      </Section>

      <Section title="6. Сроки хранения">
        <p>
          Данные хранятся в течение всего срока использования Сервиса. После удаления аккаунта
          данные хранятся не более 30 дней, после чего безвозвратно удаляются. Обезличенные
          аналитические данные могут храниться дольше в агрегированном виде.
        </p>
      </Section>

      <Section title="7. Передача данных третьим лицам">
        <p>
          Мы не передаем персональные данные третьим лицам, за исключением:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-white/60">
          <li>Провайдеров хостинга и облачной инфраструктуры (в рамках обработки данных)</li>
          <li>Правоохранительных органов — по законному запросу в соответствии с законодательством РФ</li>
          <li>С вашего явного согласия</li>
        </ul>
      </Section>

      <Section title="8. Ваши права">
        <p>Вы имеете право:</p>
        <ul className="list-disc pl-5 space-y-1 text-white/60">
          <li>Получить информацию об обработке ваших персональных данных</li>
          <li>Требовать уточнения, блокирования или уничтожения данных</li>
          <li>Отозвать согласие на обработку данных</li>
          <li>Требовать удаления аккаунта и всех связанных данных</li>
          <li>Обжаловать действия Администрации в уполномоченном органе</li>
        </ul>
      </Section>

      <Section title="9. Контактная информация">
        <p>
          По вопросам, связанным с обработкой персональных данных, вы можете обратиться:
        </p>
        <p className="text-white/60">
          Email: privacy@nexo.app<br />
          Или через форму обратной связи в настройках приложения
        </p>
      </Section>

      <Section title="10. Изменения Политики">
        <p>
          Администрация оставляет за собой право вносить изменения в настоящую Политику.
          Новая версия вступает в силу с момента ее публикации. Продолжая использовать Сервис
          после изменений, вы принимаете новую версию Политики.
        </p>
      </Section>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="space-y-5 text-sm text-white/70 leading-relaxed">
      <h2 className="text-lg font-semibold text-white/90">Пользовательское соглашение</h2>
      <p className="text-xs text-white/40">Последнее обновление: 27 июля 2026 г.</p>

      <Section title="1. Термины и определения">
        <p>
          <strong className="text-white/80">Сервис</strong> — мессенджер «Нексо», включая веб-версию, мобильные приложения и API.
        </p>
        <p>
          <strong className="text-white/80">Пользователь</strong> — любое физическое лицо, использующее Сервис.
        </p>
        <p>
          <strong className="text-white/80">Контент</strong> — сообщения, медиафайлы, стикеры, и любая другая информация, передаваемая через Сервис.
        </p>
      </Section>

      <Section title="2. Общие условия">
        <p>
          Используя Сервис, вы подтверждаете, что ознакомились с условиями настоящего Соглашения
          и Политикой конфиденциальности. Если вы не согласны с условиями, вы не имеете права
          использовать Сервис.
        </p>
        <p>
          Сервис предоставляется «как есть» (as is). Администрация не гарантирует бесперебойную
          работу или отсутствие ошибок.
        </p>
      </Section>

      <Section title="3. Регистрация и аккаунт">
        <ul className="list-disc pl-5 space-y-1 text-white/60">
          <li>Вы обязуетесь предоставлять достоверную информацию при регистрации</li>
          <li>Вы несете ответственность за сохранность своих учетных данных</li>
          <li>Запрещена регистрация от имени другого лица</li>
          <li>Один пользователь может иметь только один аккаунт</li>
          <li>Администрация вправе заблокировать аккаунт при нарушении условий</li>
        </ul>
      </Section>

      <Section title="4. Права и обязанности пользователя">
        <p>Вы обязуетесь:</p>
        <ul className="list-disc pl-5 space-y-1 text-white/60">
          <li>Не нарушать законодательство РФ при использовании Сервиса</li>
          <li>Не отправлять спам, не размещать противоправный контент</li>
          <li>Не пытаться взломать или дестабилизировать работу Сервиса</li>
          <li>Не использовать Сервис для распространения вредоносного ПО</li>
          <li>Не нарушать права интеллектуальной собственности</li>
        </ul>
      </Section>

      <Section title="5. Контент пользователя">
        <p>
          Вы сохраняете все права на свой контент. Предоставляя контент через Сервис,
          вы даете Администрации неисключительную лицензию на его хранение и передачу
          другим пользователям в рамках функционирования Сервиса.
        </p>
        <p>
          Администрация не модерирует контент, но вправе удалить его при нарушении
          законодательства или условий Соглашения.
        </p>
      </Section>

      <Section title="6. Ограничение ответственности">
        <p>
          Администрация не несет ответственности за:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-white/60">
          <li>Убытки, связанные с использованием или невозможностью использования Сервиса</li>
          <li>Действия других пользователей</li>
          <li>Содержание передаваемой информации</li>
          <li>Перерывы в работе, связанные с техническими работами или форс-мажором</li>
        </ul>
      </Section>

      <Section title="7. Прекращение использования">
        <p>
          Вы можете в любой момент удалить свой аккаунт через настройки Сервиса.
          Администрация вправе приостановить или прекратить доступ к Сервису
          при нарушении условий Соглашения.
        </p>
      </Section>

      <Section title="8. Применимое право">
        <p>
          Настоящее Соглашение регулируется законодательством Российской Федерации.
          Все споры разрешаются в судебном порядке по месту нахождения Администрации.
        </p>
      </Section>
    </div>
  );
}

function CookiesContent() {
  return (
    <div className="space-y-5 text-sm text-white/70 leading-relaxed">
      <h2 className="text-lg font-semibold text-white/90">Политика использования Cookie</h2>
      <p className="text-xs text-white/40">Последнее обновление: 27 июля 2026 г.</p>

      <Section title="1. Что такое cookie">
        <p>
          Cookie — это небольшие текстовые файлы, которые сохраняются на вашем устройстве
          при посещении веб-сайтов. Они позволяют сайту запоминать ваши действия и предпочтения.
        </p>
      </Section>

      <Section title="2. Какие cookie мы используем">
        <h4 className="text-white/80 font-medium mt-3 mb-1">Необходимые cookie (обязательные)</h4>
        <p className="text-white/60">
          Обеспечивают корректную работу Сервиса: аутентификацию, безопасность,
          загрузку контента. Без них использование Сервиса невозможно.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-white/60 mt-2">
          <li><strong>nexo_access_token</strong> — токен доступа (хранится в localStorage)</li>
          <li><strong>nexo_refresh_token</strong> — токен обновления сессии</li>
          <li><strong>nexo_user</strong> — кэшированные данные пользователя</li>
          <li><strong>nexo_custom_server_url</strong> — настройки пользовательского сервера</li>
        </ul>

        <h4 className="text-white/80 font-medium mt-4 mb-1">Функциональные cookie</h4>
        <p className="text-white/60">
          Запоминают ваши настройки: тему оформления, язык интерфейса, звуковые предпочтения.
        </p>

        <h4 className="text-white/80 font-medium mt-4 mb-1">Аналитические cookie</h4>
        <p className="text-white/60">
          Помогают нам понимать, как используется Сервис, чтобы улучшать его.
          Мы используем минимальный набор метрик без идентификации пользователей.
        </p>
      </Section>

      <Section title="3. Управление cookie">
        <p>
          Вы можете управлять cookie через настройки вашего браузера:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-white/60">
          <li><strong>Chrome:</strong> Настройки → Конфиденциальность → Файлы cookie</li>
          <li><strong>Firefox:</strong> Настройки → Приватность → Куки</li>
          <li><strong>Safari:</strong> Настройки → Конфиденциальность → Файлы cookie</li>
          <li><strong>Edge:</strong> Настройки → Файлы cookie и разрешения</li>
        </ul>
        <p className="mt-2">
          Отключение необходимых cookie может привести к невозможности использования Сервиса.
        </p>
      </Section>

      <Section title="4. Другие технологии">
        <p>
          Помимо cookie, мы используем:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-white/60">
          <li><strong>localStorage / sessionStorage</strong> — для хранения настроек и кэша</li>
          <li><strong>WebSocket</strong> — для real-time сообщений (сессионное соединение)</li>
          <li><strong>Service Workers</strong> — для кэширования и push-уведомлений</li>
        </ul>
      </Section>

      <Section title="5. Согласие">
        <p>
          При первом посещении Сервиса мы запрашиваем ваше согласие на использование cookie.
          Продолжая использование Сервиса, вы подтверждаете свое согласие.
          Вы можете отозвать согласие в любой момент, очистив cookie в настройках браузера.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-white/[0.04] pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left"
      >
        <h3 className="text-sm font-semibold text-white/80 mb-2">{title}</h3>
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface LegalPagesProps {
  initialTab?: LegalTab;
  onBack: () => void;
}

export default function LegalPages({ initialTab = 'privacy', onBack }: LegalPagesProps) {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  return (
    <div className="h-full w-full flex flex-col relative" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <LegalBackground />

      <div className="relative z-10 flex-1 flex flex-col md:flex-row gap-3 p-3 overflow-hidden">
        {/* ─── Sidebar navigation ──────────────────────────────────── */}
        <div className="flex-shrink-0 w-full md:w-64 flex flex-col gap-1 p-2 rounded-2xl liquid-glass-strong overflow-hidden">
          <motion.button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors text-white/50 hover:text-white/80 mb-2"
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <ArrowLeft size={16} />
            <span className="text-xs font-medium">Назад</span>
          </motion.button>

          <div className="text-xs font-semibold text-white/30 uppercase tracking-wider px-3 pb-2">
            Документы
          </div>

          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 text-xs
                ${activeTab === item.id
                  ? 'bg-white/[0.08] text-white/90 border border-white/[0.06]'
                  : 'text-white/50 hover:text-white/70 hover:bg-white/[0.03] border border-transparent'
                }
              `}
            >
              <item.icon size={15} className={activeTab === item.id ? 'text-white/60' : 'text-white/25'} />
              {item.label}
            </button>
          ))}

          <div className="mt-auto pt-4 px-3">
            <p className="text-[10px] text-white/20 leading-relaxed">
              © 2026 Нексо Мессенджер<br />
              Все права защищены
            </p>
          </div>
        </div>

        {/* ─── Content ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 rounded-2xl liquid-glass overflow-hidden">
          <div className="h-full overflow-y-auto px-5 py-6 md:px-8">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === 'privacy' && <PrivacyContent />}
              {activeTab === 'terms' && <TermsContent />}
              {activeTab === 'cookies' && <CookiesContent />}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
