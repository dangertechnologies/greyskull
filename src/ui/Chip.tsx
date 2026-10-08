import { Pressable } from 'react-native';
import { haptics } from '../design/haptics';
import { useTheme } from '../design/theme';
import { Text } from './Text';

export function Chip({
  label,
  selected,
  onPress,
  role = 'radio',
}: {
  label: string;
  selected: boolean;
  onPress(): void;
  role?: 'radio' | 'checkbox' | 'tab';
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'checkbox' ? { checked: selected } : { selected }}
      onPress={() => {
        haptics.tick();
        onPress();
      }}
      style={{
        minHeight: 48,
        minWidth: 56,
        paddingHorizontal: t.space[4],
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: t.radius.pill,
        borderWidth: 1,
        borderColor: selected ? t.color.accent : t.color.borderStrong,
        backgroundColor: selected ? t.color.accent : 'transparent',
      }}
    >
      <Text variant="bodyStrong" color={selected ? 'onAccent' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}
