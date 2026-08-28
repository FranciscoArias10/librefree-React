import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppThemeMode = 'light' | 'dark';

// ─── Color Palettes ──────────────────────────────────────────────────────────

export const LightTheme = {
  mode: 'light' as AppThemeMode,
  bg: '#F8FAFC',
  bgCard: '#FFFFFF',
  bgInput: '#FFFFFF',
  bgChip: '#E2E8F0',
  bgChipSelected: '#0F172A',
  bgHeader: '#F8FAFC',
  bgDivider: '#F1F5F9',
  bgBadgeCloud: '#E8F8F0',
  // Text
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textCard: '#1E293B',
  textChip: '#475569',
  textChipSelected: '#FFFFFF',
  // Borders
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  // Accent
  accent: '#3182CE',
  accentText: '#FFFFFF',
  // Icons
  iconDefault: '#475569',
  iconMuted: '#94A3B8',
  // Status bar
  statusBar: 'dark' as 'dark' | 'light',
};

export const DarkTheme = {
  mode: 'dark' as AppThemeMode,
  bg: '#0F172A',
  bgCard: '#1E293B',
  bgInput: '#1E293B',
  bgChip: '#334155',
  bgChipSelected: '#38BDF8',
  bgHeader: '#0F172A',
  bgDivider: '#334155',
  bgBadgeCloud: '#1A3A2A',
  // Text
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textCard: '#F1F5F9',
  textChip: '#CBD5E1',
  textChipSelected: '#0F172A',
  // Borders
  border: '#334155',
  borderLight: '#1E293B',
  // Accent
  accent: '#38BDF8',
  accentText: '#0F172A',
  // Icons
  iconDefault: '#94A3B8',
  iconMuted: '#64748B',
  // Status bar
  statusBar: 'light' as 'dark' | 'light',
};

export type AppTheme = typeof LightTheme;

interface ThemeContextValue {
  theme: AppTheme;
  themeMode: AppThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: AppThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: LightTheme,
  themeMode: 'light',
  toggleTheme: () => {},
  setThemeMode: () => {},
});

const THEME_STORAGE_KEY = '@librefree_theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<AppThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved === 'dark' || saved === 'light') {
          setThemeModeState(saved);
        }
      })
      .catch(() => {});
  }, []);

  const setThemeMode = async (mode: AppThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {}
  };

  const toggleTheme = () => {
    const next = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(next);
  };

  const theme = themeMode === 'dark' ? DarkTheme : LightTheme;

  return (
    <ThemeContext.Provider value={{ theme, themeMode, toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
