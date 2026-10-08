import { useMemo } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { Background } from '../src/components/Background';
import { Chart } from '../src/components/Chart';
import { exerciseIdsOf, formatWeight, project, toUnit, trim } from '../src/domain';
import { nameOf } from '../src/format';
import { seriesFor } from '../src/series';
import { useStore } from '../src/store';
import { type } from '../src/theme';

type Page = { kind: 'lift'; id: string } | { kind: 'projection' };

export default function Progress() {
  const state = useStore();
  const { sessions, lifts, unit, exercises, program } = state;
  const { width } = useWindowDimensions();
  const pages = useMemo<Page[]>(
    () => [...(program ? exerciseIdsOf(program) : []).map((id) => ({ kind: 'lift', id }) as const), { kind: 'projection' }],
    [program],
  );
  const upcoming = useMemo(() => project(state, 9), [state]);

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
      <>
        <Text style={type.title} accessibilityRole="header">{nameOf(exercises, id)}</Text>
        <Chart
          label={nameOf(exercises, id)}
          values={values}
          format={(v) => (bodyweight ? `${trim(v)} reps` : `${trim(v)} ${unit}`)}
        />
        {!bodyweight && lift ? (
          <Text style={type.body}>{`${formatWeight(lift.startKg, unit)} → ${formatWeight(lift.weightKg, unit)}`}</Text>
        ) : null}
        <Text style={type.body}>{best > 0 ? `Best AMRAP: ${best} reps` : 'No AMRAP sets yet'}</Text>
        {!bodyweight && best > 0 ? <Text style={type.body}>{`Estimated 1RM: ${formatWeight(oneRm, unit)}`}</Text> : null}
      </>
    );
  };

  return (
    <Background>
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => (p.kind === 'lift' ? p.id : 'projection')}
        renderItem={({ item, index }) => (
          <ScrollView style={{ width }} contentContainerStyle={styles.page}>
            {item.kind === 'lift' ? (
              renderLift(item.id)
            ) : (
              <>
                <Text style={type.title} accessibilityRole="header">Projection</Text>
                <Text style={type.small}>If you hit five reps every time</Text>
                {upcoming.map((s) => (
                  <Text key={s.n} style={type.body}>
                    {`#${s.n + 1} ${s.dayName} · ${s.lifts
                      .filter((l) => exercises[l.exercise]?.kind !== 'bodyweight')
                      .map((l) => `${nameOf(exercises, l.exercise, true)} ${trim(toUnit(l.weightKg, unit))}`)
                      .join(' · ')}`}
                  </Text>
                ))}
              </>
            )}
            <Text style={[type.small, styles.count]}>{`${index + 1} / ${pages.length}`}</Text>
          </ScrollView>
        )}
      />
    </Background>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14, flexGrow: 1 },
  count: { marginTop: 'auto', textAlign: 'center' },
});
