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
import { ErrorBoundary as CustomErrorBoundary } from '@/components/ErrorBoundary';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const systemColorScheme = useSystemColorScheme();
  const { colorScheme } = useColorScheme();

  const activeColorScheme = colorScheme ?? systemColorScheme ?? 'light';
  const isDark = activeColorScheme === 'dark';

  console.log('[Theme] Current scheme:', { activeColorScheme, isDark, colorScheme, systemColorScheme });

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
