import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../design/theme';
import { Card } from './Surface';
import { Text } from './Text';

/**
 * A labelled block: label → content 12, content → footer 8. Sections are separated by the screen's 40 gap.
 * `card` puts the children on a `surface` card as a grouped list, one hairline between each child.
 */
export function Section({
  label,
  title,
  footer,
  card = false,
  children,
}: {
  label?: string;
  title?: string;
  footer?: string;
  card?: boolean;
  children: ReactNode;
}) {
  const t = useTheme();
  const rows = Children.toArray(children);
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
      {card ? (
        <Card padded={false} style={{ paddingHorizontal: t.space[5], paddingVertical: t.space[1] }}>
          {rows.map((row, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional children
            <Fragment key={i}>
              {i > 0 ? (
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.color.border }} />
              ) : null}
              {row}
            </Fragment>
          ))}
        </Card>
      ) : (
        children
      )}
      {footer ? (
        <Text variant="callout" color="textMuted">
          {footer}
        </Text>
      ) : null}
    </View>
  );
}
