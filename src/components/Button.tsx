import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

interface Props {
  title: string;
  onPress(): void;
  variant?: 'outline' | 'link' | 'danger';
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function Button({ title, onPress, variant = 'outline', disabled, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'outline' && styles.outline,
        variant === 'danger' && [styles.outline, { borderColor: colors.danger }],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === 'danger' && { color: colors.danger },
          variant === 'link' && styles.link,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  outline: { borderWidth: 1, borderColor: colors.border, borderRadius: 4 },
  pressed: { backgroundColor: colors.faint },
  disabled: { opacity: 0.35 },
  text: { color: colors.text, fontSize: 17, fontWeight: '300', letterSpacing: 1 },
  link: { textDecorationLine: 'underline', fontSize: 15 },
});
