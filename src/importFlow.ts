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
  let result: ReturnType<typeof parseBackup>;
  try {
    result = parseBackup(raw);
  } catch (e) {
    result = { ok: false, error: `The backup is damaged: ${e instanceof Error ? e.message : String(e)}.` };
  }
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
        void useStore
          .getState()
          .importBackup(result.state)
          .then(() => {
            // A failed replacement leaves the recovery screen up with its reason.
            if (!useStore.getState().storageError) onDone?.();
          });
      },
    },
  ]);
  return true;
}

/** Shows why the backup could not be read instead of leaving the failure unhandled. */
async function readOrExplain(read: () => Promise<string>): Promise<string | null> {
  try {
    return await read();
  } catch (e) {
    Alert.alert(
      'Cannot import',
      `The backup could not be read: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}

export async function importFromClipboard(onDone?: () => void): Promise<boolean> {
  const raw = await readOrExplain(() => Clipboard.getStringAsync());
  return raw !== null && confirmAndApply(raw, onDone);
}

export async function importFromFile(onDone?: () => void): Promise<boolean> {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'] });
  const uri = picked.assets?.[0]?.uri;
  if (picked.canceled || !uri) return false;
  const raw = await readOrExplain(() => new File(uri).text());
  return raw !== null && confirmAndApply(raw, onDone);
}
