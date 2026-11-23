import { AppState } from 'react-native';
import { useStore } from '../store';
import { createPlatform } from './platform';
import { useHealthStatus } from './status';
import { createHealthSync, type HealthSync } from './sync';

export { useHealthStatus } from './status';
export { describeHealth, exportSummary, lastSyncLabel } from './view';

let instance: HealthSync | undefined;

/** The one Health sync of the app, created on first use. */
export function getHealthSync(): HealthSync {
  instance ??= createHealthSync({
    store: useStore,
    status: useHealthStatus,
    platform: createPlatform(),
    ready: Promise.resolve(useHealthStatus.persist.rehydrate()),
  });
  return instance;
}

/** Start writing finished workouts to Health while the app runs; returns the cleanup. */
export function startHealthSync(): () => void {
  const sync = getHealthSync();
  const stop = sync.start();
  // Coming back to the app (maybe from the system Settings) asks again and tries what is waiting.
  const sub = AppState.addEventListener(
    'change',
    (state) => state === 'active' && void sync.refreshPermission(),
  );
  return () => {
    stop();
    sub.remove();
  };
}
