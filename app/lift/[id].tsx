import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { LiftChart } from '../../src/components/LiftChart';
import { TechniqueLinks } from '../../src/components/TechniqueLinks';
import { WeightStepper } from '../../src/components/WeightStepper';
import { useTheme } from '../../src/design/theme';
import { DEFAULT_RULES, formatWeight, incrementFor, smallestStep, toUnit, trim } from '../../src/domain';
import { formatDate, nameOf } from '../../src/format';
import { seriesPoints } from '../../src/series';
import { useInventory, useLift, useStore, useUnit } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { ListRow } from '../../src/ui/ListRow';
import { ScreenScroll } from '../../src/ui/layout';
import { NumberStepper } from '../../src/ui/NumberStepper';
import { PlateStack } from '../../src/ui/PlateStack';
import { Section } from '../../src/ui/Section';
import { Text } from '../../src/ui/Text';

/** One lift: chart and stats on top, then the controls to change its weights and increment, then history. */
export default function LiftDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = useStore((s) => s.exercises[id]);
  const lift = useLift(id);
  const sessions = useStore((s) => s.sessions);
  const unit = useUnit();
  const exercises = useStore((s) => s.exercises);
  const t = useTheme();

  if (!exercise) {
    return (
      <ScreenScroll>
        <Text>This exercise no longer exists.</Text>
      </ScreenScroll>
    );
  }

  const bodyweight = exercise.kind === 'bodyweight';
  const points = seriesPoints(sessions, exercise, unit);
  const history = [...sessions]
    .reverse()
    .filter((s) => s.results[id])
    .map((s) => ({
      n: s.n,
      date: s.finishedAt ?? s.startedAt,
      weightKg: s.results[id].weightKg,
      reps: s.results[id].sets.at(-1)?.reps ?? 0,
    }));
  const bestAmrap = history.reduce((best, h) => Math.max(best, h.reps), 0);

  return (
    <ScreenScroll gap={10}>
      <Stack.Screen options={{ title: exercise.shortName }} />
      <View style={{ gap: t.space[3] }}>
        <Text variant="title" accessibilityRole="header">
          {nameOf(exercises, id)}
        </Text>
        <TechniqueLinks exercise={exercise} />
      </View>

      <LiftChart
        label={exercise.name}
        points={points}
        format={(v) => (bodyweight ? `${trim(v)} reps` : `${trim(v)} ${unit}`)}
      />

      <Section label="Stats">
        <View style={{ gap: t.space[2] }}>
          {lift && !bodyweight ? (
            <Text>{`${formatWeight(lift.startKg, unit)} → ${formatWeight(lift.weightKg, unit)}`}</Text>
          ) : null}
          <Text>{bestAmrap > 0 ? `Best last set: ${bestAmrap} reps` : 'No sets logged yet'}</Text>
          {lift && !bodyweight && bestAmrap > 0 ? (
            <Text>{`Estimated 1RM ${formatWeight(lift.weightKg * (1 + bestAmrap / 30), unit)}`}</Text>
          ) : null}
        </View>
      </Section>

      {lift && !bodyweight ? <LiftControls id={id} /> : null}

      {history.length > 0 ? (
        <Section label="History">
          <View>
            {history.map((h) => (
              <ListRow
                key={h.n}
                title={`${trim(toUnit(h.weightKg, unit))} ${unit} × ${h.reps}`}
                subtitle={formatDate(h.date)}
              />
            ))}
          </View>
        </Section>
      ) : null}
    </ScreenScroll>
  );
}

function LiftControls({ id }: { id: string }) {
  const exercise = useStore((s) => s.exercises[id]);
  const current = useLift(id);
  const unit = useUnit();
  const inventory = useInventory();
  const program = useStore((s) => s.program);
  const setLift = useStore((s) => s.setLift);
  const t = useTheme();
  if (!current || !exercise) return null;
  const planIncrement = program?.rules.increments?.[id] ?? exercise.increment;
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
      <Section label="Working weight">
        <WeightStepper
          label="Working weight"
          large
          exercise={exercise}
          kg={current.weightKg}
          onChange={(kg) => setLift(id, { weightKg: kg })}
        />
        {exercise.kind === 'barbell' ? <PlateStack kg={current.weightKg} /> : null}
      </Section>

      <Section
        label="Progression"
        footer={
          offGrid
            ? `Not a multiple of your smallest jump (${trim(jump)} ${unit}); weights round up to the next plate.`
            : undefined
        }
      >
        <View style={{ gap: t.space[8] }}>
          <WeightStepper
            label="Start weight"
            exercise={exercise}
            kg={current.startKg}
            onChange={(kg) => setLift(id, { startKg: kg })}
          />
          <NumberStepper
            label="Increment per session"
            value={increment}
            step={0.25}
            min={0}
            format={(v) => `${trim(v)} ${unit}`}
            onChange={setIncrement}
          />
          <View style={{ alignItems: 'center', gap: t.space[2] }}>
            <Text variant="label" color="textMuted">
              Failed sets in a row
            </Text>
            <Text variant="headline">{current.fails}</Text>
            <Button
              title="Reset fails"
              variant="plain"
              disabled={current.fails === 0}
              onPress={() => setLift(id, { fails: 0 })}
            />
          </View>
        </View>
      </Section>
    </>
  );
}
