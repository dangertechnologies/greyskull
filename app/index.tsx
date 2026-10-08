import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { ExerciseIcon } from '../src/components/ExerciseIcon';
import { PlatesLine } from '../src/components/PlatesLine';
import { Screen } from '../src/components/Screen';
import { formatWeight, project, sessionFor, sessionWeightKg } from '../src/domain';
import { formatDate, intensityLabel, nameOf, schemeLabel, summarize, weekOf } from '../src/format';
import { useStore } from '../src/store';
import { colors, type } from '../src/theme';

function HeaderIcons() {
  return (
    <View style={styles.headerIcons}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Progress"
        hitSlop={8}
        onPress={() => router.push('/progress')}
      >
        <Ionicons name="stats-chart-outline" size={24} color={colors.text} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        hitSlop={8}
        onPress={() => router.push('/settings')}
      >
        <Ionicons name="settings-outline" size={24} color={colors.text} />
      </Pressable>
    </View>
  );
}

export default function Home() {
  const state = useStore();
  const {
    program,
    lifts,
    nextSession,
    draft,
    sessions,
    unit,
    inventory,
    exercises,
    needsWeightConfirm,
    skipSession,
  } = state;
  const upcoming = useMemo(() => project(state, 9), [state]);

  if (program === null) return <Redirect href="/setup" />;
  if (needsWeightConfirm) return <Redirect href="/setup/confirm" />;

  const session = sessionFor(program, nextSession);
  const week = weekOf(nextSession, program.sessionsPerWeek);
  const weeks = upcoming.reduce<Record<number, typeof upcoming>>((acc, s) => {
    const week = weekOf(s.n, program.sessionsPerWeek);
    acc[week] = [...(acc[week] ?? []), s];
    return acc;
  }, {});

  const confirmSkip = () =>
    Alert.alert('Skip this workout?', 'It is logged as skipped and your weights stay the same.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Skip', style: 'destructive', onPress: skipSession },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ headerRight: () => <HeaderIcons /> }} />
      <Text style={type.label}>Next up</Text>
      <Text style={type.title} accessibilityRole="header">{`${session.dayName} · Week ${week}`}</Text>
      {intensityLabel(session.dayName, session.intensity) ? (
        <Text
          style={type.small}
        >{`${intensityLabel(session.dayName, session.intensity)} of your working weights`}</Text>
      ) : null}

      <View style={styles.card}>
        {session.slots.map(({ exercise: id, scheme }) => {
          const exercise = exercises[id];
          const bodyweight = exercise?.kind === 'bodyweight';
          const kg =
            draft?.n === nextSession
              ? (draft.results[id]?.weightKg ?? 0)
              : exercise
                ? sessionWeightKg(lifts[id]?.weightKg ?? 0, session.intensity, exercise, inventory, unit)
                : 0;
          return (
            <View key={id} style={styles.slot}>
              <ExerciseIcon icon={exercise?.icon ?? 'muscle'} />
              <View style={styles.slotText}>
                <Text style={type.body}>{nameOf(exercises, id)}</Text>
                {bodyweight ? null : <PlatesLine kg={kg} />}
              </View>
              <View style={styles.slotRight}>
                <Text style={type.body}>{bodyweight ? 'Bodyweight' : formatWeight(kg, unit)}</Text>
                <Text style={type.small}>{schemeLabel(scheme, lifts[id]?.reps)}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <Button title={draft ? 'Resume' : 'Start'} onPress={() => router.push(`/session/${nextSession}`)} />
      <Button variant="link" title="Skip" onPress={confirmSkip} />

      <Text style={[type.heading, styles.section]}>Coming up</Text>
      {Object.entries(weeks).map(([w, list]) => (
        <View key={w} style={styles.group}>
          <Text style={type.label}>{`Week ${w}`}</Text>
          {list.map((s) => (
            <Text key={s.n} style={type.small}>
              {`${s.dayName} · ${s.lifts
                .map((l) =>
                  exercises[l.exercise]?.kind === 'bodyweight'
                    ? nameOf(exercises, l.exercise, true)
                    : `${nameOf(exercises, l.exercise, true)} ${formatWeight(l.weightKg, unit).replace(/ (kg|lb)$/, '')}`,
                )
                .join(' · ')}`}
            </Text>
          ))}
        </View>
      ))}

      {sessions.length > 0 ? <Text style={[type.heading, styles.section]}>History</Text> : null}
      {[...sessions].reverse().map((log) => (
        <Pressable
          key={log.n}
          accessibilityRole="button"
          accessibilityLabel={`Session ${log.n + 1}, ${log.skipped ? 'skipped' : 'edit'}`}
          onPress={() => !log.skipped && router.push(`/session/edit/${log.n}`)}
          style={styles.historyRow}
        >
          <Text style={type.body}>{`#${log.n + 1}${log.dayName ? ` · ${log.dayName}` : ''}`}</Text>
          <Text style={type.small}>{log.finishedAt ? formatDate(log.finishedAt) : ''}</Text>
          <Text style={type.small}>{summarize(log, exercises, unit)}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerIcons: { flexDirection: 'row', gap: 20, paddingRight: 8 },
  card: { backgroundColor: colors.card, borderRadius: 8, padding: 16, gap: 14 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slotText: { flex: 1, gap: 2 },
  slotRight: { alignItems: 'flex-end' },
  section: { marginTop: 24 },
  group: { gap: 4 },
  historyRow: {
    paddingVertical: 10,
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.faint,
  },
});
