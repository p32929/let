/**
 * Theme colors for light and dark modes
 * Used for inline styles when Tailwind dark mode doesn't work properly on React Native
 */

export const colors = {
  light: {
    background: '#ffffff',
    foreground: '#0a0a0a',
    card: '#ffffff',
    cardForeground: '#0a0a0a',
    popover: '#ffffff',
    popoverForeground: '#0a0a0a',
    primary: '#171717',
    primaryForeground: '#fafafa',
    secondary: '#f5f5f5',
    secondaryForeground: '#171717',
    muted: '#f5f5f5',
    mutedForeground: '#737373',
    accent: '#f5f5f5',
    accentForeground: '#171717',
    destructive: '#ef4444',
    destructiveForeground: '#fafafa',
    border: '#e5e5e5',
    input: '#e5e5e5',
    ring: '#a1a1a1',
  },
  dark: {
    background: '#0a0a0a',
    foreground: '#fafafa',
    card: '#0a0a0a',
    cardForeground: '#fafafa',
    popover: '#0a0a0a',
    popoverForeground: '#fafafa',
    primary: '#fafafa',
    primaryForeground: '#171717',
    secondary: '#262626',
    secondaryForeground: '#fafafa',
    muted: '#262626',
    mutedForeground: '#a3a3a3',
    accent: '#262626',
    accentForeground: '#fafafa',
    destructive: '#dc2626',
    destructiveForeground: '#fafafa',
    border: '#262626',
    input: '#262626',
    ring: '#737373',
  },
};

export type ColorScheme = 'light' | 'dark';

/**
 * Get color value based on current theme
 */
export function getThemeColor(colorName: keyof typeof colors.light, scheme: ColorScheme = 'light'): string {
  return colors[scheme][colorName];
}

/**
 * Get theme-aware class name for NativeWind
 * On web this uses dark: variant, on native it returns empty string (use inline styles instead)
 */
export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
