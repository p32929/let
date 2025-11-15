import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as React from 'react';
import { storage } from '@/lib/storage';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const systemColorScheme = useSystemColorScheme();
  const { colorScheme, setColorScheme } = useColorScheme();

  // Initialize with system theme on first load
  React.useEffect(() => {
    const initializeTheme = async () => {
      // Check if user has manually set a theme preference
      const storedTheme = await storage.getItem('nativewind-color-scheme');

      if (!storedTheme && systemColorScheme) {
        // No stored preference, use system theme
        setColorScheme(systemColorScheme);
      }
    };

    initializeTheme();
  }, []);

  // Update when system theme changes (if no manual override)
  React.useEffect(() => {
    const checkTheme = async () => {
      const storedTheme = await storage.getItem('nativewind-color-scheme');
      if (!storedTheme && systemColorScheme) {
        setColorScheme(systemColorScheme);
      }
    };
    checkTheme();
  }, [systemColorScheme]);

  const activeColorScheme = colorScheme ?? systemColorScheme ?? 'light';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={NAV_THEME[activeColorScheme]}>
        <StatusBar style={activeColorScheme === 'dark' ? 'light' : 'dark'} />
        <Stack />
        <PortalHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
