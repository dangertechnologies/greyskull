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
  // The selected segment sits a step lighter than the track in both schemes (white on grey, grey on near-black).
  const light = t.scheme === 'light';
  const track = light ? t.color.border : t.color.surface;
  const thumb = light ? t.color.surface : t.color.border;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        backgroundColor: track,
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
              backgroundColor: selected ? thumb : 'transparent',
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
