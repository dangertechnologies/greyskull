import { SymbolView } from 'expo-symbols';
import { useTheme } from '../design/theme';
import type { ColorRole } from '../design/tokens';
import { ICON_NAMES, type IconName } from './icons';

/** Decorative by default (hidden from screen readers); put the label on the control that wraps it. */
export function Icon({
  name,
  size = 22,
  color = 'text',
}: {
  name: IconName;
  size?: number;
  color?: ColorRole;
}) {
  const theme = useTheme();
  return (
    <SymbolView
      name={ICON_NAMES[name]}
      size={size}
      tintColor={theme.color[color]}
      resizeMode="scaleAspectFit"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: size, height: size }}
    />
  );
}
