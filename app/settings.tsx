import { router } from 'expo-router';
import { Alert, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { GymSettings } from '../src/components/GymSettings';
import { Screen } from '../src/components/Screen';
import { Stepper } from '../src/components/Stepper';
import { goHome } from '../src/navigation';
import { useStore } from '../src/store';
import { colors, type } from '../src/theme';

function devSeed() {
  const fixture: unknown = require('../src/domain/__tests__/fixtures/v1-imperial.json');
  const { reset, importLegacy } = useStore.getState();
  reset();
  void importLegacy(JSON.stringify(fixture)).then(goHome);
}

function devFastForward() {
  const { nextSession, startSession, logSet, finishSession } = useStore.getState();
  const draft = startSession(nextSession);
  for (const id of draft.order) draft.results[id].sets.forEach((_s, i) => logSet(id, i, 8));
  finishSession();
}

export default function Settings() {
  const unit = useStore((s) => s.unit);
  const inventory = useStore((s) => s.inventory);
  const minimalist = useStore((s) => s.minimalist);
  const restSeconds = useStore((s) => s.restSeconds);
  const { setUnit, setInventory, setSettings, reset, exportJson } = useStore.getState();

  const confirmReset = () =>
    Alert.alert('Reset everything?', 'This deletes your program, weights and history on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => { reset(); goHome(); } },
    ]);

  return (
    <Screen>
      <Text style={type.title} accessibilityRole="header">Settings</Text>
      <GymSettings unit={unit} inventory={inventory} onUnitChange={setUnit} onInventoryChange={setInventory} />

      <View style={styles.row}>
        <Text style={type.body}>Minimalist workout view</Text>
        <Switch
          accessibilityLabel="Minimalist workout view"
          value={minimalist}
          onValueChange={(v) => setSettings({ minimalist: v })}
        />
      </View>

      <Stepper
        label="Rest time"
        value={restSeconds}
        step={15}
        min={0}
        max={300}
        format={(v) => (v === 0 ? 'Off' : `${v} s`)}
        onChange={(v) => setSettings({ restSeconds: v })}
      />

      <View style={styles.actions}>
        <Button title="Edit program" onPress={() => router.push('/setup/days?edit=1')} />
        <Button title="Exercises" onPress={() => router.push('/exercises')} />
        <Button title="Export backup" onPress={() => void Share.share({ message: exportJson() })} />
        <Button title="Reset" variant="danger" onPress={confirmReset} />
      </View>

      {__DEV__ ? (
        <View style={styles.actions}>
          <Text style={type.label}>Developer</Text>
          <Button title="Seed v1 data" onPress={devSeed} />
          <Button title="Fast-forward" onPress={devFastForward} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  actions: { gap: 10, marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.faint, paddingTop: 16 },
});
