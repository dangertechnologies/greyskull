import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Sparkline } from '../../src/components/Sparkline';
import { useTheme } from '../../src/design/theme';
import { exerciseIdsOf, formatWeight, project, trim } from '../../src/domain';
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
  const series = useMemo(
    () =>
      Object.fromEntries(
        ids.map((id) => [id, exercises[id] ? seriesFor(sessions, exercises[id], unit) : []]),
      ),
    [ids, sessions, exercises, unit],
  );
  const anyTrend = ids.some((id) => series[id].length > 1);

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

      <Section
        label="Lifts"
        footer={finished > 0 && !anyTrend ? 'Trends show once a lift has 2 workouts.' : undefined}
        card
      >
        {ids.map((id) => {
          const exercise = exercises[id];
          if (!exercise) return null;
          const values = series[id];
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
              ? `${delta >= 0 ? '+' : '−'}${trim(Math.abs(delta), bodyweight || unit === 'kg' ? 2 : 1)} ${bodyweight ? 'reps' : unit} since the start`
              : null;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`${exercise.name}, ${current}.${trend ? ` ${trend}` : ''}`}
              onPress={() => router.push(`/lift/${id}`)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.space[4],
                minHeight: 72,
                paddingVertical: t.space[3],
                backgroundColor: pressed ? t.color.border : 'transparent',
              })}
            >
              <Monogram exercise={exercise} size={40} />
              <View style={{ flex: 1, gap: t.space[1] }}>
                <Text variant="bodyStrong">{exercise.name}</Text>
                {trend ? (
                  <Text variant="caption" color={delta > 0 ? 'success' : delta < 0 ? 'danger' : 'textMuted'}>
                    {trend}
                  </Text>
                ) : null}
              </View>
              <Sparkline values={values} />
              <View style={{ alignItems: 'flex-end', minWidth: 72 }}>
                <Text variant="bodyStrong">{current}</Text>
              </View>
              <Icon name="chevron" size={16} color="textMuted" />
            </Pressable>
          );
        })}
      </Section>

      <Section label="Projection" footer="If you hit your reps every time." card>
        {upcoming.map((s) => (
          <View key={s.n} style={{ gap: t.space[1], paddingVertical: t.space[3] }}>
            <Text variant="bodyStrong">{`Workout ${s.n + 1} · ${s.dayName}`}</Text>
            <Text variant="callout" color="textMuted">
              {s.lifts
                .filter((l) => exercises[l.exercise]?.kind !== 'bodyweight')
                .map((l) => `${nameOf(exercises, l.exercise, true)} ${formatWeight(l.weightKg, unit)}`)
                .join(' · ')}
            </Text>
          </View>
        ))}
      </Section>

      <Section label="History">
        <Button title="See all workouts" variant="secondary" onPress={() => router.push('/history')} />
      </Section>
    </ScreenScroll>
  );
}
