import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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
  stepIn,
  toKg,
  trim,
} from '../../src/domain';
import { belongsTo, formatDate, liftLabel, nameOf, weightLabel } from '../../src/format';
import { useProgramById } from '../../src/hooks/useProgramById';
import { chartsAddedLoad, resultFor, seriesPoints } from '../../src/series';
import { useInventory, useLift, useStore, useUnit } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { EmptyState } from '../../src/ui/EmptyState';
import { ListRow } from '../../src/ui/ListRow';
import { ScreenScroll } from '../../src/ui/layout';
import { NumberStepper } from '../../src/ui/NumberStepper';
import { PlateStack } from '../../src/ui/PlateStack';
import { Section } from '../../src/ui/Section';
import { SegmentedControl } from '../../src/ui/SegmentedControl';
import { Text } from '../../src/ui/Text';
import { ladderAt } from '../../src/views/ladder';

/** One lift: chart and stats on top, then the controls to change its weights and increment, then history. */
export default function LiftDetail() {
  // `?program=<id>`: lift states belong to a program. Without one the screen shows history across programs only.
  const { id, program: programParam } = useLocalSearchParams<{ id: string; program?: string }>();
  const program = useProgramById(programParam);
  const programId = program?.id;
  const exercises = useStore((s) => s.exercises);
  const ladder = ladderAt(id, program?.lifts[id], exercises);
  const exercise = ladder ? ladder.exercise : exercises[exerciseOfLift(id)];
  const lift = useLift(programId, id);
  const sessions = useStore((s) => s.sessions);
  const unit = useUnit();
  const t = useTheme();
  const [scope, setScope] = useState<'program' | 'all'>('program');

  if (programParam && !program) {
    return (
      <ScreenScroll>
        <EmptyState
          icon="progress"
          title="Program not found"
          body="It may have been removed. Its workouts stay in your history."
          action={{ title: 'Progress', onPress: () => router.replace('/progress') }}
        />
      </ScreenScroll>
    );
  }
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

  const title = ladder?.ladder.name ?? liftLabel(id, exercises);
  const own = program && scope === 'program' ? sessions.filter((s) => belongsTo(s, program)) : sessions;
  const bodyweight = exercise.kind === 'bodyweight';
  const loadCharted = chartsAddedLoad(own, exercise, id);
  const points = seriesPoints(own, exercise, unit, id, exercises);
  // A ladder level is the step plus progress through it; people count steps from 1.
  const stepName = (v: number) =>
    ladder ? nameOf(exercises, ladder.ladder.steps[stepIn(ladder.ladder, Math.floor(v))].exercise) : '';
  const format = (v: number): string =>
    ladder
      ? `Level ${trim(v + 1, 1)}`
      : bodyweight && !loadCharted
        ? `${trim(v)} ${exercise.timed ? 's' : 'reps'}`
        : `${bodyweight ? '+' : ''}${formatWeight(toKg(v, unit), unit)}`;
  const history = [...own].reverse().flatMap((s) => {
    const result = resultFor(s, id);
    if (!result) return [];
    const done = ladder && result.step !== undefined ? ladder.ladder.steps[result.step]?.exercise : undefined;
    const reps = result.sets.at(-1)?.reps ?? 0;
    const amount = `${reps}${result.timed ? ' s' : ''}`;
    const load = weightLabel(result.weightKg, exercise, unit).trim();
    return [
      {
        n: s.n,
        date: s.finishedAt ?? s.startedAt,
        reps,
        title: done
          ? `${nameOf(exercises, done)} · ${load ? `${load} × ` : ''}${amount}`
          : `${load || 'Bodyweight'} × ${amount}`,
      },
    ];
  });
  const trainingMax = own.some((s) => resultFor(s, id)?.tmKg !== undefined);
  const bestAmrap = history.reduce((best, h) => Math.max(best, h.reps), 0);
  const loaded = !bodyweight || (lift?.weightKg ?? 0) > 0 || (lift?.startKg ?? 0) > 0;

  return (
    <ScreenScroll gap={10}>
      <Stack.Screen options={{ title }} />
      <TechniqueLinks exercise={exercise} />

      {program ? (
        <SegmentedControl
          accessibilityLabel="Workouts to chart"
          options={[
            { value: 'program', label: 'This program' },
            { value: 'all', label: 'All programs' },
          ]}
          value={scope}
          onChange={(v) => setScope(v as 'program' | 'all')}
        />
      ) : null}

      <LiftChart
        label={title}
        points={points}
        format={format}
        axisFormat={ladder ? (v) => `${Math.floor(v) + 1} ${stepName(v)}` : format}
      />

      <Section label="Stats" card>
        <View style={{ gap: t.space[2], paddingVertical: t.space[4] }}>
          {ladder && lift ? (
            <Text>{`Step now: ${nameOf(exercises, ladder.ladder.steps[ladder.step].exercise)} · ${ladder.step + 1} of ${ladder.ladder.steps.length}`}</Text>
          ) : null}
          {lift && loaded ? (
            <Text>{`${weightLabel(lift.startKg, exercise, unit).trim() || 'Bodyweight'} → ${weightLabel(lift.weightKg, exercise, unit).trim() || 'bodyweight'}`}</Text>
          ) : null}
          <Text>
            {bestAmrap > 0
              ? `Best last set: ${bestAmrap} ${exercise.timed && !ladder ? 's' : 'reps'}`
              : 'No sets logged yet'}
          </Text>
          {lift && !bodyweight && bestAmrap > 0 && !trainingMax ? (
            <Text>{`Estimated 1RM ${formatWeight(lift.weightKg * (1 + bestAmrap / 30), unit)}`}</Text>
          ) : null}
        </View>
        {ladder && programId ? (
          <Button
            title="See the ladder"
            variant="plain"
            onPress={() => router.push(`/ladder/${ladder.ladder.id}?program=${programId}`)}
          />
        ) : null}
      </Section>

      {lift && !bodyweight && programId ? <LiftControls id={id} programId={programId} /> : null}

      {history.length > 0 ? (
        <Section label="History" card>
          {history.map((h) => (
            <ListRow key={h.n} title={h.title} subtitle={formatDate(h.date)} />
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
  const program = useProgramById(programId);
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
          {exercise.kind === 'barbell' ? <PlateStack kg={current.weightKg} exercise={exercise} /> : null}
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
