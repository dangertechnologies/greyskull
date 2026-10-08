import { createContext, type ReactNode, useContext, useEffect, useMemo } from 'react';
import { type ImageStyle, StyleSheet, type TextStyle, useColorScheme, type ViewStyle } from 'react-native';
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

const themes: Record<Scheme, Theme> = { light: makeTheme('light'), dark: makeTheme('dark') };

const ThemeContext = createContext<Theme | null>(null);

/** Resolves the user's appearance setting (system/light/dark) and applies the haptics setting. */
export function ThemeProvider({ children, forceScheme }: { children: ReactNode; forceScheme?: Scheme }) {
  const system = useColorScheme();
  const appearance = useStore((s) => s.appearance);
  const haptics = useStore((s) => s.hapticsEnabled);
  useEffect(() => setHapticsEnabled(haptics), [haptics]);
  const scheme: Scheme =
    forceScheme ?? (appearance === 'system' ? (system === 'light' ? 'light' : 'dark') : appearance);
  const theme = useMemo(() => themes[scheme], [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext) ?? themes.dark;
}

type Named = Record<string, ViewStyle | TextStyle | ImageStyle>;

/** `const useStyles = makeStyles((t) => ({ ... }))`; styles are created once per scheme. */
export function makeStyles<T extends Named>(fn: (t: Theme) => T): () => T {
  const cache = new Map<Scheme, T>();
  return () => {
    const theme = useTheme();
    let styles = cache.get(theme.scheme);
    if (!styles) {
      styles = StyleSheet.create(fn(theme)) as T;
      cache.set(theme.scheme, styles);
    }
    return styles;
  };
}
