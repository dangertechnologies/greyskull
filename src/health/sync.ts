import type { StoreApi } from 'zustand';
import type { ActiveProgram, SessionLog } from '../domain';
import type { HealthStatus, Permission } from './status';
import { type HealthWorkout, isSyncable, toWorkout } from './workout';

/** The native side of one platform; the only part that touches Apple Health or Health Connect. */
export interface HealthPlatform {
  permission(): Promise<Permission>;
  /** Asks for permission to write workouts (never to read anything). */
  request(): Promise<Permission>;
  /** Writes the workout, replacing an earlier write of the same id with a lower version. */
  write(workout: HealthWorkout): Promise<void>;
  /** Opens the system screen where the user can allow Health access again. */
  openSettings(): void;
}

/** The slice of the app store the sync reads and writes; the real store satisfies it. */
export interface SyncState {
  healthSync: boolean;
  sessions: SessionLog[];
  programs: ActiveProgram[];
  setHealthId(n: number, id: string): void;
  setHealthSync(on: boolean): void;
}

export interface ExportResult {
  written: number;
  failed: boolean;
  permission: Permission;
}

const BACKOFF_START_MS = 30_000;
const BACKOFF_MAX_MS = 6 * 3_600_000;

export function createHealthSync(deps: {
  store: Pick<StoreApi<SyncState>, 'getState' | 'subscribe'>;
  status: Pick<StoreApi<HealthStatus>, 'getState' | 'setState'>;
  platform: HealthPlatform | null;
  now?: () => number;
  /** Resolves once the persisted status has loaded; `start` waits for it. */
  ready?: Promise<unknown>;
}) {
  const { store, status, platform } = deps;
  const now = deps.now ?? Date.now;
  const iso = () => new Date(now()).toISOString();

  // One queue for every write (automatic, retry and export), so two never overlap.
  let chain: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
    const run = chain.then(job);
    chain = run.catch(() => undefined);
    return run;
  };

  const fail = async (error: unknown, n: number) => {
    const message = error instanceof Error ? error.message : String(error);
    status.setState((s) => ({
      dirty: s.dirty.includes(n) ? s.dirty : [...s.dirty, n],
      lastError: { at: iso(), message },
      retry: {
        attempts: (s.retry?.attempts ?? 0) + 1,
        at: now() + Math.min(BACKOFF_START_MS * 2 ** (s.retry?.attempts ?? 0), BACKOFF_MAX_MS),
      },
    }));
    // A write can fail because access was taken away: show that state, not only the error.
    if (platform)
      status.setState({ permission: await platform.permission().catch(() => 'unavailable' as const) });
  };

  /**
   * Writes the sessions that need it, oldest first, stopping at the first failure.
   * `all` writes every finished session (export); otherwise only new ones since sync was switched on and edited ones.
   * `force` ignores the backoff after an earlier failure (a new workout or a button press).
   */
  async function drain(force: boolean, all: boolean): Promise<ExportResult> {
    const result: ExportResult = { written: 0, failed: false, permission: 'unavailable' };
    if (!platform) {
      status.setState({ permission: 'unavailable' });
      return result;
    }
    if (!all) {
      if (!store.getState().healthSync)
        return { ...result, permission: status.getState().permission as Permission };
      if (!status.getState().since) status.setState({ since: iso() });
    }
    const st = status.getState();
    const pending = (log: SessionLog) =>
      isSyncable(log) &&
      (all || st.dirty.includes(log.n) || (!log.healthId && (log.finishedAt ?? '') >= (st.since ?? '')));
    const list = store.getState().sessions.filter(pending);
    result.permission = st.permission as Permission;
    if (list.length === 0) return result;
    if (!all && !force && st.retry && st.retry.at > now()) return result;

    const permission = await platform.permission().catch(() => 'unavailable' as const);
    status.setState({ permission });
    result.permission = permission;
    if (permission !== 'granted') return result;

    for (const { n } of list) {
      // Read the session again: it may have changed (or gone) while an earlier one was being written.
      const log = store.getState().sessions.find((l) => l.n === n);
      const workout = log && toWorkout(log, store.getState().programs, now());
      if (!workout) continue;
      // Clear the mark before writing: an edit that lands during the write sets it again and is written next.
      status.setState((s) => ({ dirty: s.dirty.filter((d) => d !== n) }));
      try {
        await platform.write(workout);
      } catch (error) {
        await fail(error, n);
        return { ...result, failed: true };
      }
      store.getState().setHealthId(n, workout.id);
      result.written++;
    }
    if (result.written > 0) status.setState({ lastSyncAt: iso(), lastError: null, retry: null });
    return result;
  }

  const kick = (force: boolean) => void enqueue(() => drain(force, false));

  function onChange(state: SyncState, prev: SyncState) {
    if (state.sessions === prev.sessions && state.healthSync === prev.healthSync) return;
    if (!state.healthSync) return;
    // Editing a session that was written already marks it to be written again.
    const before = new Map(prev.sessions.map((l) => [l.n, l]));
    const edited = state.sessions
      .filter((l) => l.healthId && isSyncable(l) && before.has(l.n) && before.get(l.n)?.results !== l.results)
      .map((l) => l.n);
    if (edited.length > 0) status.setState((s) => ({ dirty: [...new Set([...s.dirty, ...edited])] }));
    kick(true);
  }

  return {
    /** Watches the store and writes workouts as they finish; also retries what failed earlier. Returns the cleanup. */
    start(): () => void {
      let stopped = false;
      let unsubscribe = () => {};
      void (deps.ready ?? Promise.resolve()).then(() => {
        if (stopped) return;
        unsubscribe = store.subscribe(onChange);
        kick(false);
      });
      return () => {
        stopped = true;
        unsubscribe();
      };
    },

    /** Asks for permission and switches sync on only when it is granted. */
    async enable(): Promise<Permission> {
      if (!platform) {
        status.setState({ permission: 'unavailable' });
        return 'unavailable';
      }
      let permission = await platform.permission().catch(() => 'unavailable' as const);
      if (permission !== 'granted') permission = await platform.request().catch(() => 'unavailable' as const);
      status.setState({ permission });
      if (permission === 'granted') {
        status.setState({ since: iso(), lastError: null, retry: null, dirty: [] });
        store.getState().setHealthSync(true);
      }
      return permission;
    },

    disable(): void {
      store.getState().setHealthSync(false);
      status.setState({ since: null, dirty: [], retry: null });
    },

    /** Asks the system again (the user may have changed it in Settings) and returns the answer. */
    async refreshPermission(): Promise<Permission> {
      const permission = platform
        ? await platform.permission().catch(() => 'unavailable' as const)
        : 'unavailable';
      status.setState({ permission });
      if (permission === 'granted') kick(false);
      return permission;
    },

    /** Writes every finished workout with the same ids as automatic writes, so doing it twice adds nothing. */
    exportPast: (): Promise<ExportResult> => enqueue(() => drain(true, true)),

    openSettings: () => platform?.openSettings(),
  };
}

export type HealthSync = ReturnType<typeof createHealthSync>;
