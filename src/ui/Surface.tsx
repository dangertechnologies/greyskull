import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../design/theme';

/** Grouped content on `surface`. Padding 20 and radius 20 (the card rhythm of the design system). */
export function Card({
  children,
  padded = true,
  style,
}: {
  children: ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.color.surface,
          borderRadius: t.radius.xl,
          padding: padded ? t.space[5] : 0,
          borderWidth: t.scheme === 'light' ? StyleSheet.hairlineWidth : 0,
          borderColor: t.color.border,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const Surface = Card;
