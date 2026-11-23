import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useTheme } from '../design/theme';
import type { Exercise } from '../domain';
import { monogramOf } from '../domain';
import { EXERCISE_ICONS, KIND_ICONS, type Pictogram } from './exerciseIcons';
import { PICTOGRAMS, type PictogramKey } from './pictograms';
import { Text } from './Text';

type BadgeExercise = Pick<Exercise, 'id' | 'name' | 'abbr' | 'kind' | 'custom' | 'pictogram'>;

/**
 * The drawing for an exercise: the one made for that exact lift, else the catalog's pictogram for its movement,
 * else the one for its kind. `key` names the source (for tests and as a stable React key).
 */
export function pictogramFor(exercise: BadgeExercise): { key: string; icon: Pictogram } {
  const own = EXERCISE_ICONS[exercise.id];
  if (own) return { key: exercise.id, icon: own };
  const shared = exercise.pictogram ? PICTOGRAMS[exercise.pictogram as PictogramKey] : undefined;
  if (shared) return { key: `pictogram:${exercise.pictogram}`, icon: shared };
  return { key: `kind:${exercise.kind}`, icon: KIND_ICONS[exercise.kind] };
}

/**
 * Round exercise badge: the user's own letters for a custom exercise that has an abbreviation, else a
 * pictogram of the lift (see `pictogramFor`). Sizes: 40 in lists, 56 in rows, 160 on the detail screen.
 */
export function ExerciseBadge({ exercise, size = 56 }: { exercise: BadgeExercise; size?: 40 | 56 | 160 }) {
  const t = useTheme();
  const letters = exercise.custom && exercise.abbr?.trim() ? monogramOf(exercise) : null;
  const { key, icon } = pictogramFor(exercise);
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
          variant={size === 40 ? 'caption' : size === 56 ? 'bodyStrong' : 'headline'}
          color="accent"
          maxFontSizeMultiplier={1.2}
          style={{ letterSpacing: letters.length === 3 ? -0.5 : 0 }}
        >
          {letters}
        </Text>
      ) : (
        <Svg
          testID={`exercise-icon-${key}`}
          width={size * (size === 160 ? 0.5 : 0.68)}
          height={size * (size === 160 ? 0.5 : 0.68)}
          viewBox="0 0 32 32"
        >
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
