import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as React from 'react';
import { storage } from '@/lib/storage';
import { syncReminderOnLaunch } from '@/lib/notifications';
import { ErrorBoundary as CustomErrorBoundary } from '@/components/ErrorBoundary';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const systemColorScheme = useSystemColorScheme();
  const { colorScheme, setColorScheme } = useColorScheme();

  const activeColorScheme = colorScheme ?? systemColorScheme ?? 'light';
  const isDark = activeColorScheme === 'dark';

  // Restore the user's saved theme choice on launch so it survives app restarts.
  React.useEffect(() => {
    (async () => {
      try {
        const saved = await storage.getItem('color-scheme');
        if (saved === 'light' || saved === 'dark') {
          setColorScheme(saved);
        }
      } catch {
        // Non-fatal: fall back to the system theme.
      }
      // Re-arm the daily reminder (if the user has it on) after a restart.
      syncReminderOnLaunch().catch(() => {});
    })();
  }, []);

  return (
    <CustomErrorBoundary>
      <KeyboardProvider>
        <GestureHandlerRootView
          style={{ flex: 1, backgroundColor: isDark ? '#0a0a0a' : '#ffffff' }}
        >
          <ThemeProvider value={NAV_THEME[activeColorScheme]}>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={isDark ? '#0a0a0a' : '#ffffff'} />
            <Stack
              screenOptions={{
                headerStyle: {
                  backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
                },
                headerTintColor: isDark ? '#fafafa' : '#0a0a0a',
                contentStyle: {
                  backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
                },
              }}
            />
            <PortalHost />
          </ThemeProvider>
        </GestureHandlerRootView>
      </KeyboardProvider>
    </CustomErrorBoundary>
  );
}
