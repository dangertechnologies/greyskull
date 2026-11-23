import { router, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useStore } from '../store';
import { handleInvocation } from './handlers';
import { buildCatalogs, NEXT_KIND, PROGRAM_KIND } from './snapshot';

type AppIntentsModule = typeof import('expo-app-intents');

/** The native module exists only in an iOS development or production build (not Expo Go, Android, web, tests). */
function load(): AppIntentsModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    const m = require('expo-app-intents') as AppIntentsModule;
    return m.isAvailable() ? m : null;
  } catch {
    return null;
  }
}

/** Keeps the catalogs Siri reads (programs, next workout) in step with the store. Returns the unsubscribe. */
function publishWhileMounted(m: AppIntentsModule): () => void {
  let last = '';
  let queue: Promise<unknown> = Promise.resolve();
  const run = () => {
    const s = useStore.getState();
    if (!s.hydrated) return;
    const { programs, next } = buildCatalogs(s);
    const key = JSON.stringify([programs, next]);
    if (key === last) return;
    last = key;
    // One publication at a time, so an older state never lands after a newer one.
    queue = queue
      .then(() => m.setEntityCatalogAsync(NEXT_KIND, next))
      .then(() => m.setEntityCatalogAsync(PROGRAM_KIND, programs))
      .catch(() => {
        last = ''; // try again on the next change
      });
  };
  run();
  return useStore.subscribe(run);
}

function Listener({ m }: { m: AppIntentsModule }) {
  m.useAppIntents(async (pending) => {
    for (const invocation of pending) {
      try {
        const result = await handleInvocation(invocation, {
          getState: () => useStore.getState(),
          push: (href) => router.push(href as never),
          now: Date.now,
        });
        if (result === 'done') await m.removePendingInvocationAsync(invocation.id);
      } catch (e) {
        console.warn('App Intent stays queued', invocation.id, e);
      }
    }
  });
  return null;
}

/**
 * Siri and Shortcuts, iOS only: publishes what the intents read and opens the screens they ask for.
 * Render it once inside the navigator, after the store has loaded; the listener starts when navigation is ready.
 */
export function AppIntentsBridge() {
  const m = load();
  const navigationReady = !!useRootNavigationState()?.key;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the module never changes
  useEffect(() => (m ? publishWhileMounted(m) : undefined), []);
  return m && navigationReady ? <Listener m={m} /> : null;
}
