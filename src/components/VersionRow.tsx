import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Alert } from 'react-native';
import { ListRow } from '../ui/ListRow';
import { checkForUpdate, restartIntoUpdate, type UpdateOutcome } from '../updates';

const SUBTITLE: Record<UpdateOutcome | 'checking', string> = {
  checking: 'Checking for updates…',
  none: "You're up to date",
  ready: 'Update ready. Tap to restart',
  error: "Couldn't check. Try again later",
  disabled: 'Updates are off in this build',
};

/** The app version. Tapping it looks for an update now; a downloaded update starts with the next launch or from here. */
export function VersionRow() {
  const { isUpdatePending } = Updates.useUpdates();
  const [state, setState] = useState<UpdateOutcome | 'checking' | null>(null);
  const ready = isUpdatePending || state === 'ready';
  const running =
    Updates.isEmbeddedLaunch || !Updates.updateId ? 'Built-in' : `Update ${Updates.updateId.slice(0, 8)}`;

  const restart = () =>
    Alert.alert('Restart to update?', 'The app restarts now. An open workout is kept.', [
      { text: 'Later', style: 'cancel' },
      { text: 'Restart', onPress: () => void restartIntoUpdate() },
    ]);
  const press = async () => {
    if (ready) return restart();
    if (state === 'checking') return;
    setState('checking');
    const outcome = await checkForUpdate();
    setState(outcome);
    if (outcome === 'ready') restart();
  };

  const status = ready ? 'ready' : state;
  return (
    <ListRow
      title="Version"
      value={Constants.expoConfig?.version ?? ''}
      subtitle={status ? SUBTITLE[status] : running}
      accessibilityLabel={`Version ${Constants.expoConfig?.version ?? ''}. Check for updates`}
      onPress={() => void press()}
    />
  );
}
