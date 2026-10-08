import { Redirect, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { PlatesLine } from '../../src/components/PlatesLine';
import { Screen } from '../../src/components/Screen';
import { WeightStepper } from '../../src/components/WeightStepper';
import { exerciseIdsOf } from '../../src/domain';
import { useSetup } from '../../src/setup/SetupContext';
import { startingWeightKg, useStore } from '../../src/store';
import { type } from '../../src/theme';

export default function Weights() {
  const { draft, update } = useSetup();
  const exercises = useStore((s) => s.exercises);
  if (!draft.program) return <Redirect href="/setup/template" />;

  const ids = exerciseIdsOf(draft.program).filter(
    (id) => exercises[id] && exercises[id].kind !== 'bodyweight',
  );
  const weightOf = (id: string) =>
    draft.weights[id] ?? startingWeightKg(exercises[id], draft.inventory, draft.unit);

  return (
    <Screen>
      <Text style={type.title} accessibilityRole="header">
        Starting weights
      </Text>
      <Text style={type.body}>Start light. You add weight every session, so a bar-only start is fine.</Text>
      {ids.map((id) => (
        <View key={id} style={styles.row}>
          <Text style={type.heading}>{exercises[id].name}</Text>
          <WeightStepper
            exercise={exercises[id]}
            unit={draft.unit}
            inventory={draft.inventory}
            kg={weightOf(id)}
            onChange={(kg) => update({ weights: { ...draft.weights, [id]: kg } })}
          />
          <PlatesLine kg={weightOf(id)} unit={draft.unit} inventory={draft.inventory} />
        </View>
      ))}
      <Button title="Start with the bar" variant="link" onPress={() => update({ weights: {} })} />
      <Button title="Next" onPress={() => router.push('/setup/summary')} />
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { gap: 6, alignItems: 'center', paddingVertical: 8 } });
