import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useTheme } from '../design/theme';
import type { Exercise } from '../domain';
import { monogramOf } from '../domain';
import { EXERCISE_ICONS, KIND_ICONS } from './exerciseIcons';
import { Text } from './Text';

type BadgeExercise = Pick<Exercise, 'id' | 'name' | 'abbr' | 'kind' | 'custom'>;

/**
 * Round exercise badge: a pictogram of the lift for built-ins, the user's own letters for a custom exercise
 * that has an abbreviation, else the pictogram for its kind (barbell, dumbbell, machine, bodyweight).
 */
export function ExerciseBadge({ exercise, size = 56 }: { exercise: BadgeExercise; size?: 40 | 56 }) {
  const t = useTheme();
  const letters = exercise.custom && exercise.abbr?.trim() ? monogramOf(exercise) : null;
  const key = EXERCISE_ICONS[exercise.id] ? exercise.id : `kind:${exercise.kind}`;
  const icon = EXERCISE_ICONS[exercise.id] ?? KIND_ICONS[exercise.kind];
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
      {letters ? (
        <Text
          variant={size === 56 ? 'bodyStrong' : 'caption'}
          color="accent"
          maxFontSizeMultiplier={1.2}
          style={{ letterSpacing: letters.length === 3 ? -0.5 : 0 }}
        >
          {letters}
        </Text>
      ) : (
        <Svg testID={`exercise-icon-${key}`} width={size * 0.68} height={size * 0.68} viewBox="0 0 32 32">
          <G stroke={t.color.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <Path d={icon.d} />
            {(icon.rings ?? []).map(([cx, cy, r]) => (
              <Circle key={`r${cx},${cy}`} cx={cx} cy={cy} r={r} />
            ))}
            {(icon.dots ?? []).map(([cx, cy, r]) => (
              <Circle key={`d${cx},${cy}`} cx={cx} cy={cy} r={r} fill={t.color.accent} stroke="none" />
            ))}
          </G>
        </Svg>
      )}
    </View>
  );
}
