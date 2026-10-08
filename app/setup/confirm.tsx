import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { PlatesLine } from '../../src/components/PlatesLine';
import { Screen } from '../../src/components/Screen';
import { WeightStepper } from '../../src/components/WeightStepper';
import { exerciseIdsOf, roundForExercise } from '../../src/domain';
import { useStore } from '../../src/store';
import { type } from '../../src/theme';

export default function ConfirmWeights() {
  const exercises = useStore((s) => s.exercises);
  const program = useStore((s) => s.program);
  const suspects = useStore((s) => s.needsWeightConfirmSuspects);
  const storedLifts = useStore((s) => s.lifts);
  const confirmWeights = useStore((s) => s.confirmWeights);
  const unit = useStore((s) => s.unit);
  const inventory = useStore((s) => s.inventory);

  const ids = (program ? exerciseIdsOf(program) : []).filter((id) => storedLifts[id] && exercises[id]?.kind !== 'bodyweight');
  const [weights, setWeights] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      ids.map((id) => [id, roundForExercise(storedLifts[id].weightKg, exercises[id], 'nearest', inventory, unit)]),
    ),
  );

  return (
    <Screen>
      <Text style={type.title} accessibilityRole="header">Check your weights</Text>
      <Text style={type.body}>We moved your data from the old version. Please check these weights.</Text>
      {ids.map((id) => (
        <View key={id} style={styles.row}>
          <Text style={type.heading}>{exercises[id].name}</Text>
          {suspects.includes(id) ? <Text style={type.error}>looks wrong</Text> : null}
          <WeightStepper exercise={exercises[id]} kg={weights[id]} onChange={(kg) => setWeights((w) => ({ ...w, [id]: kg }))} />
          <PlatesLine kg={weights[id]} />
        </View>
      ))}
      <Button
        title="Confirm"
        onPress={() => {
          confirmWeights(weights);
          router.replace('/');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { gap: 6, alignItems: 'center', paddingVertical: 8 } });
