import { useState, useRef, ReactNode } from 'react';
import { Sun, Moon, Palette, Type, Layout, Image, Check, Pipette, Download, Upload } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';
import { useToastStore } from '../stores/toastStore';
import { Card, CardHeader, Button, Text, Badge, cn } from './ui';

const COLOR_SCHEMES = [
  { id: 'default', name: 'Индиго', color: '#6366f1' },
  { id: 'blue', name: 'Синий', color: '#3b82f6' },
  { id: 'purple', name: 'Фиолетовый', color: '#a855f7' },
  { id: 'green', name: 'Зелёный', color: '#22c55e' },
  { id: 'red', name: 'Красный', color: '#ef4444' },
  { id: 'orange', name: 'Оранжевый', color: '#f97316' },
  { id: 'pink', name: 'Розовый', color: '#ec4899' },
  { id: 'teal', name: 'Бирюзовый', color: '#14b8a6' },
  { id: 'yellow', name: 'Жёлтый', color: '#eab308' },
  { id: 'custom', name: 'Свой цвет', color: '#6366f1' },
] as const;

const BACKGROUNDS = [
  { id: 'default', name: 'По умолчанию', preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'blue', name: 'Синий', preview: 'linear-gradient(135deg, #667eea 0%, #4c63d2 100%)' },
  { id: 'purple', name: 'Фиолетовый', preview: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' },
  { id: 'green', name: 'Зелёный', preview: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)' },
  { id: 'sunset', name: 'Закат', preview: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)' },
  { id: 'ocean', name: 'Океан', preview: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)' },
  { id: 'forest', name: 'Лес', preview: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  { id: 'night', name: 'Ночь', preview: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
] as const;

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-8 h-8 rounded-lg bg-nexo-500/15 border border-nexo-500/20 flex items-center justify-center text-nexo-400">
        {icon}
      </div>
      <Text variant="h4" color="primary">{title}</Text>
    </div>
  );
}

interface OptionButtonProps<T extends string> {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  columns?: 2 | 3 | 4;
}

function OptionButton<T extends string>({ active, onClick, children }: OptionButtonProps<T>) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'p-3 rounded-xl border text-left transition-all duration-200',
        'active:scale-[0.97]',
        active
          ? 'bg-nexo-500/15 border-nexo-500/50 text-white'
          : 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:bg-white/[0.08] hover:text-white hover:border-white/[0.14]'
      )}
    >
      {children}
    </button>
  );
}

