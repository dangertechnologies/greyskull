import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Sparkline } from '../../src/components/Sparkline';
import { useTheme } from '../../src/design/theme';
import { exerciseIdsOf, formatWeight, project, toUnit, trim } from '../../src/domain';
import { nameOf } from '../../src/format';
import { seriesFor } from '../../src/series';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { EmptyState } from '../../src/ui/EmptyState';
import { Icon } from '../../src/ui/Icon';
import { ScreenScroll } from '../../src/ui/layout';
import { Monogram } from '../../src/ui/Monogram';
import { Section } from '../../src/ui/Section';
import { Text } from '../../src/ui/Text';

export default function Progress() {
  const state = useStore();
  const { sessions, lifts, unit, exercises, program } = state;
  const t = useTheme();
  const ids = useMemo(() => (program ? exerciseIdsOf(program) : []), [program]);
  const upcoming = useMemo(() => project(state, 6), [state]);
  const finished = sessions.filter((s) => !s.skipped).length;

  return (
    <ScreenScroll headerless gap={10}>
      <Text variant="title" accessibilityRole="header">
        Progress
      </Text>

      {finished === 0 ? (
        <EmptyState
          icon="progress"
          title="Nothing to chart yet"
          body="Finish your first workout and your lifts show up here."
        />
      ) : null}

      <Section label="Lifts">
        <View>
          {ids.map((id) => {
            const exercise = exercises[id];
            if (!exercise) return null;
            const values = seriesFor(sessions, exercise, unit);
            const bodyweight = exercise.kind === 'bodyweight';
            const first = values[0];
            const last = values[values.length - 1];
            const delta = values.length > 1 ? last - first : 0;
            const current = bodyweight
              ? last !== undefined
                ? `${trim(last)} reps`
                : '–'
              : formatWeight(lifts[id]?.weightKg ?? 0, unit);
            const trend =
              values.length > 1
                ? `${delta >= 0 ? '+' : '−'}${trim(Math.abs(delta))} ${bodyweight ? 'reps' : unit} since the start`
                : 'Not enough sessions yet';
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={`${exercise.name}, ${current}. ${trend}`}
                onPress={() => router.push(`/lift/${id}`)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.space[4],
                  minHeight: 72,
                  paddingVertical: t.space[3],
                  backgroundColor: pressed ? t.color.surface : 'transparent',
                })}
              >
                <Monogram exercise={exercise} size={40} />
                <View style={{ flex: 1, gap: t.space[1] }}>
                  <Text variant="bodyStrong">{exercise.name}</Text>
                  <Text variant="caption" color={delta > 0 ? 'success' : delta < 0 ? 'danger' : 'textMuted'}>
                    {trend}
                  </Text>
                </View>
                <Sparkline values={values} />
                <View style={{ alignItems: 'flex-end', minWidth: 72 }}>
                  <Text variant="bodyStrong">{current}</Text>
                </View>
                <Icon name="chevron" size={16} color="textMuted" />
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section label="Projection" footer="If you hit your reps every time.">
        <View style={{ gap: t.space[3] }}>
          {upcoming.map((s) => (
            <Text key={s.n} variant="callout" color="textMuted">
              {`#${s.n + 1} ${s.dayName} · ${s.lifts
                .filter((l) => exercises[l.exercise]?.kind !== 'bodyweight')
                .map((l) => `${nameOf(exercises, l.exercise, true)} ${trim(toUnit(l.weightKg, unit))}`)
                .join(' · ')}`}
            </Text>
          ))}
        </View>
      </Section>

      <Section label="History">
        <Button title="See all workouts" variant="secondary" onPress={() => router.push('/history')} />
      </Section>
    </ScreenScroll>
  );
}
