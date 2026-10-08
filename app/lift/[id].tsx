import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { PlatesLine } from '../../src/components/PlatesLine';
import { Screen } from '../../src/components/Screen';
import { Stepper } from '../../src/components/Stepper';
import { WeightStepper } from '../../src/components/WeightStepper';
import { smallestStep, toKg, toUnit, trim } from '../../src/domain';
import { formatDate, nameOf } from '../../src/format';
import { useInventory, useLift, useStore, useUnit } from '../../src/store';
import { colors, type } from '../../src/theme';

export default function LiftEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = useStore((s) => s.exercises[id]);
  const lift = useLift(id);
  const sessions = useStore((s) => s.sessions);
  const unit = useUnit();
  const inventory = useInventory();
  const exercises = useStore((s) => s.exercises);
  const setLift = useStore((s) => s.setLift);

  if (!exercise || !lift) {
    return (
      <Screen>
        <Text style={type.body}>This lift is not part of your program.</Text>
      </Screen>
    );
  }

  const history = [...sessions]
    .reverse()
    .filter((s) => s.results[id])
    .map((s) => ({ n: s.n, date: s.finishedAt ?? s.startedAt, weightKg: s.results[id].weightKg, reps: s.results[id].sets.at(-1)?.reps ?? 0 }));
  const bestAmrap = history.reduce((best, h) => Math.max(best, h.reps), 0);
  const oneRm = lift.weightKg * (1 + bestAmrap / 30);

  const increment = (lift.incrementOverride ?? exercise.increment)[unit];
  const jump = smallestStep(inventory, unit);
  const offGrid = exercise.kind === 'barbell' && jump > 0 && Math.abs(increment / jump - Math.round(increment / jump)) > 1e-9;
  const setIncrement = (v: number) => {
    const other = unit === 'kg' ? 'lb' : 'kg';
    const base = lift.incrementOverride ?? exercise.increment;
    setLift(id, {
      incrementOverride: { ...base, [unit]: v, [other]: Math.round(toUnit(toKg(v, unit), other) * 4) / 4 } as { kg: number; lb: number },
    });
  };

  return (
    <Screen image={exercise.background}>
      <Stack.Screen options={{ title: exercise.shortName }} />
      <Text style={type.title} accessibilityRole="header">{nameOf(exercises, id)}</Text>

      <WeightStepper label="Working weight" large exercise={exercise} kg={lift.weightKg} onChange={(kg) => setLift(id, { weightKg: kg })} />
      <View style={{ alignItems: 'center' }}><PlatesLine kg={lift.weightKg} /></View>

      <WeightStepper label="Start weight" exercise={exercise} kg={lift.startKg} onChange={(kg) => setLift(id, { startKg: kg })} />

      <Stepper
        label="Increment per session"
        value={increment}
        step={0.25}
        min={0}
        format={(v) => `${trim(v)} ${unit}`}
        onChange={setIncrement}
      />
      {offGrid ? (
        <Text style={type.error}>{`Not a multiple of your smallest jump (${trim(jump)} ${unit}); weights round up to the next plate.`}</Text>
      ) : null}

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={type.label}>Failed AMRAPs in a row</Text>
        <Text style={type.heading}>{lift.fails}</Text>
        <Button title="Reset fails" variant="link" disabled={lift.fails === 0} onPress={() => setLift(id, { fails: 0 })} />
      </View>

      {bestAmrap > 0 ? (
        <Text style={[type.body, { textAlign: 'center' }]}>{`Estimated 1RM ${trim(toUnit(oneRm, unit))} ${unit} (best AMRAP ${bestAmrap})`}</Text>
      ) : null}

      {history.length > 0 ? <Text style={[type.heading, { marginTop: 16 }]}>History</Text> : null}
      {history.map((h) => (
        <View key={h.n} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.faint }}>
          <Text style={type.small}>{formatDate(h.date)}</Text>
          <Text style={type.body}>{`${trim(toUnit(h.weightKg, unit))} ${unit} × ${h.reps}`}</Text>
        </View>
      ))}
    </Screen>
  );
}
