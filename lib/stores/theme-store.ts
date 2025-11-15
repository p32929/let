import { create } from 'zustand';
import { useColorScheme as useNativeColorScheme } from 'nativewind';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeStore {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  themeMode: 'system',
  setThemeMode: (mode) => {
    set({ themeMode: mode });
    // Store preference in localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme-mode', mode);
    }
  },
}));

// Hook to apply theme
export function useTheme() {
  const { themeMode } = useThemeStore();
  const { colorScheme, setColorScheme } = useNativeColorScheme();

  // Load saved theme on mount
  if (typeof localStorage !== 'undefined') {
    const savedTheme = localStorage.getItem('theme-mode') as ThemeMode;
    if (savedTheme && savedTheme !== themeMode) {
      useThemeStore.getState().setThemeMode(savedTheme);
    }
  }

  // Apply theme based on mode
  if (themeMode === 'system') {
    // Use system preference
    const systemScheme = window?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    if (colorScheme !== systemScheme) {
      setColorScheme(systemScheme);
    }
  } else {
    if (colorScheme !== themeMode) {
      setColorScheme(themeMode);
    }
  }

  return { themeMode, colorScheme };
}
