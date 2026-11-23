import { memo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../design/theme';
import type { Exercise } from '../domain';
import { subtitleOf } from '../exerciseFilter';
import { ExerciseBadge } from '../ui/ExerciseBadge';
import { Icon } from '../ui/Icon';
import { Text } from '../ui/Text';

export type RowPosition = 'first' | 'middle' | 'last' | 'only';

function Tag({ label, accent = false }: { label: string; accent?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        borderRadius: t.radius.pill,
        borderWidth: 1,
        borderColor: accent ? t.color.accent : t.color.borderStrong,
        backgroundColor: accent ? t.color.chartFill : 'transparent',
        paddingHorizontal: t.space[3],
        paddingVertical: 2,
      }}
    >
      <Text variant="caption" color={accent ? 'accent' : 'textMuted'}>
        {label}
      </Text>
    </View>
  );
}

/**
 * One line of the exercise library. Rows of a list are drawn as one grouped card: the first and last row round
 * the card's corners. Memoised so typing in the search box redraws only the rows that appear or go.
 */
export const ExerciseRow = memo(function ExerciseRow({
  exercise,
  inProgram,
  position,
  onOpen,
}: {
  exercise: Exercise;
  inProgram: boolean;
  position: RowPosition;
  onOpen(id: string): void;
}) {
  const t = useTheme();
  // At large text sizes the tags drop under the name and the badge shrinks, so the name keeps its width.
  const big = useWindowDimensions().fontScale > 1.3;
  const top = position === 'first' || position === 'only';
  const bottom = position === 'last' || position === 'only';
  const edge = t.scheme === 'light' ? StyleSheet.hairlineWidth : 0;
  const subtitle = subtitleOf(exercise);
  const tags = [
    exercise.custom ? <Tag key="custom" label="Custom" /> : null,
    exercise.timed ? <Tag key="timed" label="Timed" /> : null,
    inProgram ? <Tag key="in" label="In program" accent /> : null,
  ];
  return (
    <View
      style={{
        backgroundColor: t.color.surface,
        borderColor: t.color.border,
        borderLeftWidth: edge,
        borderRightWidth: edge,
        borderTopWidth: top ? edge : 0,
        borderBottomWidth: bottom ? edge : 0,
        borderTopLeftRadius: top ? t.radius.xl : 0,
        borderTopRightRadius: top ? t.radius.xl : 0,
        borderBottomLeftRadius: bottom ? t.radius.xl : 0,
        borderBottomRightRadius: bottom ? t.radius.xl : 0,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[
          exercise.name,
          subtitle,
          exercise.custom ? 'custom' : '',
          exercise.timed ? 'timed' : '',
          inProgram ? 'in your program' : '',
        ]
          .filter(Boolean)
          .join(', ')}
        onPress={() => onOpen(exercise.id)}
        style={({ pressed }) => ({
          paddingHorizontal: t.space[5],
          backgroundColor: pressed ? t.color.border : 'transparent',
        })}
      >
        {top ? null : <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.color.border }} />}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space[4],
            minHeight: 80,
            paddingVertical: t.space[3],
          }}
        >
          <ExerciseBadge exercise={exercise} size={big ? 40 : 56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong" numberOfLines={big ? 4 : 2}>
              {exercise.name}
            </Text>
            {subtitle ? (
              <Text variant="callout" color="textMuted" numberOfLines={big ? 4 : 2}>
                {subtitle}
              </Text>
            ) : null}
            {big ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[1] }}>{tags}</View>
            ) : null}
          </View>
          {big ? null : <View style={{ alignItems: 'flex-end', gap: t.space[1] }}>{tags}</View>}
          {big ? null : <Icon name="chevron" size={16} color="textMuted" />}
        </View>
      </Pressable>
    </View>
  );
});
