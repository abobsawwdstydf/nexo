import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light' | 'amoled' | 'midnight';
export type ColorScheme = 'default' | 'blue' | 'purple' | 'green' | 'red' | 'orange' | 'pink' | 'teal' | 'yellow' | 'indigo' | 'cyan' | 'rose' | 'emerald' | 'amber' | 'slate' | 'custom';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type Density = 'compact' | 'comfortable' | 'spacious';

interface ChatBackground {
  chatId: string;
  type: 'color' | 'gradient' | 'image';
  value: string;
}

interface ThemeState {
  // Тема
  mode: ThemeMode;
  colorScheme: ColorScheme;
  customColor: string; // hex color for 'custom' scheme
  
  // Шрифт
  fontSize: FontSize;
  
  // Плотность
  density: Density;
  
  // Фоны чатов
  chatBackgrounds: ChatBackground[];
  
  // Действия
  setMode: (mode: ThemeMode) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setCustomColor: (color: string) => void;
  setFontSize: (size: FontSize) => void;
  setDensity: (density: Density) => void;
  setChatBackground: (chatId: string, type: 'color' | 'gradient' | 'image', value: string) => void;
  removeChatBackground: (chatId: string) => void;
  getChatBackground: (chatId: string) => ChatBackground | undefined;
  exportTheme: () => string;
  importTheme: (json: string) => boolean;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      colorScheme: 'default',
      customColor: '#6366f1',
      fontSize: 'medium',
      density: 'comfortable',
      chatBackgrounds: [],

      setMode: (mode) => {
        set({ mode });
        applyTheme(mode, get().colorScheme, get().fontSize, get().density, get().customColor);
      },

      setColorScheme: (colorScheme) => {
        set({ colorScheme });
        applyTheme(get().mode, colorScheme, get().fontSize, get().density, get().customColor);
      },

      setCustomColor: (customColor) => {
        set({ customColor });
        if (get().colorScheme === 'custom') {
          applyTheme(get().mode, 'custom', get().fontSize, get().density, customColor);
        }
      },

      setFontSize: (fontSize) => {
        set({ fontSize });
        applyTheme(get().mode, get().colorScheme, fontSize, get().density, get().customColor);
      },

      setDensity: (density) => {
        set({ density });
        applyTheme(get().mode, get().colorScheme, get().fontSize, density, get().customColor);
      },

      setChatBackground: (chatId, type, value) => {
        set((state) => ({
          chatBackgrounds: [
            ...state.chatBackgrounds.filter((bg) => bg.chatId !== chatId),
            { chatId, type, value },
          ],
        }));
      },

      removeChatBackground: (chatId) => {
        set((state) => ({
          chatBackgrounds: state.chatBackgrounds.filter((bg) => bg.chatId !== chatId),
        }));
      },

      getChatBackground: (chatId) => {
        return get().chatBackgrounds.find((bg) => bg.chatId === chatId);
      },

      exportTheme: () => {
        const s = get();
        return JSON.stringify({
          mode: s.mode,
          colorScheme: s.colorScheme,
          customColor: s.customColor,
          fontSize: s.fontSize,
          density: s.density,
        }, null, 2);
      },

      importTheme: (json: string) => {
        try {
          const data = JSON.parse(json);
          const updates: Partial<ThemeState> = {};
          if (data.mode && ['dark', 'light', 'amoled', 'midnight'].includes(data.mode)) updates.mode = data.mode;
          if (data.colorScheme) updates.colorScheme = data.colorScheme;
          if (data.customColor) updates.customColor = data.customColor;
          if (data.fontSize && ['small', 'medium', 'large', 'xlarge'].includes(data.fontSize)) updates.fontSize = data.fontSize;
          if (data.density && ['compact', 'comfortable', 'spacious'].includes(data.density)) updates.density = data.density;
          set(updates);
          applyTheme(
            updates.mode || get().mode,
            updates.colorScheme || get().colorScheme,
            updates.fontSize || get().fontSize,
            updates.density || get().density,
            updates.customColor || get().customColor
          );
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'nexo-theme',
    }
  )
);

// Применение темы к DOM
function applyTheme(mode: ThemeMode, colorScheme: ColorScheme, fontSize: FontSize, density: Density, customColor?: string) {
  const root = document.documentElement;

  // Режим темы
  root.setAttribute('data-theme', mode);

  // Цветовая схема
  root.setAttribute('data-color-scheme', colorScheme);

  // Кастомный цвет
  if (colorScheme === 'custom' && customColor) {
    root.style.setProperty('--nexo-custom-color', customColor);
    const hex = customColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    root.style.setProperty('--nexo-custom-rgb', `${r}, ${g}, ${b}`);
  }

  // Размер шрифта
  const fontSizes = {
    small: '14px',
    medium: '16px',
    large: '18px',
    xlarge: '20px',
  };
  root.style.fontSize = fontSizes[fontSize];

  // Плотность
  const densities = {
    compact: '0.8',
    comfortable: '1',
    spacious: '1.2',
  };
  root.style.setProperty('--density', densities[density]);
}

// Инициализация темы при загрузке
if (typeof window !== 'undefined') {
  const state = useThemeStore.getState();
  applyTheme(state.mode, state.colorScheme, state.fontSize, state.density, state.customColor);
}
