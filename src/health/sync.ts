import type { ActiveProgram, SessionLog } from '../domain';
import type { HealthStatus, Permission } from './status';
import { type HealthWorkout, isEmpty, isSyncable, toWorkout } from './workout';

/** The native side of one platform; the only part that touches Apple Health or Health Connect. */
export interface HealthPlatform {
  permission(): Promise<Permission>;
  /** Asks for permission to write workouts (never to read anything). */
  request(): Promise<Permission>;
  /**
   * Writes the workout so that the platform ends with one entry for its id (replacing an earlier write).
   * A failure part way may leave an extra copy but never loses the workout.
   */
  write(workout: HealthWorkout): Promise<void>;
  /** Writes several at once, all or nothing, where the platform has a bulk call. */
  writeMany?(workouts: HealthWorkout[]): Promise<void>;
  /** Opens the system screen where the user can allow Health access again. */
  openSettings(): void;
}

/** The slice of the app store the sync reads and writes; the real store satisfies it. */
export interface SyncState {
  healthSync: boolean;
  sessions: SessionLog[];
  programs: ActiveProgram[];
  setHealthSync(on: boolean): void;
  setHealthIds(entries: { n: number; healthId: string }[]): void;
}

export interface SyncStore {
  getState(): SyncState;
  subscribe(listener: (state: SyncState, prev: SyncState) => void): () => void;
}

export interface ExportResult {
  written: number;
  /** Finished workouts that were in Health already and needed nothing. */
  alreadyThere: number;
  /** Finishes with no set done, which are not written. */
  skippedEmpty: number;
  failed: boolean;
  permission: Permission;
}

const BACKOFF_START_MS = 30_000;
const BACKOFF_MAX_MS = 6 * 3_600_000;
const NATIVE_TIMEOUT_MS = 30_000;

type Mode = 'auto' | 'forced' | 'export';

