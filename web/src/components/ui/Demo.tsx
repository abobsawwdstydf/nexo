import React, { useState } from 'react';
import {
  EnhancedModal,
  AnimatedButton,
  AnimatedText,
  AnimatedInput,
  AnimatedTextarea,
  useToast,
  SyncIndicator,
  AnimatedCard,
  CardGrid,
  FeatureCard,
  StatCard,
  ProfileCard,
} from './index';
import {
  Sparkles,
  Zap,
  Heart,
  Star,
  Users,
  TrendingUp,
  Mail,
  Lock,
  X,
} from 'lucide-react';

export const UIDemo: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const { toasts, remove: removeToast, success, error, info, warning } = useToast();

  const handleSync = () => {
    setSyncStatus('syncing');
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setSyncStatus('success');
          success('Синхронизация завершена!', 'Все данные обновлены');
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  return (
    <div className="min-h-screen bg-surface p-8 space-y-12">
      {/* Header */}
      <div className="text-center space-y-4">
        <AnimatedText
          text="UI Components Demo"
          animation="slide"
          as="h1"
          className="text-5xl font-bold"
          gradient
        />
        <AnimatedText
          text="Современные компоненты с анимациями"
          animation="fade"
          delay={200}
          className="text-xl text-gray-400"
        />
      </div>

      {/* Buttons Section */}
      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-white">
          <span className="bg-gradient-to-r from-nexo-400 to-purple-400 bg-clip-text text-transparent">Кнопки</span>
        </h2>
        
        <div className="flex flex-wrap gap-4">
          <AnimatedButton variant="primary" size="lg" glow>
            Primary Button
          </AnimatedButton>
          
          <AnimatedButton variant="secondary" size="lg">
            Secondary Button
          </AnimatedButton>
          
          <AnimatedButton variant="ghost" size="lg">
            Ghost Button
          </AnimatedButton>
          
          <AnimatedButton variant="danger" size="lg">
            Danger Button
          </AnimatedButton>
          
          <AnimatedButton variant="success" size="lg">
            Success Button
          </AnimatedButton>
          
          <AnimatedButton variant="glass" size="lg">
            Glass Button
          </AnimatedButton>
          
          <AnimatedButton
            variant="primary"
            size="lg"
            icon={<Sparkles className="w-5 h-5" />}
            glow
          >
            With Icon
          </AnimatedButton>
          
          <AnimatedButton
            variant="primary"
            size="lg"
            loading
          >
            Loading...
          </AnimatedButton>
        </div>
      </section>

      {/* Modal Section */}
      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-white">
          <span className="bg-gradient-to-r from-nexo-400 to-purple-400 bg-clip-text text-transparent">Модальные окна</span>
        </h2>
        
        <div className="flex gap-4">
          <AnimatedButton
            variant="primary"
            onClick={() => setIsModalOpen(true)}
          >
            Открыть модалку
          </AnimatedButton>
        </div>

        <EnhancedModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Пример модального окна"
          size="md"
          animation="scale"
        >
          <div className="p-6 space-y-4">
            <p className="text-gray-300">
              Это пример улучшенного модального окна с анимациями и backdrop blur.
            </p>
            
            <AnimatedInput
              label="Email"
              type="email"
              icon={<Mail className="w-5 h-5" />}
              placeholder="example@email.com"
              variant="glass"
            />
            
            <AnimatedInput
              label="Пароль"
              type="password"
              icon={<Lock className="w-5 h-5" />}
              placeholder="••••••••"
              showPasswordToggle
              variant="glass"
            />
            
            <div className="flex gap-3 pt-4">
              <AnimatedButton
                variant="primary"
                className="flex-1"
                glow
              >
                Войти
              </AnimatedButton>
              <AnimatedButton
                variant="ghost"
                className="flex-1"
                onClick={() => setIsModalOpen(false)}
              >
                Отмена
              </AnimatedButton>
            </div>
          </div>
        </EnhancedModal>
      </section>

      {/* Inputs Section */}
      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-white">
          <span className="bg-gradient-to-r from-nexo-400 to-purple-400 bg-clip-text text-transparent">Поля ввода</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          <AnimatedInput
            label="Email"
            type="email"
            icon={<Mail className="w-5 h-5" />}
            placeholder="example@email.com"
            hint="Введите ваш email адрес"
            variant="glass"
          />
          
          <AnimatedInput
            label="Пароль"
            type="password"
            icon={<Lock className="w-5 h-5" />}
            placeholder="••••••••"
            showPasswordToggle
            variant="glass"
          />
          
          <AnimatedInput
            label="С ошибкой"
            type="text"
            error="Это поле обязательно"
            variant="glass"
          />
          
          <AnimatedInput
            label="С успехом"
            type="text"
            success="Отлично!"
            variant="glass"
          />
        </div>
        
        <div className="max-w-4xl">
          <AnimatedTextarea
            label="Сообщение"
            placeholder="Введите ваше сообщение..."
            autoResize
            maxLength={500}
            variant="glass"
          />
        </div>
      </section>

      {/* Toast Section */}
      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-white">
          <span className="bg-gradient-to-r from-nexo-400 to-purple-400 bg-clip-text text-transparent">Уведомления</span>
        </h2>
        
        <div className="flex flex-wrap gap-4">
          <AnimatedButton
            variant="success"
            onClick={() => success('Успешно!', 'Операция выполнена успешно')}
          >
            Success Toast
          </AnimatedButton>
          
          <AnimatedButton
            variant="danger"
            onClick={() => error('Ошибка!', 'Что-то пошло не так')}
          >
            Error Toast
          </AnimatedButton>
          
          <AnimatedButton
            variant="primary"
            onClick={() => info('Информация', 'Это информационное сообщение')}
          >
            Info Toast
          </AnimatedButton>
          
          <AnimatedButton
            variant="secondary"
            onClick={() => warning('Внимание!', 'Это предупреждение')}
          >
            Warning Toast
          </AnimatedButton>
        </div>

        {toasts.map((t) => (
          <div key={t.id} className="fixed top-4 right-4 z-[80] flex flex-col gap-2 pointer-events-none">
            <div className="pointer-events-auto glass-toast border-l-4 rounded-xl p-3.5 shadow-2xl min-w-[300px] max-w-md">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{t.message}</p>
                </div>
                <button onClick={() => removeToast(t.id)} className="p-1 rounded-md text-zinc-500 hover:text-white">
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Sync Section */}
      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-white">
          <span className="bg-gradient-to-r from-nexo-400 to-purple-400 bg-clip-text text-transparent">Синхронизация</span>
        </h2>
        
        <div className="flex flex-wrap gap-6 items-center">
          <SyncIndicator status={syncStatus} showLabel size="lg" />
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 glass-subtle rounded-lg">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs font-medium text-white">Онлайн</span>
          </div>
          
          <AnimatedButton
            variant="primary"
            onClick={handleSync}
            disabled={syncStatus === 'syncing'}
          >
            Запустить синхронизацию
          </AnimatedButton>
        </div>
        
        {syncStatus === 'syncing' && (
          <div className="max-w-md">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300 font-medium">Синхронизация данных</span>
                <span className="text-gray-400 font-mono">{Math.round(progress)}%</span>
              </div>
              <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-nexo-500 to-nexo-400 rounded-full transition-all duration-300 ease-out shadow-lg shadow-nexo-500/50" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Cards Section */}
      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-white">
          <span className="bg-gradient-to-r from-nexo-400 to-purple-400 bg-clip-text text-transparent">Карточки</span>
        </h2>
        
        <CardGrid columns={4} gap="lg">
          <StatCard
            label="Пользователи"
            value="1,234"
            trend="up"
            trendValue="+12%"
            icon={<Users className="w-6 h-6" />}
          />
          
          <StatCard
            label="Лайки"
            value="5,678"
            trend="up"
            trendValue="+8%"
            icon={<Heart className="w-6 h-6" />}
          />
          
          <StatCard
            label="Рейтинг"
            value="4.8"
            trend="neutral"
            trendValue="0%"
            icon={<Star className="w-6 h-6" />}
          />
          
          <StatCard
            label="Конверсия"
            value="3.2%"
            trend="down"
            trendValue="-2%"
            icon={<TrendingUp className="w-6 h-6" />}
          />
        </CardGrid>
        
        <CardGrid columns={3} gap="lg">
          <FeatureCard
            icon={<Zap className="w-8 h-8" />}
            title="Быстро"
            description="Молниеносная скорость работы и отклика"
          />
          
          <FeatureCard
            icon={<Sparkles className="w-8 h-8" />}
            title="Красиво"
            description="Современный дизайн с анимациями"
          />
          
          <FeatureCard
            icon={<Heart className="w-8 h-8" />}
            title="Удобно"
            description="Интуитивный и понятный интерфейс"
          />
        </CardGrid>
        
        <div className="max-w-sm mx-auto">
          <ProfileCard
            avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=demo"
            name="Иван Иванов"
            role="Frontend Developer"
            bio="Создаю красивые и функциональные интерфейсы"
            stats={[
              { label: 'Проекты', value: 42 },
              { label: 'Подписчики', value: 1234 },
              { label: 'Лайки', value: 5678 },
            ]}
            actions={
              <div className="flex gap-2">
                <AnimatedButton variant="primary" className="flex-1" size="sm">
                  Подписаться
                </AnimatedButton>
                <AnimatedButton variant="ghost" className="flex-1" size="sm">
                  Сообщение
                </AnimatedButton>
              </div>
            }
          />
        </div>
      </section>

      {/* Text Animations */}
      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-white">
          <span className="bg-gradient-to-r from-nexo-400 to-purple-400 bg-clip-text text-transparent">Текстовые анимации</span>
        </h2>
        
        <div className="space-y-4">
          <AnimatedText
            text="Fade анимация"
            animation="fade"
            className="text-2xl font-bold text-white"
          />
          
          <AnimatedText
            text="Slide анимация"
            animation="slide"
            className="text-2xl font-bold text-white"
          />
          
          <AnimatedText
            text="Typewriter эффект"
            animation="typewriter"
            className="text-2xl font-bold text-white"
            duration={2000}
          />
          
          <AnimatedText
            text="Wave анимация"
            animation="wave"
            className="text-2xl font-bold text-white"
          />
          
          <div className="text-2xl font-bold bg-gradient-to-r from-nexo-400 to-purple-400 bg-clip-text text-transparent animate-pulse">
            Градиентный анимированный текст
          </div>
        </div>
      </section>

      {/* Different Card Variants */}
      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-white">
          <span className="bg-gradient-to-r from-nexo-400 to-purple-400 bg-clip-text text-transparent">Варианты карточек</span>
        </h2>
        
        <CardGrid columns={2} gap="lg">
          <AnimatedCard variant="default" hover="lift" animation="slide">
            <h3 className="text-xl font-bold text-white mb-2">Default Card</h3>
            <p className="text-gray-400">Стандартная карточка с lift эффектом</p>
          </AnimatedCard>
          
          <AnimatedCard variant="glass" hover="tilt" animation="scale">
            <h3 className="text-xl font-bold text-white mb-2">Glass Card</h3>
            <p className="text-gray-400">Стеклянная карточка с 3D tilt эффектом</p>
          </AnimatedCard>
          
          <AnimatedCard variant="gradient" hover="glow" animation="flip">
            <h3 className="text-xl font-bold text-white mb-2">Gradient Card</h3>
            <p className="text-gray-400">Градиентная карточка с glow эффектом</p>
          </AnimatedCard>
          
          <AnimatedCard variant="neon" hover="scale" animation="fade">
            <h3 className="text-xl font-bold text-white mb-2">Neon Card</h3>
            <p className="text-gray-400">Неоновая карточка с scale эффектом</p>
          </AnimatedCard>
        </CardGrid>
      </section>
    </div>
  );
};

export default UIDemo;
