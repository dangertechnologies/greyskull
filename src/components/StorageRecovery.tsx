import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTheme } from '../design/theme';
import { importFromFile } from '../importFlow';
import { stateFile } from '../storage';
import { initStore } from '../store';
import { Button } from '../ui/Button';
import { ScreenScroll } from '../ui/layout';
import { Text } from '../ui/Text';

/**
 * Shown instead of the app when the saved data cannot be read. Nothing is written while it shows, so the
 * file stays as it was: the user can try again, send the file somewhere safe, or restore a backup.
 */
export function StorageRecovery({ error }: { error: string }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);

  const retry = async () => {
    setBusy(true);
    await initStore();
    setBusy(false);
  };

  const exportFile = async () => {
    const file = stateFile();
    if (!file.exists) {
      Alert.alert('No data file', 'There is no saved data file on this device to export.');
      return;
    }
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing is not available', 'This device cannot share files.');
      return;
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export your data file',
    });
  };

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
          <Button title="Restore a backup" variant="secondary" onPress={() => void importFromFile()} />
        </View>
      </ScreenScroll>
    </View>
  );
}
