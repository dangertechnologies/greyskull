import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { WeightStepper } from '../../../src/components/WeightStepper';
import { useTheme } from '../../../src/design/theme';
import type { ExerciseResult } from '../../../src/domain';
import { formatDate, nameOf } from '../../../src/format';
import { goBackOr } from '../../../src/navigation';
import { useStore } from '../../../src/store';
import { Button } from '../../../src/ui/Button';
import { BottomBar, ScreenScroll } from '../../../src/ui/layout';
import { Monogram } from '../../../src/ui/Monogram';
import { NumberStepper } from '../../../src/ui/NumberStepper';
import { PlateStack } from '../../../src/ui/PlateStack';
import { Card } from '../../../src/ui/Surface';
import { Text } from '../../../src/ui/Text';

export default function EditSession() {
  const { n } = useLocalSearchParams<{ n: string }>();
  const log = useStore((s) => s.sessions.find((x) => x.n === Number(n)));
  const exercises = useStore((s) => s.exercises);
  const editSession = useStore((s) => s.editSession);
  const t = useTheme();
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
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <Stack.Screen options={{ title: `Workout ${log.n + 1}` }} />
      <ScreenScroll withBottomBar gap={6}>
        {log.finishedAt || log.dayName ? (
          <Text variant="callout" color="textMuted">
            {[log.dayName, log.finishedAt ? formatDate(log.finishedAt) : null].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        <Text color="textMuted">
          Changing a past session does not recalculate your current weights. Adjust them in the lift editor.
        </Text>
        <View style={{ height: t.space[4] }} />

        <View style={{ gap: t.space[6] }}>
          {log.order.map((id) => {
            const result = results[id];
            const exercise = exercises[id];
            if (!result) return null;
            const loaded = exercise && exercise.kind !== 'bodyweight' && result.weightKg !== 0;
            return (
              <Card key={id} style={{ gap: t.space[6], alignItems: 'center' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: t.space[3],
                    alignSelf: 'stretch',
                  }}
                >
                  {exercise ? <Monogram exercise={exercise} size={40} /> : null}
                  <Text variant="headline">{nameOf(exercises, id)}</Text>
                </View>
                {loaded ? (
                  <>
                    <WeightStepper
                      label="Weight"
                      exercise={exercise}
                      kg={result.weightKg}
                      onChange={(kg) => setResults((r) => ({ ...r, [id]: { ...r[id], weightKg: kg } }))}
                    />
                    {exercise.kind === 'barbell' ? <PlateStack kg={result.weightKg} /> : null}
                  </>
                ) : null}
                {result.sets.map((set, i) => (
                  <NumberStepper
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
              </Card>
            );
          })}
        </View>
      </ScreenScroll>
      <BottomBar>
        <Button
          title="Save"
          size="lg"
          onPress={() => {
            editSession(log.n, results);
            goBackOr('/');
          }}
        />
      </BottomBar>
    </View>
  );
}
