import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { useTheme } from '../design/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export interface Props {
  title: string;
  subtitle?: string;
  value?: string;
  leading?: ReactNode;
  onPress?(): void;
  accessory?: 'chevron' | 'switch' | ReactNode;
  switchValue?: boolean;
  onSwitch?(value: boolean): void;
  destructive?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

/** 56 pt minimum, 14 vertical padding, 14 between the leading element and the text. */
export function ListRow({
  title,
  subtitle,
  value,
  leading,
  onPress,
  accessory,
  switchValue,
  onSwitch,
  destructive,
  testID,
  accessibilityLabel,
}: Props) {
  const t = useTheme();
  const body = (
    <View style={[styles.row, { minHeight: 56, paddingVertical: 14, gap: 14 }]}>
      {leading}
      <View style={styles.text}>
        <Text variant="bodyStrong" color={destructive ? 'danger' : 'text'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="callout" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="body" color="textMuted">
          {value}
        </Text>
      ) : null}
      {accessory === 'switch' ? (
        <Switch
          accessibilityLabel={accessibilityLabel ?? title}
          value={!!switchValue}
          onValueChange={onSwitch}
          trackColor={{ true: t.color.accent }}
        />
      ) : accessory === 'chevron' ? (
        <Icon name="chevron" size={18} color="textMuted" />
      ) : (
        accessory
      )}
    </View>
  );
  if (!onPress) return <View testID={testID}>{body}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle, value].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: pressed ? t.color.border : 'transparent' })}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, gap: 2 },
});
