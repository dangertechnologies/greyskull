import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { PlatesLine } from '../../../src/components/PlatesLine';
import { Screen } from '../../../src/components/Screen';
import { Stepper } from '../../../src/components/Stepper';
import { WeightStepper } from '../../../src/components/WeightStepper';
import type { ExerciseResult } from '../../../src/domain';
import { formatDate, nameOf } from '../../../src/format';
import { goBackOr } from '../../../src/navigation';
import { useStore } from '../../../src/store';
import { type } from '../../../src/theme';

export default function EditSession() {
  const { n } = useLocalSearchParams<{ n: string }>();
  const log = useStore((s) => s.sessions.find((x) => x.n === Number(n)));
  const exercises = useStore((s) => s.exercises);
  const editSession = useStore((s) => s.editSession);
  const [results, setResults] = useState<Record<string, ExerciseResult>>(
    () => JSON.parse(JSON.stringify(log?.results ?? {})) as Record<string, ExerciseResult>,
  );

  if (!log || log.skipped) return <Redirect href="/" />;

  const setReps = (id: string, setIndex: number, reps: number) =>
    setResults((r) => ({
      ...r,
      [id]: { ...r[id], sets: r[id].sets.map((s, i) => (i === setIndex ? { ...s, reps } : s)) },
    }));

  return (
    <Screen>
      <Text
        style={type.title}
        accessibilityRole="header"
      >{`Session ${log.n + 1}${log.dayName ? ` · ${log.dayName}` : ''}`}</Text>
      {log.finishedAt ? <Text style={type.small}>{formatDate(log.finishedAt)}</Text> : null}
      <Text style={type.small}>
        Changing a past session does not recalculate your current weights. Adjust them in the lift editor.
      </Text>

      {log.order.map((id) => {
        const result = results[id];
        const exercise = exercises[id];
        if (!result) return null;
        return (
          <View key={id} style={styles.block}>
            <Text style={type.heading}>{nameOf(exercises, id)}</Text>
            {exercise?.kind === 'bodyweight' || result.weightKg === 0 ? null : (
              <>
                <WeightStepper
                  label="Weight"
                  exercise={exercise}
                  kg={result.weightKg}
                  onChange={(kg) => setResults((r) => ({ ...r, [id]: { ...r[id], weightKg: kg } }))}
                />
                <PlatesLine kg={result.weightKg} />
              </>
            )}
            {result.sets.map((set, i) => (
              <Stepper
                // biome-ignore lint/suspicious/noArrayIndexKey: sets have no id; their position is their identity
                key={i}
                label={`Set ${i + 1}${set.target === null ? ' (AMRAP)' : ''}`}
                value={set.reps}
                min={0}
                step={1}
                format={(v) => `${v} reps`}
                onChange={(reps) => setReps(id, i, reps)}
              />
            ))}
          </View>
        );
      })}

      <Button
        title="Save"
        onPress={() => {
          editSession(log.n, results);
          goBackOr('/');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ block: { gap: 10, alignItems: 'center', paddingVertical: 8 } });
