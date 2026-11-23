import type { AppIntentEntity } from 'expo-app-intents';
import { buildCatalogs, NEXT_KIND, PROGRAM_KIND } from './snapshot';

type PublishState = Parameters<typeof buildCatalogs>[0] & { hydrated: boolean };

/** Wait before each retry of a failed write; after the last one the next change tries again. */
const RETRY_MS = [1000, 5000, 30_000];
const DEBOUNCE_MS = 300;

/**
 * Keeps the catalogs the intents read (programs, next workout) in step with the store: written once at launch,
 * then 300 ms after the last change, only when the content differs. A failed write is retried with a growing
 * wait instead of waiting for a change that may not come. Returns a function that stops it.
 */
export function startPublisher(deps: {
  store: { getState(): PublishState; subscribe(listener: () => void): () => void };
  write(kind: string, entities: AppIntentEntity[]): Promise<void>;
}): () => void {
  const { store, write } = deps;
  let stopped = false;
  let lastWritten = '';
  let attempt = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const publish = () => {
    clearTimeout(retry);
    const state = store.getState();
    if (stopped || !state.hydrated) return;
    const { programs, next } = buildCatalogs(state);
    const key = JSON.stringify([programs, next]);
    if (key === lastWritten) return;
    // One write at a time, so an older state never lands after a newer one.
    queue = queue.then(async () => {
      if (stopped) return;
      try {
        await write(NEXT_KIND, next);
        await write(PROGRAM_KIND, programs);
        lastWritten = key;
        attempt = 0;
      } catch {
        const wait = RETRY_MS[attempt++];
        if (!stopped && wait !== undefined) retry = setTimeout(publish, wait);
      }
    });
  };

  publish();
  const unsubscribe = store.subscribe(() => {
    clearTimeout(debounce);
    debounce = setTimeout(publish, DEBOUNCE_MS);
  });
  return () => {
    stopped = true;
    clearTimeout(debounce);
    clearTimeout(retry);
    unsubscribe();
  };
}