export function createHealthSync(deps: {
  store: SyncStore;
  status: {
    getState(): HealthStatus;
    setState(update: Partial<HealthStatus> | ((s: HealthStatus) => Partial<HealthStatus>)): void;
  };
  platform: HealthPlatform | null;
  now?: () => number;
  /** Resolves once the persisted status has loaded; `start` waits for it. */
  ready?: Promise<unknown>;
  /** A native call that takes longer than this fails, so a hung one cannot block the queue. */
  timeoutMs?: number;
}) {
  const { store, status, platform } = deps;
  const now = deps.now ?? Date.now;
  const timeoutMs = deps.timeoutMs ?? NATIVE_TIMEOUT_MS;
  const iso = () => new Date(now()).toISOString();

  const withTimeout = <T>(call: Promise<T>, what: string): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${what} timed out`)), timeoutMs);
      call.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  const permissionNow = (): Promise<Permission> =>
    platform
      ? withTimeout(
          Promise.resolve().then(() => platform.permission()),
          'Health permission check',
        ).catch(() => 'unavailable' as const)
      : Promise.resolve('unavailable' as const);

  // One queue for every write (automatic, retry and export), so two never overlap.
  let chain: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
    const run = chain.then(job);
    chain = run.catch(() => undefined);
    return run;
  };

  const failureOf = async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    // The backoff only exists for the automatic tries: while sync is off, nothing is going to retry.
    const syncOn = store.getState().healthSync;
    status.setState((s) => ({
      lastError: { at: iso(), message },
      retry: syncOn
        ? {
            attempts: (s.retry?.attempts ?? 0) + 1,
            at: now() + Math.min(BACKOFF_START_MS * 2 ** (s.retry?.attempts ?? 0), BACKOFF_MAX_MS),
          }
        : s.retry,
    }));
    // A write can fail because access was taken away: show that state, not only the error.
    status.setState({ permission: await permissionNow() });
  };

  /** Sessions that still have to go to Health, as `drain` and `disable` both see them. */
  const wanted = (st: HealthStatus, all: boolean) => (log: SessionLog) =>
    isSyncable(log) &&
    (st.dirty.includes(log.n) || (!log.healthId && (all || (log.finishedAt ?? '') >= (st.since ?? ''))));

  /**
   * Writes the sessions that need it, oldest first, stopping at the first failure. A session needs it when it has
   * no id yet or was edited since. A mark is cleared only after its write succeeded.
   * `export` also takes sessions from before sync was switched on and works while sync is off.
   * `auto` (a change in the store) waits out the backoff after a failure; `forced` (launch, coming back to the
   * app, the retry button) and `export` do not.
   */
  async function drain(mode: Mode): Promise<ExportResult> {
    const all = mode === 'export';
    const result: ExportResult = {
      written: 0,
      alreadyThere: 0,
      skippedEmpty: 0,
      failed: false,
      permission: status.getState().permission as Permission,
    };
    if (!platform) {
      status.setState({ permission: 'unavailable' });
      return { ...result, permission: 'unavailable' };
    }
    if (!all) {
      if (!store.getState().healthSync) return result;
      if (!status.getState().since) status.setState({ since: iso() });
    }
    const st = status.getState();
    const finished = store.getState().sessions.filter(isSyncable);
    const needs = wanted(st, all);
    const list = finished.filter((l) => needs(l) && !isEmpty(l));
    result.skippedEmpty = finished.filter((l) => needs(l) && isEmpty(l)).length;
    if (all) result.alreadyThere = finished.filter((l) => !needs(l) && !isEmpty(l)).length;
    if (list.length === 0) {
      // Nothing is waiting: a failure shown earlier belonged to a session that has gone.
      if (st.lastError || st.retry) status.setState({ lastError: null, retry: null });
      return result;
    }
    if (mode === 'auto' && st.retry && st.retry.at > now()) return result;

    const permission = await permissionNow();
    status.setState({ permission });
    result.permission = permission;
    if (permission !== 'granted') return result;

    // Ids are put on the sessions once, at the end, in one store update.
    const ids = new Map<number, string>();
    const record = (log: SessionLog, workout: HealthWorkout) => {
      ids.set(log.n, workout.id);
      // An edit that landed while this write was under way is not in it: leave the session marked.
      const current = store.getState().sessions.find((l) => l.n === log.n);
      const stale = !!current && current.results !== log.results;
      status.setState((s) => ({
        versions: { ...s.versions, [log.n]: workout.version },
        dirty: stale
          ? s.dirty.includes(log.n)
            ? s.dirty
            : [...s.dirty, log.n]
          : s.dirty.filter((d) => d !== log.n),
      }));
      result.written++;
    };
    const next = (log: SessionLog) => {
      const version = Math.max((status.getState().versions[log.n] ?? 0) + 1, now());
      return toWorkout(log, store.getState().programs, version);
    };
    try {
      if (platform.writeMany && list.length > 1) {
        const items = list.flatMap((log) => {
          const workout = next(log);
          return workout ? [{ log, workout }] : [];
        });
        await withTimeout(
          Promise.resolve().then(() => platform.writeMany?.(items.map((i) => i.workout))),
          'Health write',
        );
        for (const { log, workout } of items) record(log, workout);
      } else {
        for (const { n } of list) {
          // Turned off while this run was under way: the rest waits for it to be turned on again.
          if (!all && !store.getState().healthSync) break;
          // Read the session again: it may have changed (or gone) while an earlier one was being written.
          const log = store.getState().sessions.find((l) => l.n === n);
          const workout = log && next(log);
          if (!log || !workout) continue;
          await withTimeout(
            Promise.resolve().then(() => platform.write(workout)),
            'Health write',
          );
          record(log, workout);
        }
      }
    } catch (error) {
      result.failed = true;
      await failureOf(error);
    } finally {
      if (ids.size > 0) {
        store.getState().setHealthIds([...ids].map(([n, healthId]) => ({ n, healthId })));
      }
    }
    if (!result.failed && (all || store.getState().healthSync)) {
      status.setState({
        ...(result.written > 0 ? { lastSyncAt: iso() } : {}),
        lastError: null,
        retry: null,
      });
    }
    return result;
  }

  const failedResult = (): ExportResult => ({
    written: 0,
    alreadyThere: 0,
    skippedEmpty: 0,
    failed: true,
    permission: status.getState().permission as Permission,
  });
  const run = (mode: Mode): Promise<ExportResult> =>
    enqueue(() =>
      drain(mode).catch(async (error) => {
        await failureOf(error).catch(() => undefined);
        return failedResult();
      }),
    );
  const kick = (mode: Mode) => void run(mode);

  function onChange(state: SyncState, prev: SyncState) {
    if (state.sessions === prev.sessions && state.healthSync === prev.healthSync) return;
    if (!state.healthSync) return;
    // Editing a session that was written already marks it to be written again.
    const before = new Map(prev.sessions.map((l) => [l.n, l]));
    const { versions } = status.getState();
    const edited = state.sessions
      .filter(
        (l) =>
          (l.healthId || versions[l.n] !== undefined) &&
          isSyncable(l) &&
          before.has(l.n) &&
          before.get(l.n)?.results !== l.results,
      )
      .map((l) => l.n);
    if (edited.length > 0) status.setState((s) => ({ dirty: [...new Set([...s.dirty, ...edited])] }));
    kick('auto');
  }

  return {
    /** Watches the store and writes workouts as they finish; also retries what failed earlier. Returns the cleanup. */
    start(): () => void {
      let stopped = false;
      let unsubscribe = () => {};
      void (deps.ready ?? Promise.resolve()).then(() => {
        if (stopped) return;
        unsubscribe = store.subscribe(onChange);
        kick('forced');
      });
      return () => {
        stopped = true;
        unsubscribe();
      };
    },

    /** Asks for permission and switches sync on only when it is granted. Marks of work left over are kept. */
    async enable(): Promise<Permission> {
      if (!platform) {
        status.setState({ permission: 'unavailable' });
        return 'unavailable';
      }
      let permission = await permissionNow();
      if (permission !== 'granted') {
        permission = await withTimeout(
          Promise.resolve().then(() => platform.request()),
          'Health request',
        ).catch(() => 'unavailable' as const);
      }
      status.setState({ permission });
      if (permission === 'granted') {
        status.setState({ since: iso(), lastError: null, retry: null });
        store.getState().setHealthSync(true);
      }
      return permission;
    },

    /** Turns sync off. Nothing more is written; sessions still waiting stay marked for when it is on again. */
    disable(): void {
      const waiting = store
        .getState()
        .sessions.filter(wanted(status.getState(), false))
        .map((l) => l.n);
      store.getState().setHealthSync(false);
      status.setState((s) => ({
        since: null,
        retry: null,
        dirty: [...new Set([...s.dirty, ...waiting])],
      }));
    },

    /** Asks the system again (the user may have changed it in Settings) and tries what is waiting. */
    async refreshPermission(): Promise<Permission> {
      const permission = await permissionNow();
      status.setState({ permission });
      if (permission === 'granted') kick('forced');
      return permission;
    },

    /** The retry button: try what is waiting now, whatever the backoff says. */
    retryNow: (): Promise<ExportResult> => run('forced'),

    /** Writes the finished workouts that are not in Health yet or were edited; repeating it adds nothing. */
    exportPast: (): Promise<ExportResult> => run('export'),

    openSettings: () => platform?.openSettings(),
  };
}

export type HealthSync = ReturnType<typeof createHealthSync>;
