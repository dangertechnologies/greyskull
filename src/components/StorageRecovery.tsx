import type { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useTheme } from '../design/theme';
import { confirmAndApply, importFromFile } from '../importFlow';
import { isWhole, listCopies, PREV_FILE, STATE_FILE, stateFile, TMP_FILE } from '../storage';
import { initialState, initStore, useStore } from '../store';
import { Button } from '../ui/Button';
import { ScreenScroll } from '../ui/layout';
import { Text } from '../ui/Text';

/** The files a save rotates through that exist, `state.json` first. */
const saved = () => [STATE_FILE, TMP_FILE, PREV_FILE].map((name) => stateFile(name)).filter((f) => f.exists);

/**
 * Shown instead of the app when the saved data cannot be read. Nothing is written while it shows, so the
 * file stays as it was: the user can try again, send the file somewhere safe, go back to the previous save,
 * restore a backup or start fresh. The last three first keep every data file as a copy.
 */
export function StorageRecovery({ error }: { error: string }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [previous, setPrevious] = useState<string | null>(null);

  useEffect(() => {
    const file = stateFile(PREV_FILE);
    if (!file.exists) return;
    file.text().then(
      (raw) => setPrevious(isWhole(raw) ? raw : null),
      () => undefined,
    );
  }, []);

  const retry = async () => {
    setBusy(true);
    await initStore();
    setBusy(false);
  };

  const share = async (file: File) => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing is not available', 'This device cannot share files.');
      return;
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export your data file',
    });
  };

  const exportFile = async () => {
    const file = saved().at(0);
    if (!file) {
      Alert.alert('No data file', 'There is no saved data file on this device to export.');
      return;
    }
    await share(file);
  };

  const startFresh = () =>
    Alert.alert(
      'Start fresh?',
      'The app starts empty. Your data files stay on this device as copies you can export from Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start fresh',
          style: 'destructive',
          onPress: () => void useStore.getState().importBackup(initialState()),
        },
      ],
    );

  // The other files the next save replaces, and every copy kept from earlier loads, restores and upgrades.
  const others = [...saved().slice(1), ...listCopies()];

  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <ScreenScroll headerless gap={8}>
        <Text variant="title" accessibilityRole="header">
          Your data could not be loaded
        </Text>
        <Text color="textMuted">
          Nothing has been changed or overwritten. Try again, export the data file to keep a copy, or restore
          a backup.
        </Text>
        <Text variant="caption" color="textMuted">
          {error}
        </Text>
        <View style={{ gap: t.space[3] }}>
          <Button title="Try again" size="lg" disabled={busy} onPress={() => void retry()} />
          <Button title="Export the data file" variant="secondary" onPress={() => void exportFile()} />
          {others.length > 0 ? (
            <Text variant="caption" color="textMuted">
              Other copies of your data on this device:
            </Text>
          ) : null}
          {others.map((file) => (
            <Button
              key={file.uri}
              title={`Export ${file.name}`}
              variant="secondary"
              onPress={() => void share(file)}
            />
          ))}
          {previous !== null ? (
            <Button
              title="Use the previous save"
              variant="secondary"
              onPress={() => confirmAndApply(previous)}
            />
          ) : null}
          <Button title="Restore a backup" variant="secondary" onPress={() => void importFromFile()} />
          <Button title="Start fresh" variant="destructive" onPress={startFresh} />
        </View>
      </ScreenScroll>
    </View>
  );
}
