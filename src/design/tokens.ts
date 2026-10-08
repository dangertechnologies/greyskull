import type { TextStyle } from 'react-native';

export type Scheme = 'light' | 'dark';

export const COLOR_ROLES = [
  'background',
  'surface',
  'surfaceRaised',
  'border',
  'borderStrong',
  'text',
  'textMuted',
  'accent',
  'onAccent',
  'success',
  'warning',
  'danger',
  'scrim',
  'backdrop',
  'onPhoto',
  'onPhotoMuted',
  'chartFill',
] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];
export type Palette = Record<ColorRole, string>;

/** Contrast-checked (src/design/contrast.test.ts). Text on photos is always light, on `scrim`. */
export const palettes: Record<Scheme, Palette> = {
  dark: {
    background: '#0B0C0E',
    surface: '#16181C',
    surfaceRaised: '#1F2228',
    border: '#2A2E35',
    borderStrong: '#6B7280',
    text: '#F4F5F7',
    textMuted: '#A3A9B3',
    accent: '#C6F432',
    onAccent: '#0B0C0E',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    scrim: 'rgba(0,0,0,0.55)',
    backdrop: 'rgba(0,0,0,0.5)',
    onPhoto: '#FFFFFF',
    onPhotoMuted: 'rgba(255,255,255,0.8)',
    chartFill: 'rgba(198,244,50,0.18)',
  },
  light: {
    background: '#F6F7F9',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    border: '#E1E4E9',
    borderStrong: '#7A818C',
    text: '#0E1013',
    textMuted: '#5B6370',
    accent: '#1F7A3A',
    onAccent: '#FFFFFF',
    success: '#15803D',
    warning: '#B45309',
    danger: '#B91C1C',
    scrim: 'rgba(0,0,0,0.45)',
    backdrop: 'rgba(0,0,0,0.5)',
    onPhoto: '#FFFFFF',
    onPhotoMuted: 'rgba(255,255,255,0.8)',
    chartFill: 'rgba(31,122,58,0.14)',
  },
};

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;
export type SpaceKey = keyof typeof space;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const motion = { fast: 150, base: 220, slow: 320, spring: { damping: 18, stiffness: 220 } } as const;

/** One family per weight: Android cannot synthesise weights for custom fonts. */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const TYPE_VARIANTS = [
  'display',
  'numberLarge',
  'title',
  'headline',
  'body',
  'bodyStrong',
  'callout',
  'caption',
  'label',
] as const;
export type TypeVariant = (typeof TYPE_VARIANTS)[number];

// Number styles only: Inter's tnum also widens the hyphen, so prose would read "Bench - press".
const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const typography: Record<TypeVariant, TextStyle> = {
  display: { fontFamily: fontFamily.semibold, fontSize: 56, lineHeight: 60, ...tabular },
  numberLarge: { fontFamily: fontFamily.semibold, fontSize: 40, lineHeight: 44, ...tabular },
  title: { fontFamily: fontFamily.semibold, fontSize: 28, lineHeight: 34 },
  headline: { fontFamily: fontFamily.semibold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fontFamily.regular, fontSize: 17, lineHeight: 24 },
  bodyStrong: { fontFamily: fontFamily.medium, fontSize: 17, lineHeight: 24 },
  callout: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18 },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
};

/** Display sizes are capped so a 200 % system font cannot push a weight off the screen. */
export const maxFontScale: Partial<Record<TypeVariant, number>> = { display: 1.3, numberLarge: 1.3 };
