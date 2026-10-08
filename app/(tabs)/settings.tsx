import { router } from 'expo-router';
import { Alert, Share } from 'react-native';
import { GymSettings } from '../../src/components/GymSettings';
import { haptics } from '../../src/design/haptics';
import { importFromClipboard, importFromFile } from '../../src/importFlow';
import { goHome } from '../../src/navigation';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { ListRow } from '../../src/ui/ListRow';
import { ScreenScroll } from '../../src/ui/layout';
import { NumberStepper } from '../../src/ui/NumberStepper';
import { Section } from '../../src/ui/Section';
import { SegmentedControl } from '../../src/ui/SegmentedControl';
import { Text } from '../../src/ui/Text';

function devSeed() {
  const fixture: unknown = require('../../src/dev/v1-imperial.json');
  const { reset, importLegacy } = useStore.getState();
  reset();
  void importLegacy(JSON.stringify(fixture)).then(goHome);
}

function devFastForward() {
  const { nextSession, startSession, logSet, finishSession } = useStore.getState();
  const draft = startSession(nextSession);
  for (const id of draft.order) {
    draft.results[id].sets.forEach((_s, i) => {
      logSet(id, i, 8);
    });
  }
  finishSession();
}

export default function Settings() {
  const unit = useStore((s) => s.unit);
  const inventory = useStore((s) => s.inventory);
  const minimalist = useStore((s) => s.minimalist);
  const restSeconds = useStore((s) => s.restSeconds);
  const appearance = useStore((s) => s.appearance);
  const hapticsEnabled = useStore((s) => s.hapticsEnabled);
  const { setUnit, setInventory, setSettings, reset, exportJson } = useStore.getState();

  const confirmReset = () => {
    haptics.warn();
    Alert.alert('Reset everything?', 'This deletes your program, weights and history on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          reset();
          goHome();
        },
      },
    ]);
  };

  return (
    <ScreenScroll headerless gap={10}>
      <Text variant="title" accessibilityRole="header">
        Settings
      </Text>

      <GymSettings
        unit={unit}
        inventory={inventory}
        onUnitChange={setUnit}
        onInventoryChange={setInventory}
      />

      <Section label="Workout">
        <ListRow
          title="Minimalist workout view"
          subtitle="All sets on one page"
          accessory="switch"
          switchValue={minimalist}
          onSwitch={(v) => setSettings({ minimalist: v })}
        />
        <NumberStepper
          label="Rest time"
          value={restSeconds}
          step={15}
          min={0}
          max={300}
          format={(v) => (v === 0 ? 'Off' : `${v} s`)}
          onChange={(v) => setSettings({ restSeconds: v })}
        />
      </Section>

      <Section label="Appearance">
        <SegmentedControl
          accessibilityLabel="Appearance"
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={appearance}
          onChange={(v) => setSettings({ appearance: v as 'system' | 'light' | 'dark' })}
        />
        <ListRow
          title="Haptic feedback"
          accessory="switch"
          switchValue={hapticsEnabled}
          onSwitch={(v) => setSettings({ hapticsEnabled: v })}
        />
      </Section>

      <Section label="Data">
        <Button
          title="Export backup"
          variant="secondary"
          icon="share"
          onPress={() => void Share.share({ message: exportJson() })}
        />
        <Button
          title="Import backup"
          variant="secondary"
          icon="import"
          onPress={() =>
            Alert.alert('Import backup', 'Restore from a backup you exported earlier.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Paste from clipboard', onPress: () => void importFromClipboard(goHome) },
              { text: 'Choose file…', onPress: () => void importFromFile(goHome) },
            ])
          }
        />
        <Button title="Reset" variant="destructive" onPress={confirmReset} />
      </Section>

      {__DEV__ ? (
        <Section label="Developer">
          <Button title="Seed v1 data" variant="secondary" onPress={devSeed} />
          <Button title="Fast-forward" variant="secondary" onPress={devFastForward} />
          <Button title="Design gallery" variant="secondary" onPress={() => router.push('/gallery')} />
        </Section>
      ) : null}
    </ScreenScroll>
  );
}
