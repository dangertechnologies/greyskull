import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '../design/theme';
import { Text } from './Text';

/** A labelled block: label → content 12, content → footer 8. Sections are separated by the screen's 40 gap. */
export function Section({
  label,
  title,
  footer,
  children,
}: {
  label?: string;
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[3] }}>
      {label ? (
        <Text variant="label" color="textMuted" accessibilityRole="header">
          {label}
        </Text>
      ) : null}
      {title ? (
        <Text variant="headline" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
      {footer ? (
        <Text variant="callout" color="textMuted">
          {footer}
        </Text>
      ) : null}
    </View>
  );
}
