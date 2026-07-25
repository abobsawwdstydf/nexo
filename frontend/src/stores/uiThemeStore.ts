import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SidebarTheme = 'default' | 'glass' | 'minimal' | 'compact';
export type CallTheme = 'default' | 'gradient' | 'dark' | 'neon';
export type WindowTheme = 'default' | 'glass' | 'solid' | 'blur';
export type AccentColor = 'nexo' | 'purple' | 'blue' | 'green' | 'orange' | 'pink' | 'red';

export interface UIThemeSettings {
  // Sidebar themes
  sidebarTheme: SidebarTheme;
  sidebarWidth: 'narrow' | 'normal' | 'wide';
  showSidebarIcons: boolean;
  showSidebarAvatars: boolean;
  
  // Call themes
  callTheme: CallTheme;
  callBackground: 'none' | 'gradient' | 'image' | 'video';
  callBackgroundUrl: string | null;
  
  // Window themes
  windowTheme: WindowTheme;
  windowBorderRadius: 'none' | 'small' | 'medium' | 'large';
  windowShadow: 'none' | 'small' | 'medium' | 'large';
  
  // Colors
  accentColor: AccentColor;
  customAccentColor: string | null;
  
  // Animations
  enableAnimations: boolean;
  animationSpeed: 'slow' | 'normal' | 'fast';
  
  // Density
  compactMode: boolean;
  
  // Sync
  syncThemes: boolean;
  
  // Actions
  setSidebarTheme: (theme: SidebarTheme) => void;
  setSidebarWidth: (width: 'narrow' | 'normal' | 'wide') => void;
  setShowSidebarIcons: (show: boolean) => void;
  setShowSidebarAvatars: (show: boolean) => void;
  setCallTheme: (theme: CallTheme) => void;
  setCallBackground: (bg: 'none' | 'gradient' | 'image' | 'video') => void;
  setCallBackgroundUrl: (url: string | null) => void;
  setWindowTheme: (theme: WindowTheme) => void;
  setWindowBorderRadius: (radius: 'none' | 'small' | 'medium' | 'large') => void;
  setWindowShadow: (shadow: 'none' | 'small' | 'medium' | 'large') => void;
  setAccentColor: (color: AccentColor) => void;
  setCustomAccentColor: (color: string | null) => void;
  setEnableAnimations: (enabled: boolean) => void;
  setAnimationSpeed: (speed: 'slow' | 'normal' | 'fast') => void;
  setCompactMode: (enabled: boolean) => void;
  setSyncThemes: (enabled: boolean) => void;
}

export const useUIThemeStore = create<UIThemeSettings>()(
  persist(
    (set) => ({
      // Sidebar defaults
      sidebarTheme: 'default',
      sidebarWidth: 'normal',
      showSidebarIcons: true,
      showSidebarAvatars: true,
      
      // Call defaults
      callTheme: 'gradient',
      callBackground: 'gradient',
      callBackgroundUrl: null,
      
      // Window defaults
      windowTheme: 'glass',
      windowBorderRadius: 'large',
      windowShadow: 'medium',
      
      // Color defaults
      accentColor: 'nexo',
      customAccentColor: null,
      
      // Animation defaults
      enableAnimations: true,
      animationSpeed: 'normal',
      
      // Density
      compactMode: false,
      
      // Sync
      syncThemes: false,
      
      // Actions
      setSidebarTheme: (theme) => set({ sidebarTheme: theme }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setShowSidebarIcons: (show) => set({ showSidebarIcons: show }),
      setShowSidebarAvatars: (show) => set({ showSidebarAvatars: show }),
      setCallTheme: (theme) => set({ callTheme: theme }),
      setCallBackground: (bg) => set({ callBackground: bg }),
      setCallBackgroundUrl: (url) => set({ callBackgroundUrl: url }),
      setWindowTheme: (theme) => set({ windowTheme: theme }),
      setWindowBorderRadius: (radius) => set({ windowBorderRadius: radius }),
      setWindowShadow: (shadow) => set({ windowShadow: shadow }),
      setAccentColor: (color) => set({ accentColor: color }),
      setCustomAccentColor: (color) => set({ customAccentColor: color }),
      setEnableAnimations: (enabled) => set({ enableAnimations: enabled }),
      setAnimationSpeed: (speed) => set({ animationSpeed: speed }),
      setCompactMode: (enabled) => set({ compactMode: enabled }),
      setSyncThemes: (enabled) => set({ syncThemes: enabled }),
    }),
    {
      name: 'nexo-ui-theme',
      partialize: (state) => ({
        sidebarTheme: state.sidebarTheme,
        sidebarWidth: state.sidebarWidth,
        showSidebarIcons: state.showSidebarIcons,
        showSidebarAvatars: state.showSidebarAvatars,
        callTheme: state.callTheme,
        callBackground: state.callBackground,
        callBackgroundUrl: state.callBackgroundUrl,
        windowTheme: state.windowTheme,
        windowBorderRadius: state.windowBorderRadius,
        windowShadow: state.windowShadow,
        accentColor: state.accentColor,
        customAccentColor: state.customAccentColor,
        enableAnimations: state.enableAnimations,
        animationSpeed: state.animationSpeed,
        compactMode: state.compactMode,
        syncThemes: state.syncThemes,
      }),
    }
  )
);
