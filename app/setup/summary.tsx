import { Redirect, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { PlatesLine } from '../../src/components/PlatesLine';
import { Screen } from '../../src/components/Screen';
import { exerciseIdsOf, formatWeight, sessionFor } from '../../src/domain';
import { nameOf } from '../../src/format';
import { useSetup } from '../../src/setup/SetupContext';
import { startingWeightKg, useStore } from '../../src/store';
import { colors, type } from '../../src/theme';

export default function Summary() {
  const { draft } = useSetup();
  const exercises = useStore((s) => s.exercises);
  if (!draft.program) return <Redirect href="/setup/template" />;
  const program = draft.program;

  const weightOf = (id: string) => draft.weights[id] ?? startingWeightKg(exercises[id], draft.inventory, draft.unit);
  const week = Array.from({ length: program.sessionsPerWeek }, (_, n) => sessionFor(program, n));

  const start = () => {
    const store = useStore.getState();
    store.setUnit(draft.unit);
    store.setInventory(draft.inventory);
    store.setProgram(program);
    for (const id of exerciseIdsOf(program)) {
      if (exercises[id]?.kind === 'bodyweight') continue;
      const kg = weightOf(id);
      store.setLift(id, { weightKg: kg, startKg: kg });
    }
    router.replace('/');
  };

  return (
    <Screen>
      <Text style={type.title} accessibilityRole="header">Week 1</Text>
      {week.map((session, n) => (
        <View key={n} style={styles.card}>
          <Text style={type.heading}>{session.dayName}</Text>
          {session.slots.map(({ exercise: id, scheme }) => (
            <View key={id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{nameOf(exercises, id)}</Text>
                {exercises[id]?.kind === 'bodyweight' ? null : <PlatesLine kg={weightOf(id)} unit={draft.unit} inventory={draft.inventory} />}
              </View>
              <Text style={type.body}>
                {exercises[id]?.kind === 'bodyweight' ? scheme : `${formatWeight(weightOf(id), draft.unit)} · ${scheme}`}
              </Text>
            </View>
          ))}
        </View>
      ))}
      <Button title="Start training" onPress={start} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 8, padding: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
