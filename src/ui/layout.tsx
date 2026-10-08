import type { ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Theme, useTheme } from '../design/theme';
import type { SpaceKey } from '../design/tokens';
import { GlassPane, useGlass } from './Glass';

/** Horizontal screen gutter: 20, or 24 on wider phones. */
export function useGutter(): number {
  const { width } = useWindowDimensions();
  return useTheme().space[width >= 400 ? 6 : 5];
}

/** Vertical stack with a token gap; use it instead of margins so spacing stays on the scale. */
export function Stack({
  gap = 4,
  children,
  style,
}: {
  gap?: SpaceKey;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return <View style={[{ gap: theme.space[gap] }, style]}>{children}</View>;
}

/** Height reserved at the bottom of a scrolling screen so a pinned BottomBar never covers content. */
export const BOTTOM_BAR_CLEARANCE = 112;

/**
 * Standard scrolling screen: solid background, gutters, 24 above the first block, 40 between top-level
 * blocks (children should be `Section`s or a single Stack), safe-area bottom padding.
 */
export function ScreenScroll({
  children,
  withBottomBar = false,
  headerless = false,
  gap = 10,
}: {
  children: ReactNode;
  withBottomBar?: boolean;
  /** Tab screens have no navigation header: reserve the top safe area (iOS already does, via the inset adjustment). */
  headerless?: boolean;
  gap?: SpaceKey;
}) {
  const theme = useTheme();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.color.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: gutter,
        paddingTop: theme.space[6] + (headerless && Platform.OS !== 'ios' ? insets.top : 0),
        paddingBottom: theme.space[12] + insets.bottom + (withBottomBar ? BOTTOM_BAR_CLEARANCE : 0),
        gap: theme.space[gap],
      }}
    >
      {children}
    </ScrollView>
  );
}

const barStyles = (t: Theme) =>
  StyleSheet.create({
    bar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: t.space[4],
      backgroundColor: t.color.surfaceRaised,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.color.border,
      gap: t.space[3],
    },
  });

/** Primary action(s) of a screen pinned above the home indicator. */
export function BottomBar({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const glass = useGlass();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const styles = barStyles(theme);
  return (
    <View
      style={[
        styles.bar,
        {
          paddingHorizontal: gutter,
          paddingBottom: Math.max(insets.bottom, theme.space[4]) + theme.space[1],
        },
        glass && { backgroundColor: 'transparent', borderTopWidth: 0 },
      ]}
    >
      {glass ? <GlassPane /> : null}
      {children}
    </View>
  );
}
