import { createContext, type ReactNode, useContext, useEffect, useMemo } from 'react';
import {
  type ImageStyle,
  Platform,
  StyleSheet,
  type TextStyle,
  useColorScheme,
  type ViewStyle,
} from 'react-native';
import { useStore } from '../store';
import { setHapticsEnabled } from './haptics';
import {
  motion,
  type Palette,
  palettes,
  radius,
  type Scheme,
  space,
  type TypeVariant,
  typography,
} from './tokens';

export interface Theme {
  scheme: Scheme;
  color: Palette;
  space: typeof space;
  radius: typeof radius;
  motion: typeof motion;
  type: Record<TypeVariant, TextStyle>;
}

export function makeTheme(scheme: Scheme): Theme {
  return { scheme, color: palettes[scheme], space, radius, motion, type: typography };
}

/** Material You is available from Android 12 (API 31). */
export const dynamicColorSupported = (): boolean =>
  Platform.OS === 'android' && Number(Platform.Version) >= 31;

/** Swap the accent pair (and its chart tint) of a palette; used for the wallpaper-derived Material You accent. */
export function withAccent(palette: Palette, accent: string, onAccent: string): Palette {
  return { ...palette, accent, onAccent };
}

const dynamicThemes = new Map<Scheme, Theme>();
function dynamicTheme(base: Theme): Theme {
  const cached = dynamicThemes.get(base.scheme);
  if (cached) return cached;
  // Resolved lazily: only Android 12+ with the setting on ever touches the platform colours.
  const { Color } = require('expo-router') as typeof import('expo-router');
  const dyn = Color.android.dynamic;
  const made = { ...base, color: withAccent(base.color, dyn.primary as string, dyn.onPrimary as string) };
  dynamicThemes.set(base.scheme, made);
  return made;
}

const themes: Record<Scheme, Theme> = { light: makeTheme('light'), dark: makeTheme('dark') };

const ThemeContext = createContext<Theme | null>(null);

/** Resolves the user's appearance setting (system/light/dark) and applies the haptics setting. */
export function ThemeProvider({ children, forceScheme }: { children: ReactNode; forceScheme?: Scheme }) {
  const system = useColorScheme();
  const appearance = useStore((s) => s.appearance);
  const haptics = useStore((s) => s.hapticsEnabled);
  const dynamic = useStore((s) => s.dynamicColor);
  useEffect(() => setHapticsEnabled(haptics), [haptics]);
  const scheme: Scheme =
    forceScheme ?? (appearance === 'system' ? (system === 'light' ? 'light' : 'dark') : appearance);
  const useDynamic = dynamic && dynamicColorSupported();
  const theme = useMemo(
    () => (useDynamic ? dynamicTheme(themes[scheme]) : themes[scheme]),
    [scheme, useDynamic],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext) ?? themes.dark;
}

type Named = Record<string, ViewStyle | TextStyle | ImageStyle>;

/** `const useStyles = makeStyles((t) => ({ ... }))`; styles are created once per scheme. */
export function makeStyles<T extends Named>(fn: (t: Theme) => T): () => T {
  const cache = new WeakMap<Theme, T>();
  return () => {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = StyleSheet.create(fn(theme)) as T;
      cache.set(theme, styles);
    }
    return styles;
  };
}
