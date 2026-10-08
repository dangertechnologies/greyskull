import { View } from 'react-native';
import { useTheme } from '../design/theme';
import type { Exercise } from '../domain';
import { monogramOf } from '../domain';
import { Text } from './Text';

/** Round badge with 1–3 letters (SQ, DL, OHP): scales, themes and needs no licensed artwork. */
export function Monogram({
  exercise,
  size = 56,
}: {
  exercise: Pick<Exercise, 'name' | 'abbr'>;
  size?: 40 | 56;
}) {
  const t = useTheme();
  const letters = monogramOf(exercise);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: t.color.chartFill,
      }}
    >
      <Text
        variant={size === 56 ? 'bodyStrong' : 'caption'}
        color="accent"
        maxFontSizeMultiplier={1.2}
        style={{ letterSpacing: letters.length === 3 ? -0.5 : 0 }}
      >
        {letters}
      </Text>
    </View>
  );
}
