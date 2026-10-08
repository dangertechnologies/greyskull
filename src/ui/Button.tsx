import { Pressable, StyleSheet, View } from 'react-native';
import { haptics } from '../design/haptics';
import { useTheme } from '../design/theme';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';

export interface Props {
  title: string;
  onPress(): void;
  variant?: 'primary' | 'secondary' | 'plain' | 'destructive';
  size?: 'md' | 'lg';
  icon?: IconName;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const t = useTheme();
  const filled = variant === 'primary';
  const fg = filled
    ? 'onAccent'
    : variant === 'destructive'
      ? 'danger'
      : variant === 'plain'
        ? 'accent'
        : 'text';
  const background = filled
    ? t.color.accent
    : variant === 'secondary'
      ? t.color.surfaceRaised
      : 'transparent';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: size === 'lg' ? 60 : 56,
          borderRadius: t.radius.lg,
          paddingHorizontal: t.space[6],
          backgroundColor: background,
          borderWidth: variant === 'destructive' ? 1 : 0,
          borderColor: t.color.danger,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.row, { gap: t.space[2] }]}>
        {icon ? <Icon name={icon} color={fg} /> : null}
        <Text variant={size === 'lg' ? 'headline' : 'bodyStrong'} color={fg}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
