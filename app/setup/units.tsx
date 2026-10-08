import { router } from 'expo-router';
import { Text } from 'react-native';
import { Button } from '../../src/components/Button';
import { GymSettings } from '../../src/components/GymSettings';
import { Screen } from '../../src/components/Screen';
import { useSetup } from '../../src/setup/SetupContext';
import { type } from '../../src/theme';

export default function Units() {
  const { draft, update } = useSetup();
  return (
    <Screen>
      <Text style={type.title} accessibilityRole="header">
        Your gym
      </Text>
      <Text style={type.body}>Weights you are offered are always ones you can load with these plates.</Text>
      <GymSettings
        unit={draft.unit}
        inventory={draft.inventory}
        onUnitChange={(unit) => update({ unit, weights: {} })}
        onInventoryChange={(patch) => update({ inventory: { ...draft.inventory, ...patch }, weights: {} })}
      />
      <Button title="Next" onPress={() => router.push('/setup/template')} />
    </Screen>
  );
}
