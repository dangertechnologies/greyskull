import { Pressable, View } from 'react-native';
import { haptics } from '../design/haptics';
import { useTheme } from '../design/theme';
import { Text } from './Text';

export function SegmentedControl({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange(value: string): void;
  accessibilityLabel: string;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        backgroundColor: t.color.surface,
        borderRadius: t.radius.lg,
        padding: t.space[1],
        gap: t.space[1],
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => {
              haptics.tick();
              onChange(o.value);
            }}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: t.radius.md,
              backgroundColor: selected ? t.color.surfaceRaised : 'transparent',
              borderWidth: selected ? 1 : 0,
              borderColor: t.color.borderStrong,
            }}
          >
            <Text variant="bodyStrong" color={selected ? 'text' : 'textMuted'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
