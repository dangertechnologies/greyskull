import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Alert } from 'react-native';
import type { BackupSummary } from './backup';
import { parseBackup } from './backup';
import { useStore } from './store';

const describe = (s: BackupSummary): string =>
  `${s.sessions} workouts, ${s.exercises} exercises${s.custom ? ` (${s.custom} custom)` : ''}` +
  (s.lastSession ? `, last on ${new Date(s.lastSession).toLocaleDateString()}` : '') +
  '.\n\nThis replaces everything currently on this device.';

/** Validate `raw` and, after the user confirms, replace the app state with it. Resolves true when applied. */
export function confirmAndApply(raw: string, onDone?: () => void): boolean {
  const result = parseBackup(raw);
  if (!result.ok) {
    Alert.alert('Cannot import', result.error);
    return false;
  }
  Alert.alert('Replace your data?', describe(result.summary), [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Replace',
      style: 'destructive',
      onPress: () => {
        useStore.getState().importBackup(result.state);
        onDone?.();
      },
    },
  ]);
  return true;
}

export async function importFromClipboard(onDone?: () => void): Promise<boolean> {
  return confirmAndApply(await Clipboard.getStringAsync(), onDone);
}

export async function importFromFile(onDone?: () => void): Promise<boolean> {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'] });
  const uri = picked.assets?.[0]?.uri;
  if (picked.canceled || !uri) return false;
  return confirmAndApply(await new File(uri).text(), onDone);
}
