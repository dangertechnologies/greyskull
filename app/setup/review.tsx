import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { LiftRow } from '../../src/components/LiftRow';
import { WeightSheet } from '../../src/components/WeightSheet';
import { getPlan } from '../../src/config/plans';
import { useTheme } from '../../src/design/theme';
import { exerciseOfLift, liftKeysOf, validateProgram } from '../../src/domain';
import { liftLabel } from '../../src/format';
import { useProgramById } from '../../src/hooks/useProgramById';
import { goHome } from '../../src/navigation';
import { uniqueProgramName } from '../../src/programPicker';
import { useSetup } from '../../src/setup/SetupContext';
import { startingWeightKg, useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { Section } from '../../src/ui/Section';
import { Card } from '../../src/ui/Surface';
import { Text } from '../../src/ui/Text';

/** Step 3: starting weights. Tap a lift to change its starting weight; "Customise days" edits the plan. */
export default function Review() {
  const {
    change,
    add,
    custom,
    program: programId,
  } = useLocalSearchParams<{ change?: string; add?: string; custom?: string; program?: string }>();
  const changing = change === '1';
  // Adding a program to the ones already running: the unit and plates are already set up.
  const adding = add === '1';
  const { draft, update } = useSetup();
  const exercises = useStore((s) => s.exercises);
  const customPlans = useStore((s) => s.customPlans);
  const current = useProgramById(changing ? programId : undefined);
  const storedLifts = current?.lifts ?? {};
  const t = useTheme();
  const [editing, setEditing] = useState<string | null>(null);
  if (changing && !current) return <Redirect href="/" />;
  if (!draft.program) return <Redirect href="/setup/plan" />;
  const program = draft.program;
  const errors = validateProgram(program, exercises);

  const weightOf = (id: string): number =>
    draft.weights[id] ??
    (changing && storedLifts[id]
      ? storedLifts[id].weightKg
      : startingWeightKg(exercises[exerciseOfLift(id)], draft.inventory, draft.unit));
  const keys = liftKeysOf(program);

  const apply = () => {
    const store = useStore.getState();
    const commit = () => {
      if (!changing && !adding) {
        store.setUnit(draft.unit);
        store.setInventory(draft.inventory);
      }
      let savedId: string;
      if (changing && current) {
        store.updateProgram(current.id, program);
        savedId = current.id;
      } else {
        savedId = store.addProgram({
          ...program,
          name: uniqueProgramName(
            customPlans.find((c) => c.id === custom)?.name ??
              getPlan(program.template)?.name ??
              'Custom program',
            store.programs.map((p) => p.name),
          ),
        });
      }
      for (const id of liftKeysOf(program)) {
        // Bodyweight lifts start without added load unless the user set some here.
        const bodyweight = exercises[exerciseOfLift(id)]?.kind === 'bodyweight';
        if ((bodyweight || changing) && draft.weights[id] === undefined) continue;
        const kg = weightOf(id);
        store.setLift(savedId, id, changing ? { weightKg: kg } : { weightKg: kg, startKg: kg });
      }
      goHome();
    };
    if (changing && current && store.draft?.programId === current.id) {
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

  const editingExercise = editing ? exercises[exerciseOfLift(editing)] : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <Stack.Screen options={{ title: 'Starting weights' }} />
      <ScreenScroll withBottomBar gap={10}>
        {changing || adding ? null : (
          <Text variant="label" color="textMuted">
            Step 3 of 3
          </Text>
        )}
        <Text color="textMuted">
          Tap a lift to change where it starts. Start light; progression follows your plan.
        </Text>
        <View style={{ gap: t.space[6] }}>
          {keys.map((key) => {
            const exercise = exercises[exerciseOfLift(key)];
            if (!exercise) return null;
            const bodyweight = exercise.kind === 'bodyweight';
            const label = liftLabel(key, exercises);
            // 5/3/1 lifts store a training max, not the weight of the first set.
            const trainingMax = program.days.some((d) =>
              d.slots.some((slot) => slot.progression === '531' && slot.exercise === key),
            );
            return (
              <Card key={key}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${label}, ${bodyweight ? 'change added load' : 'change starting weight'}`}
                  onPress={() => setEditing(key)}
                >
                  <LiftRow
                    exercise={{ ...exercise, name: label }}
                    kg={weightOf(key)}
                    schemeLabel={
                      trainingMax
                        ? 'Training max (90 % of your 1RM)'
                        : bodyweight
                          ? 'Added load'
                          : 'Starting weight'
                    }
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
          title={changing ? 'Switch plan' : adding ? 'Add program' : 'Start training'}
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