export default function ThemeSettings() {
  const { mode, colorScheme, fontSize, density, customColor, setMode, setColorScheme, setFontSize, setDensity, setCustomColor, exportTheme, importTheme } = useThemeStore();
  const { success, error: showError } = useToastStore();
  const [selectedBg, setSelectedBg] = useState('default');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = exportTheme();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexo-theme.json';
    a.click();
    URL.revokeObjectURL(url);
    success('Тема экспортирована!');
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const ok = importTheme(text);
      if (ok) success('Тема импортирована!');
      else showError('Ошибка чтения файла. Убедитесь, что файл — корректный JSON-файл темы.');
    };
    reader.onerror = () => showError('Ошибка чтения файла');
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Режим темы */}
      <section>
        <SectionHeader icon={mode === 'dark' ? <Moon size={16} /> : <Sun size={16} />} title="Режим темы" />
        <div className="grid grid-cols-2 gap-2">
          <OptionButton active={mode === 'dark'} onClick={() => setMode('dark')}>
            <Moon size={20} className="mx-auto mb-1.5" />
            <div className="text-xs font-medium text-center">Тёмная</div>
          </OptionButton>
          <OptionButton active={mode === 'light'} onClick={() => setMode('light')}>
            <Sun size={20} className="mx-auto mb-1.5" />
            <div className="text-xs font-medium text-center">Светлая</div>
          </OptionButton>
        </div>
      </section>

      {/* Цветовая схема */}
      <section>
        <SectionHeader icon={<Palette size={16} />} title="Цветовая схема" />
        <div className="grid grid-cols-3 gap-2">
          {COLOR_SCHEMES.map((scheme) => {
            const isActive = colorScheme === scheme.id;
            const color = scheme.id === 'custom' ? customColor : scheme.color;
            return (
              <button
                key={scheme.id}
                onClick={() => {
                  setColorScheme(scheme.id as any);
                  if (scheme.id === 'custom') setShowColorPicker(true);
                }}
                className={cn(
                  'relative p-3 rounded-xl border transition-all duration-200 active:scale-[0.97]',
                  isActive
                    ? 'border-white/20 bg-white/[0.04]'
                    : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.14]'
                )}
                style={{
                  backgroundColor: isActive ? color + '20' : undefined,
                  borderColor: isActive ? color : undefined,
                }}
              >
                {scheme.id === 'custom' ? (
                  <div
                    className="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center border-2 border-dashed border-white/30"
                    style={{ backgroundColor: customColor }}
                  >
                    <Pipette size={12} className="text-white/70" />
                  </div>
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg mx-auto mb-1.5"
                    style={{ backgroundColor: scheme.color }}
                  />
                )}
                <div className="text-xs font-medium text-white">{scheme.name}</div>
                {isActive && (
                  <div
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-md"
                  >
                    <Check size={12} style={{ color }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {colorScheme === 'custom' && (
          <Card variant="subtle" padding="sm" className="mt-3 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex-shrink-0 border border-white/20"
              style={{ backgroundColor: customColor }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-400 mb-1">Свой цвет акцента</p>
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-full h-8 rounded-lg cursor-pointer bg-transparent border-0 outline-none"
              />
            </div>
            <Badge variant="default" size="sm" className="font-mono">{customColor}</Badge>
          </Card>
        )}
      </section>

      {/* Размер шрифта */}
      <section>
        <SectionHeader icon={<Type size={16} />} title="Размер шрифта" />
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'small', label: 'Маленький', size: '14px' },
            { id: 'medium', label: 'Средний', size: '16px' },
            { id: 'large', label: 'Большой', size: '18px' },
          ].map((opt) => (
            <OptionButton key={opt.id} active={fontSize === opt.id} onClick={() => setFontSize(opt.id as any)}>
              <div className="text-xs font-medium mb-0.5">{opt.label}</div>
              <div className="text-[10px] text-zinc-500">{opt.size}</div>
            </OptionButton>
          ))}
        </div>
      </section>

      {/* Плотность */}
      <section>
        <SectionHeader icon={<Layout size={16} />} title="Плотность интерфейса" />
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'compact', label: 'Компактный' },
            { id: 'comfortable', label: 'Комфортный' },
            { id: 'spacious', label: 'Просторный' },
          ].map((opt) => (
            <OptionButton key={opt.id} active={density === opt.id} onClick={() => setDensity(opt.id as any)}>
              <div className="text-xs font-medium">{opt.label}</div>
            </OptionButton>
          ))}
        </div>
      </section>

      {/* Фоны для чатов */}
      <section>
        <SectionHeader icon={<Image size={16} />} title="Фон для чатов" />
        <div className="grid grid-cols-4 gap-2">
          {BACKGROUNDS.map((bg) => (
            <button
              key={bg.id}
              onClick={() => setSelectedBg(bg.id)}
              className={cn(
                'aspect-square rounded-xl border-2 transition-all duration-200 relative overflow-hidden',
                'active:scale-95',
                selectedBg === bg.id
                  ? 'border-nexo-500 scale-105 shadow-lg shadow-nexo-500/30'
                  : 'border-white/10 hover:border-white/20'
              )}
              style={{ background: bg.preview }}
              title={bg.name}
            >
              {selectedBg === bg.id && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Check size={20} className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
        <Text variant="caption" color="muted" className="mt-2 block">
          Фон будет применён к текущему чату
        </Text>
      </section>

      {/* Импорт/Экспорт темы */}
      <section>
        <SectionHeader icon={<Palette size={16} />} title="Импорт/Экспорт темы" />
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={handleExport} icon={<Download size={16} />}>
            Экспорт
          </Button>
          <Button variant="secondary" onClick={handleImportClick} icon={<Upload size={16} />}>
            Импорт
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </section>
    </div>
  );
}
