import * as Updates from 'expo-updates';
import { AppState } from 'react-native';

/** Over-the-air updates: the app checks at launch (expo-updates does that itself) and again when it comes back to the
 * foreground, at most this often. A downloaded update is used the next time the app starts. */
export const CHECK_EVERY_MS = 60 * 60 * 1000;

/** `disabled`: this build cannot take updates (development build, Expo Go). `none`: already up to date. `ready`: an
 * update was downloaded and starts with the next launch. */
export type UpdateOutcome = 'disabled' | 'none' | 'ready' | 'error';

let lastCheck = Date.now();
let running: Promise<UpdateOutcome> | null = null;

/** Looks for an update and downloads it. Calls made while one is running share its result. */
export function checkForUpdate(): Promise<UpdateOutcome> {
  if (!Updates.isEnabled) return Promise.resolve('disabled');
  if (running) return running;
  lastCheck = Date.now();
  running = (async (): Promise<UpdateOutcome> => {
    try {
      const found = await Updates.checkForUpdateAsync();
      if (!found.isAvailable && !found.isRollBackToEmbedded) return 'none';
      const fetched = await Updates.fetchUpdateAsync();
      return fetched.isNew || fetched.isRollBackToEmbedded ? 'ready' : 'none';
    } catch (e) {
      console.warn('Update check failed', e);
      return 'error';
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Checks again whenever the app returns to the foreground after `CHECK_EVERY_MS`. Returns the cleanup. */
export function startForegroundUpdates(now: () => number = Date.now): () => void {
  lastCheck = now();
  const subscription = AppState.addEventListener('change', (status) => {
    if (status === 'active' && now() - lastCheck >= CHECK_EVERY_MS) void checkForUpdate();
  });
  return () => subscription.remove();
}

/** Starts the downloaded update now. */
export const restartIntoUpdate = (): Promise<void> => Updates.reloadAsync();
