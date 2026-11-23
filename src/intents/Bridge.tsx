import type { AppIntentInvocation } from 'expo-app-intents';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useStore } from '../store';
import { handleInvocation } from './handlers';
import { startPublisher } from './publisher';

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

/**
 * Handles queued invocations (from while the app was closed) and live ones, one at a time, then removes them.
 * Written against the module's listener and queue functions rather than its hook, so a subscription without
 * remove() cannot throw when this unmounts. A failed invocation stays queued for the next launch.
 */
function useIntentListener(m: AppIntentsModule): void {
  const pathname = usePathname();
  const current = useRef(pathname);
  current.current = pathname;
  useEffect(() => {
    let alive = true;
    const handled = new Set<string>();
    let chain: Promise<unknown> = Promise.resolve();
    const process = async (list: AppIntentInvocation[]) => {
      for (const invocation of list) {
        if (!alive) return;
        try {
          if (!handled.has(invocation.id)) {
            const result = await handleInvocation(invocation, {
              getState: () => useStore.getState(),
              navigate: (href) => router.navigate(href as never),
              current: () => current.current,
              now: Date.now,
            });
            if (result !== 'done') continue;
            handled.add(invocation.id);
          }
          await m.removePendingInvocationAsync(invocation.id);
        } catch (e) {
          console.warn('App Intent stays queued', invocation.id, e);
        }
      }
    };
    const enqueue = (work: () => Promise<void>) => {
      chain = chain.then(work).catch(() => undefined);
    };
    // Subscribe before reading the queue, so nothing falls between the two.
    let subscription: { remove?: () => void } | undefined;
    try {
      subscription = m.addAppIntentListener((invocation) => enqueue(() => process([invocation])));
    } catch (e) {
      console.warn('App Intents listener not started', e);
    }
    enqueue(async () => process(await m.getPendingInvocationsAsync()));
    return () => {
      alive = false;
      try {
        subscription?.remove?.();
      } catch {
        // Nothing left to release.
      }
    };
  }, [m]);
}

function Listener({ m }: { m: AppIntentsModule }) {
  useIntentListener(m);
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
  useEffect(
    () =>
      m
        ? startPublisher({
            store: useStore,
            write: (kind, entities) => m.setEntityCatalogAsync(kind, entities),
          })
        : undefined,
    [],
  );
  return m && navigationReady ? <Listener m={m} /> : null;
}
