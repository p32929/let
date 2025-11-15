import { useColorScheme } from 'nativewind';
import { colors, type ColorScheme } from './colors';

/**
 * Hook to get theme-aware colors for React Native
 * Use this instead of Tailwind classes when you need dynamic theme colors
 */
export function useThemeColors() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scheme: ColorScheme = isDark ? 'dark' : 'light';

  return {
    colors: colors[scheme],
    isDark,
    scheme,
  };
}

/**
 * Get a specific color value based on current theme
 */
export function useThemeColor(colorName: keyof typeof colors.light) {
  const { colors: themeColors } = useThemeColors();
  return themeColors[colorName];
}
