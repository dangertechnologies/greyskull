import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { LiftChart } from '../../src/components/LiftChart';
import { TechniqueLinks } from '../../src/components/TechniqueLinks';
import { WeightStepper } from '../../src/components/WeightStepper';
import { useTheme } from '../../src/design/theme';
import type { LiftState } from '../../src/domain';
import {
  DEFAULT_RULES,
  exerciseOfLift,
  formatWeight,
  incrementFor,
  liftKeyOf,
  smallestStep,
  toKg,
  trim,
} from '../../src/domain';
import { formatDate, liftLabel } from '../../src/format';
import { resultFor, seriesPoints } from '../../src/series';
import { useInventory, useLift, useProgram, useStore, useUnit } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { EmptyState } from '../../src/ui/EmptyState';
import { ListRow } from '../../src/ui/ListRow';
import { ScreenScroll } from '../../src/ui/layout';
import { NumberStepper } from '../../src/ui/NumberStepper';
import { PlateStack } from '../../src/ui/PlateStack';
import { Section } from '../../src/ui/Section';
import { Text } from '../../src/ui/Text';

/** One lift: chart and stats on top, then the controls to change its weights and increment, then history. */
export default function LiftDetail() {
  // `?program=<id>`: lift states belong to a program; without one, the first program that is not paused.
  const { id, program: programParam } = useLocalSearchParams<{ id: string; program?: string }>();
  const programId = useProgram(programParam)?.id;
  const exercise = useStore((s) => s.exercises[exerciseOfLift(id)]);
  const lift = useLift(programId, id);
  const sessions = useStore((s) => s.sessions);
  const unit = useUnit();
  const exercises = useStore((s) => s.exercises);
  const t = useTheme();

  if (!exercise) {
    return (
      <ScreenScroll>
        <EmptyState
          icon="lift"
          title="Exercise not found"
          body="It may have been deleted. Your history keeps its sets."
          action={{ title: 'All exercises', onPress: () => router.replace('/exercises') }}
        />
      </ScreenScroll>
    );
  }

  const bodyweight = exercise.kind === 'bodyweight';
  const points = seriesPoints(sessions, exercise, unit, id);
  const history = [...sessions].reverse().flatMap((s) => {
    const result = resultFor(s, id);
    return result
      ? [
          {
            n: s.n,
            date: s.finishedAt ?? s.startedAt,
            weightKg: result.weightKg,
            reps: result.sets.at(-1)?.reps ?? 0,
          },
        ]
      : [];
  });
  const trainingMax = sessions.some((s) => resultFor(s, id)?.tmKg !== undefined);
  const bestAmrap = history.reduce((best, h) => Math.max(best, h.reps), 0);

  return (
    <ScreenScroll gap={10}>
      <Stack.Screen options={{ title: liftLabel(id, exercises) }} />
      <TechniqueLinks exercise={exercise} />

      <LiftChart
        label={liftLabel(id, exercises)}
        points={points}
        format={(v) => (bodyweight ? `${trim(v)} reps` : formatWeight(toKg(v, unit), unit))}
      />

      <Section label="Stats" card>
        <View style={{ gap: t.space[2], paddingVertical: t.space[4] }}>
          {lift && !bodyweight ? (
            <Text>{`${formatWeight(lift.startKg, unit)} → ${formatWeight(lift.weightKg, unit)}`}</Text>
          ) : null}
          <Text>{bestAmrap > 0 ? `Best last set: ${bestAmrap} reps` : 'No sets logged yet'}</Text>
          {lift && !bodyweight && bestAmrap > 0 && !trainingMax ? (
            <Text>{`Estimated 1RM ${formatWeight(lift.weightKg * (1 + bestAmrap / 30), unit)}`}</Text>
          ) : null}
        </View>
      </Section>

      {lift && !bodyweight && programId ? <LiftControls id={id} programId={programId} /> : null}

      {history.length > 0 ? (
        <Section label="History" card>
          {history.map((h) => (
            <ListRow
              key={h.n}
              title={`${formatWeight(h.weightKg, unit)} × ${h.reps}`}
              subtitle={formatDate(h.date)}
            />
          ))}
        </Section>
      ) : null}
    </ScreenScroll>
  );
}

function LiftControls({ id, programId }: { id: string; programId: string }) {
  const exercise = useStore((s) => s.exercises[exerciseOfLift(id)]);
  const current = useLift(programId, id);
  const unit = useUnit();
  const inventory = useInventory();
  const program = useProgram(programId);
  const setLift = (key: string, patch: Partial<LiftState>) =>
    useStore.getState().setLift(programId, key, patch);
  const t = useTheme();
  if (!current || !exercise) return null;
  const trainingMax = program?.days.some((day) =>
    day.slots.some(
      (slot) => liftKeyOf(slot) === id && (slot.progression ?? program.rules.progression) === '531',
    ),
  );
  const planIncrement = program?.rules.increments?.[exercise.id] ?? exercise.increment;
  const increment = incrementFor(current, program?.rules ?? DEFAULT_RULES, exercise, unit);
  const jump = smallestStep(inventory, unit);
  const offGrid =
    exercise.kind === 'barbell' &&
    jump > 0 &&
    Math.abs(increment / jump - Math.round(increment / jump)) > 1e-9;
  // Only the unit being edited changes; the other keeps its own default (1.25 kg ≠ 2.75 lb on real plates).
  const setIncrement = (v: number) =>
    setLift(id, { incrementOverride: { ...(current.incrementOverride ?? planIncrement), [unit]: v } });
  return (
    <>
      <Section card>
        <View style={{ gap: t.space[4], paddingVertical: t.space[5], alignItems: 'center' }}>
          <WeightStepper
            label={trainingMax ? 'Training max' : 'Working weight'}
            large
            exercise={exercise}
            kg={current.weightKg}
            onChange={(kg) => setLift(id, { weightKg: kg })}
          />
          {exercise.kind === 'barbell' ? <PlateStack kg={current.weightKg} /> : null}
        </View>
      </Section>

      <Section
        label="Progression"
        footer={
          offGrid
            ? `Not a multiple of your smallest jump (${trim(jump)} ${unit}); weights round up to the next plate.`
            : undefined
        }
        card
      >
        <WeightStepper
          inline
          label="Start weight"
          exercise={exercise}
          kg={current.startKg}
          onChange={(kg) => setLift(id, { startKg: kg })}
        />
        <NumberStepper
          inline
          label="Increment per session"
          value={increment}
          step={0.25}
          min={0}
          format={(v) => `${trim(v)} ${unit}`}
          onChange={setIncrement}
        />
        <ListRow
          title="Failed sets in a row"
          value={String(current.fails)}
          accessory={
            <Button
              title="Reset"
              variant="plain"
              disabled={current.fails === 0}
              onPress={() => setLift(id, { fails: 0 })}
            />
          }
        />
      </Section>
    </>
  );
}
