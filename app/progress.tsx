import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Background } from '../src/components/Background';
import { Button } from '../src/components/Button';
import { Chart } from '../src/components/Chart';
import { exerciseIdsOf, formatWeight, project, toUnit, trim } from '../src/domain';
import { nameOf } from '../src/format';
import { seriesFor } from '../src/series';
import { useStore } from '../src/store';
import { colors, type } from '../src/theme';

const PROJECTION = 'projection';

/** Progress per lift. A chip row at the top picks the lift (or the projection); `?lift=ID` preselects one. */
export default function Progress() {
  const params = useLocalSearchParams<{ lift?: string }>();
  const state = useStore();
  const { sessions, lifts, unit, exercises, program } = state;
  const ids = useMemo(() => (program ? exerciseIdsOf(program) : []), [program]);
  const [selected, setSelected] = useState(() =>
    params.lift && ids.includes(params.lift) ? params.lift : (ids[0] ?? PROJECTION),
  );
  const upcoming = useMemo(() => project(state, 9), [state]);

  const choices = [
    ...ids.map((id) => ({ key: id, label: nameOf(exercises, id, true) })),
    { key: PROJECTION, label: 'Projection' },
  ];

  const renderLift = (id: string) => {
    const exercise = exercises[id];
    if (!exercise) return null;
    const bodyweight = exercise.kind === 'bodyweight';
    const values = seriesFor(sessions, exercise, unit);
    const lift = lifts[id];
    const amraps = sessions.flatMap((s) => (s.results[id] ? [s.results[id].sets.at(-1)?.reps ?? 0] : []));
    const best = Math.max(0, ...amraps);
    const oneRm = lift ? lift.weightKg * (1 + best / 30) : 0;
    return (
      <View style={styles.section}>
        <Text style={type.title} accessibilityRole="header">
          {nameOf(exercises, id)}
        </Text>
        <Chart
          label={nameOf(exercises, id)}
          values={values}
          format={(v) => (bodyweight ? `${trim(v)} reps` : `${trim(v)} ${unit}`)}
        />
        <View style={styles.stats}>
          {!bodyweight && lift ? (
            <Text style={type.body}>
              {`${formatWeight(lift.startKg, unit)} → ${formatWeight(lift.weightKg, unit)}`}
            </Text>
          ) : null}
          <Text style={type.body}>{best > 0 ? `Best AMRAP: ${best} reps` : 'No AMRAP sets yet'}</Text>
          {!bodyweight && best > 0 ? (
            <Text style={type.body}>{`Estimated 1RM: ${formatWeight(oneRm, unit)}`}</Text>
          ) : null}
        </View>
        {!bodyweight && lift ? (
          <Button title="Edit weights and increment" onPress={() => router.push(`/lift/${id}`)} />
        ) : null}
      </View>
    );
  };

  return (
    <Background>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipBar}
        contentContainerStyle={styles.chips}
        accessibilityRole="tablist"
      >
        {choices.map((c) => {
          const on = c.key === selected;
          return (
            <Pressable
              key={c.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={c.label}
              onPress={() => setSelected(c.key)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.page}>
        {selected === PROJECTION ? (
          <View style={styles.section}>
            <Text style={type.title} accessibilityRole="header">
              Projection
            </Text>
            <Text style={type.small}>If you hit your reps every time</Text>
            <View style={styles.stats}>
              {upcoming.map((s) => (
                <Text key={s.n} style={type.body}>
                  {`#${s.n + 1} ${s.dayName} · ${s.lifts
                    .filter((l) => exercises[l.exercise]?.kind !== 'bodyweight')
                    .map((l) => `${nameOf(exercises, l.exercise, true)} ${trim(toUnit(l.weightKg, unit))}`)
                    .join(' · ')}`}
                </Text>
              ))}
            </View>
          </View>
        ) : (
          renderLift(selected)
        )}
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  chipBar: { flexGrow: 0 },
  chips: { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.dim,
  },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.text, fontSize: 15, fontWeight: '400' },
  chipTextOn: { color: colors.bg },
  page: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  section: { gap: 24 },
  stats: { gap: 8 },
});
