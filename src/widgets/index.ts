import { requireOptionalNativeModule } from 'expo';
import type { LiveActivity } from 'expo-widgets';
import { Platform } from 'react-native';
import type { AppState } from '../domain';
import { type NextWorkoutProps, nextWorkoutProps, type RestProps, restProps } from './summary';

type Definitions = typeof import('./definitions');

let definitions: Definitions | null | undefined;

/**
 * The widget definitions need the expo-widgets native module, which only exists in a development or
 * production build on iOS (not Expo Go, Android or tests). Check for it before requiring them: a module
 * that throws while loading is reported as an error in dev even when the throw is caught. Anything else
 * that goes wrong loading them means "no widgets", never a crash.
 */
function load(): Definitions | null {
  if (definitions !== undefined) return definitions;
  try {
    definitions =
      Platform.OS === 'ios' && requireOptionalNativeModule('ExpoWidgets')
        ? (require('./definitions') as Definitions)
        : null;
  } catch {
    definitions = null;
  }
  return definitions;
}

let lastNext = '';

/** Push the next workout to the home-screen widget (skips the native call when nothing changed). */
export function syncNextWorkout(state: Parameters<typeof nextWorkoutProps>[0]): NextWorkoutProps {
  const props = nextWorkoutProps(state);
  const key = JSON.stringify(props);
  if (key !== lastNext) {
    lastNext = key;
    try {
      load()?.nextWorkoutWidget.updateSnapshot(props);
    } catch {
      // Widgets are optional.
    }
  }
  return props;
}

let activity: LiveActivity<RestProps> | null = null;

/** Show the rest countdown on the Lock Screen and in the Dynamic Island. */
export function startRestActivity(label: string, seconds: number): void {
  endRestActivity();
  try {
    activity =
      load()?.restActivity.start(
        restProps(label, seconds),
        undefined,
        new Date(Date.now() + seconds * 1000 + 60_000),
      ) ?? null;
  } catch {
    activity = null; // e.g. Live Activities switched off in iOS settings
  }
}

export function endRestActivity(): void {
  const current = activity;
  activity = null;
  if (current) void current.end('immediate').catch(() => undefined);
}

/** Keep the widget in step with the store for the lifetime of the app. Returns the unsubscribe. */
export function watchStoreForWidgets(store: {
  getState(): AppState & { hydrated: boolean };
  subscribe(l: () => void): () => void;
}): () => void {
  const run = () => {
    const s = store.getState();
    if (s.hydrated) syncNextWorkout(s);
  };
  run();
  return store.subscribe(run);
}
