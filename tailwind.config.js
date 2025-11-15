const { hairlineWidth } = require('nativewind/theme');

const colors = {
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

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: ({ colors: defaultColors }) => ({
        ...defaultColors,
        border: colors.light.border,
        input: colors.light.input,
        ring: colors.light.ring,
        background: colors.light.background,
        foreground: colors.light.foreground,
        primary: {
          DEFAULT: colors.light.primary,
          foreground: colors.light.primaryForeground,
        },
        secondary: {
          DEFAULT: colors.light.secondary,
          foreground: colors.light.secondaryForeground,
        },
        destructive: {
          DEFAULT: colors.light.destructive,
          foreground: colors.light.destructiveForeground,
        },
        muted: {
          DEFAULT: colors.light.muted,
          foreground: colors.light.mutedForeground,
        },
        accent: {
          DEFAULT: colors.light.accent,
          foreground: colors.light.accentForeground,
        },
        popover: {
          DEFAULT: colors.light.popover,
          foreground: colors.light.popoverForeground,
        },
        card: {
          DEFAULT: colors.light.card,
          foreground: colors.light.cardForeground,
        },
      }),
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px',
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [
    require('tailwindcss-animate'),
    function ({ addUtilities, e }) {
      // Add dark mode utilities for each color
      const darkModeUtils = {};
      Object.keys(colors.dark).forEach((colorKey) => {
        const className = colorKey.replace(/([A-Z])/g, '-$1').toLowerCase();

        // Background colors
        if (colorKey.includes('background') || colorKey === 'card' || colorKey === 'popover' || colorKey === 'muted' || colorKey === 'accent' || colorKey === 'secondary' || colorKey === 'destructive') {
          darkModeUtils[`.dark .bg-${className}`] = {
            backgroundColor: colors.dark[colorKey],
          };
        }

        // Text colors
        if (colorKey.includes('foreground') || colorKey === 'primary') {
          darkModeUtils[`.dark .text-${className}`] = {
            color: colors.dark[colorKey],
          };
        }

        // Border colors
        if (colorKey === 'border' || colorKey === 'input') {
          darkModeUtils[`.dark .border-${className}`] = {
            borderColor: colors.dark[colorKey],
          };
        }
      });

      addUtilities(darkModeUtils);
    },
  ],
};
