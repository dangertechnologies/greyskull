import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { GymSettings } from '../../src/components/GymSettings';
import { useTheme } from '../../src/design/theme';
import { toKg } from '../../src/domain';
import { useSetup } from '../../src/setup/SetupContext';
import { Button } from '../../src/ui/Button';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { PlateStack } from '../../src/ui/PlateStack';
import { Section } from '../../src/ui/Section';
import { Text } from '../../src/ui/Text';

export default function Gym() {
  const { draft, update } = useSetup();
  const t = useTheme();
  const example = toKg(draft.unit === 'kg' ? 100 : 225, draft.unit);
  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <Stack.Screen options={{ title: 'Step 1 of 3' }} />
      <ScreenScroll withBottomBar gap={10}>
        <Text variant="title" accessibilityRole="header">
          Your gym
        </Text>
        <Text color="textMuted">
          Tell us what you lift with. Every weight you are offered can be loaded on your bar.
        </Text>
        <GymSettings
          unit={draft.unit}
          inventory={draft.inventory}
          onUnitChange={(unit) => update({ unit, weights: {} })}
          onInventoryChange={(patch) => update({ inventory: { ...draft.inventory, ...patch }, weights: {} })}
        />
        <Section label={`Example: ${draft.unit === 'kg' ? '100 kg' : '225 lb'}`}>
          <PlateStack kg={example} unit={draft.unit} inventory={draft.inventory} />
        </Section>
      </ScreenScroll>
      <BottomBar>
        <Button title="Next" size="lg" testID="setup-next" onPress={() => router.push('/setup/plan')} />
      </BottomBar>
    </View>
  );
}
