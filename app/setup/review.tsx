import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { LiftRow } from '../../src/components/LiftRow';
import { WeightSheet } from '../../src/components/WeightSheet';
import { useTheme } from '../../src/design/theme';
import { liftKeysOf, validateProgram } from '../../src/domain';
import { liftLabel } from '../../src/format';
import { goHome } from '../../src/navigation';
import { useSetup } from '../../src/setup/SetupContext';
import { startingWeightKg, useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { Section } from '../../src/ui/Section';
import { Card } from '../../src/ui/Surface';
import { Text } from '../../src/ui/Text';

/** Step 3: starting weights. Tap a lift to change its starting weight; "Customise days" edits the plan. */
export default function Review() {
  const { change } = useLocalSearchParams<{ change?: string }>();
  const changing = change === '1';
  const { draft, update } = useSetup();
  const exercises = useStore((s) => s.exercises);
  const storedLifts = useStore((s) => s.lifts);
  const t = useTheme();
  const [editing, setEditing] = useState<string | null>(null);
  if (!draft.program) return <Redirect href="/setup/plan" />;
  const program = draft.program;
  const errors = validateProgram(program, exercises);

  const weightOf = (id: string): number =>
    draft.weights[id] ??
    (changing && storedLifts[id]
      ? storedLifts[id].weightKg
      : startingWeightKg(exercises[id.split('@')[0]], draft.inventory, draft.unit));
  const keys = liftKeysOf(program);

  const apply = () => {
    const store = useStore.getState();
    const commit = () => {
      if (!changing) {
        store.setUnit(draft.unit);
        store.setInventory(draft.inventory);
      }
      store.setProgram(program);
      for (const id of liftKeysOf(program)) {
        if (exercises[id.split('@')[0]]?.kind === 'bodyweight') continue;
        if (changing && draft.weights[id] === undefined) continue;
        const kg = weightOf(id);
        store.setLift(id, changing ? { weightKg: kg } : { weightKg: kg, startKg: kg });
      }
      goHome();
    };
    if (changing && store.draft) {
      Alert.alert(
        'Discard the workout in progress?',
        'Changing plan ends the current workout without logging it.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard and switch', style: 'destructive', onPress: commit },
        ],
      );
    } else {
      commit();
    }
  };

  const editingExercise = editing ? exercises[editing.split('@')[0]] : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <Stack.Screen options={{ title: 'Starting weights' }} />
      <ScreenScroll withBottomBar gap={10}>
        {changing ? null : (
          <Text variant="label" color="textMuted">
            Step 3 of 3
          </Text>
        )}
        <Text color="textMuted">
          Tap a lift to change where it starts. Start light; progression follows your plan.
        </Text>
        <View style={{ gap: t.space[6] }}>
          {keys.map((key) => {
            const exercise = exercises[key.split('@')[0]];
            if (!exercise) return null;
            const bodyweight = exercise.kind === 'bodyweight';
            const label = liftLabel(key, exercises);
            return (
              <Card key={key}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${label}${bodyweight ? '' : ', change starting weight'}`}
                  disabled={bodyweight}
                  onPress={() => setEditing(key)}
                >
                  <LiftRow
                    exercise={{ ...exercise, name: label }}
                    kg={bodyweight ? 0 : weightOf(key)}
                    schemeLabel="Starting weight"
                    unit={draft.unit}
                    inventory={draft.inventory}
                  />
                </Pressable>
              </Card>
            );
          })}
        </View>
        {errors.map((e) => (
          <Text key={e} variant="callout" color="danger">
            {e}
          </Text>
        ))}
        <Section label="Plan">
          <Button
            title="Customise days"
            variant="secondary"
            onPress={() => router.push(changing ? '/setup/days?setup=1&change=1' : '/setup/days?setup=1')}
          />
        </Section>
      </ScreenScroll>
      <BottomBar>
        <Button
          title={changing ? 'Switch plan' : 'Start training'}
          size="lg"
          testID="start-training"
          disabled={errors.length > 0}
          onPress={apply}
        />
      </BottomBar>

      {editing && editingExercise ? (
        <WeightSheet
          visible
          exercise={editingExercise}
          kg={weightOf(editing)}
          unit={draft.unit}
          inventory={draft.inventory}
          onChange={(kg) => update({ weights: { ...draft.weights, [editing]: kg } })}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </View>
  );
}
