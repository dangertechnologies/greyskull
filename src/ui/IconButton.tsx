import { Pressable } from 'react-native';
import { haptics } from '../design/haptics';
import { useTheme } from '../design/theme';
import type { ColorRole } from '../design/tokens';
import { Icon } from './Icon';
import type { IconName } from './icons';

export function IconButton({
  icon,
  label,
  onPress,
  size = 'md',
  tone = 'text',
  disabled,
  testID,
}: {
  icon: IconName;
  /** Accessibility label; icon-only controls must always have one. */
  label: string;
  onPress(): void;
  size?: 'md' | 'lg';
  tone?: ColorRole;
  disabled?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const box = size === 'lg' ? 56 : 48;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={() => {
        haptics.tick();
        onPress();
      }}
      style={({ pressed }) => ({
        width: box,
        height: box,
        borderRadius: box / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? t.color.surfaceRaised : 'transparent',
        opacity: disabled ? 0.35 : 1,
      })}
    >
      <Icon name={icon} size={size === 'lg' ? 26 : 22} color={tone} />
    </Pressable>
  );
}
