import { Pressable } from 'react-native';
import { haptics } from '../design/haptics';
import { useTheme } from '../design/theme';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * Selected = accent tint with accent text (a checkmark too for checkboxes), open = outline. A tint rather
 * than a solid fill keeps a row of selected chips from shouting, the bright dark-mode accent especially.
 */
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
        flexDirection: 'row',
        gap: t.space[1],
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: t.radius.pill,
        borderWidth: 1,
        borderColor: selected ? t.color.accent : t.color.borderStrong,
        backgroundColor: selected ? t.color.chartFill : 'transparent',
      }}
    >
      {selected && role === 'checkbox' ? <Icon name="check" size={14} color="accent" /> : null}
      <Text variant="bodyStrong" color={selected ? 'accent' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}
