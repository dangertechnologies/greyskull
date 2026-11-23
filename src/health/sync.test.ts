import { createStore } from 'zustand/vanilla';
import type { ActiveProgram, SessionLog } from '../domain';
import { type HealthStatus, initialHealthStatus, type Permission } from './status';
import { createHealthSync, type HealthPlatform, type SyncState } from './sync';
import { type HealthWorkout, recordId } from './workout';

const NOW = Date.parse('2026-11-23T10:00:00.000Z');
const TRAINED = { SQUAT: { weightKg: 60, sets: [{ target: 5, reps: 5 }] } };
const log = (n: number, patch: Partial<SessionLog> = {}): SessionLog => ({
  n,
  dayName: 'Day A',
  startedAt: `2026-11-2${n}T08:00:00.000Z`,
  finishedAt: `2026-11-2${n}T09:00:00.000Z`,
  results: { ...TRAINED },
  order: [],
  programName: 'Plan',
  ...patch,
});
const idOf = (n: number) => `greyskull-2026-11-2${n}T08:00:00.000Z-${n}`;

function setup(
  opts: {
    sessions?: SessionLog[];
    healthSync?: boolean;
    permission?: Permission;
    batch?: boolean;
    timeoutMs?: number;
  } = {},
) {
  const store = createStore<SyncState>()((set) => ({
    healthSync: opts.healthSync ?? true,
    sessions: opts.sessions ?? [],
    programs: [] as ActiveProgram[],
    exercises: {},
    setHealthSync: (on) => set({ healthSync: on }),
    setHealthIds: (entries) =>
      set((s) => ({
        sessions: s.sessions.map((l) => {
          const e = entries.find((x) => x.n === l.n && x.healthId === recordId(l));
          return e ? { ...l, healthId: e.healthId } : l;
        }),
      })),
  }));
  const status = createStore<HealthStatus>()(() => ({
    ...initialHealthStatus(),
    since: '2026-11-01T00:00:00.000Z',
  }));
  const written: HealthWorkout[] = [];
  const calls = {
    failNext: 0,
    permission: opts.permission ?? ('granted' as Permission),
    batches: [] as string[][],
    // Set to hold the next write until `release` is called.
    hold: null as null | Promise<void>,
  };
  let now = NOW;
  const platform: HealthPlatform = {
    permission: async () => calls.permission,
    request: async () => calls.permission,
    openSettings: jest.fn(),
    write: async (w) => {
      const hold = calls.hold;
      calls.hold = null;
      if (hold) await hold;
      if (calls.failNext > 0) {
        calls.failNext--;
        throw new Error('boom');
      }
      written.push(w);
    },
    ...(opts.batch
      ? {
          writeMany: async (ws: HealthWorkout[]) => {
            if (calls.failNext > 0) {
              calls.failNext--;
              throw new Error('boom');
            }
            calls.batches.push(ws.map((w) => w.id));
            written.push(...ws);
          },
        }
      : {}),
  };
  const sync = createHealthSync({ store, status, platform, now: () => now, timeoutMs: opts.timeoutMs });
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const hold = () => {
    let release = () => {};
    calls.hold = new Promise<void>((r) => {
      release = r;
    });
    return release;
  };
  return {
    store,
    status,
    written,
    calls,
    sync,
    flush,
    hold,
    tick: (ms: number) => {
      now += ms;
    },
    setNow: (ms: number) => {
      now = ms;
    },
    healthIdOf: (n: number) => store.getState().sessions.find((l) => l.n === n)?.healthId,
  };
}

describe('writing finished workouts', () => {
  it('writes a workout that finishes while sync is on, then records its id', async () => {
    const t = setup();
    const stop = t.sync.start();
    await t.flush();
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    expect(t.written.map((w) => w.id)).toEqual([idOf(1)]);
    expect(t.healthIdOf(1)).toBe(idOf(1));
    expect(t.status.getState().lastSyncAt).not.toBeNull();
    stop();
  });

  it('does nothing while sync is off', async () => {
    const t = setup({ healthSync: false });
    const stop = t.sync.start();
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    expect(t.written).toEqual([]);
    stop();
  });

  it('skips drafts, skipped sessions, sessions with an id and empty finishes', async () => {
    const t = setup();
    const stop = t.sync.start();
    t.store.setState({
      sessions: [
        log(1, { finishedAt: undefined }),
        log(2, { skipped: true }),
        log(3, { healthId: 'x' }),
        log(4, { results: { SQUAT: { weightKg: 60, sets: [{ target: 5, reps: 0 }] } } }),
      ],
    });
    await t.flush();
    expect(t.written).toEqual([]);
    stop();
  });

  it('leaves workouts from before sync was switched on for Export', async () => {
    const t = setup({ sessions: [log(1)] });
    t.status.setState({ since: '2026-11-22T00:00:00.000Z' });
    const stop = t.sync.start();
    await t.flush();
    expect(t.written).toEqual([]);
    stop();
  });

  it('writes one at a time, in order', async () => {
    const t = setup();
    const order: number[] = [];
    let active = 0;
    let overlap = false;
    const sync = createHealthSync({
      store: t.store,
      status: t.status,
      platform: {
        permission: async () => 'granted',
        request: async () => 'granted',
        openSettings() {},
        write: async (w) => {
          active++;
          overlap ||= active > 1;
          await new Promise((r) => setTimeout(r, 5));
          order.push(Number(w.id.split('-').pop()));
          active--;
        },
      },
      now: () => NOW,
    });
    const stop = sync.start();
    t.store.setState({ sessions: [log(1), log(2), log(3)] });
    t.store.setState((s) => ({ sessions: [...s.sessions, log(4)] }));
    for (let i = 0; i < 100 && order.length < 4; i++) await new Promise((r) => setTimeout(r, 20));
    expect(order).toEqual([1, 2, 3, 4]);
    expect(overlap).toBe(false);
    stop();
  });

  it('records ids for a whole run in one store update', async () => {
    const t = setup();
    const stop = t.sync.start();
    await t.flush();
    let updates = 0;
    let before = t.store.getState().sessions;
    t.store.subscribe((s) => {
      if (s.sessions !== before) updates++;
      before = s.sessions;
    });
    t.store.setState({ sessions: [log(1), log(2), log(3)] });
    await t.flush();
    await t.flush();
    expect(t.written).toHaveLength(3);
    // One update for the new sessions, one for all three ids.
    expect(updates).toBe(2);
    expect([1, 2, 3].map(t.healthIdOf)).toEqual([idOf(1), idOf(2), idOf(3)]);
    stop();
  });
});

describe('edits and versions', () => {
  it('writes the same id again with a higher version when the session is edited', async () => {
    const t = setup();
    const stop = t.sync.start();
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    t.tick(1000);
    t.store.setState((s) => ({
      sessions: s.sessions.map((l) => ({
        ...l,
        results: { SQUAT: { weightKg: 100, sets: [{ target: 5, reps: 5 }] } },
      })),
    }));
    await t.flush();
    expect(t.written.map((w) => w.id)).toEqual([idOf(1), idOf(1)]);
    expect(t.written[1].version).toBeGreaterThan(t.written[0].version);
    expect(t.status.getState().dirty).toEqual([]);
    stop();
  });

  it('keeps the edit marked until the rewrite succeeds', async () => {
    const t = setup({ sessions: [log(1, { healthId: idOf(1) })] });
    const stop = t.sync.start();
    await t.flush();
    t.calls.failNext = 1;
    t.store.setState((s) => ({
      sessions: s.sessions.map((l) => ({
        ...l,
        results: { SQUAT: { weightKg: 90, sets: [{ target: 5, reps: 5 }] } },
      })),
    }));
    await t.flush();
    expect(t.written).toEqual([]);
    expect(t.status.getState().dirty).toEqual([1]);
    t.tick(1);
    await t.sync.retryNow();
    expect(t.written).toHaveLength(1);
    expect(t.status.getState().dirty).toEqual([]);
    stop();
  });

  it('writes an edit again when it lands while the earlier write is in flight', async () => {
    const t = setup();
    const stop = t.sync.start();
    await t.flush();
    const release = t.hold();
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    t.store.setState((s) => ({
      sessions: s.sessions.map((l) => ({
        ...l,
        results: { SQUAT: { weightKg: 1, sets: [{ target: 5, reps: 5 }] } },
      })),
    }));
    release();
    await t.flush();
    await t.flush();
    await t.flush();
    expect(t.written).toHaveLength(2);
    expect(t.status.getState().dirty).toEqual([]);
    stop();
  });

  it('does not tag another workout with the same number when the history is replaced mid-write', async () => {
    const t = setup();
    const stop = t.sync.start();
    await t.flush();
    const release = t.hold();
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    // A restore puts a different workout under the same number while the write is under way.
    t.store.setState({ sessions: [log(1, { startedAt: '2026-10-01T08:00:00.000Z' })] });
    release();
    await t.flush();
    await t.flush();
    expect(t.written[0].id).toBe(idOf(1));
    expect(t.healthIdOf(1)).not.toBe(idOf(1));
    stop();
  });

  it('compares times, not text: a finish in another time zone form that is before sync began waits', async () => {
    const t = setup({ sessions: [] });
    t.status.setState({ since: '2026-11-22T12:00:00.000Z' });
    // Text order says "2026-11-22T13:30:00+02:00" is after the start, but it is 11:30 UTC, before it.
    t.store.setState({ sessions: [log(1, { finishedAt: '2026-11-22T13:30:00+02:00' })] });
    const stop = t.sync.start();
    await t.flush();
    expect(t.written).toHaveLength(0);
    stop();
  });

  it('writes again with the same id and a higher version when a crash lost the id', async () => {
    const t = setup();
    const stop = t.sync.start();
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    const first = t.written[0];
    t.store.setState((s) => ({ sessions: s.sessions.map(({ healthId: _h, ...l }) => l) }));
    t.tick(5);
    await t.flush();
    expect(t.written[1].id).toBe(first.id);
    expect(t.written[1].version).toBeGreaterThan(first.version);
    stop();
  });

  it('keeps versions rising when the clock goes backwards', async () => {
    const t = setup();
    const stop = t.sync.start();
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    t.setNow(NOW - 3_600_000);
    await t.sync.exportPast();
    t.store.setState((s) => ({ sessions: s.sessions.map(({ healthId: _h, ...l }) => l) }));
    await t.flush();
    const versions = t.written.map((w) => w.version);
    expect(versions[1]).toBeGreaterThan(versions[0]);
    stop();
  });
});

describe('failures, backoff and permission', () => {
  it('keeps a failed write queued, reports it, and backs off', async () => {
    const t = setup();
    const stop = t.sync.start();
    await t.flush();
    t.calls.failNext = 1;
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    expect(t.written).toEqual([]);
    expect(t.healthIdOf(1)).toBeUndefined();
    const s = t.status.getState();
    expect(s.lastError?.message).toContain('boom');
    expect(s.retry?.attempts).toBe(1);
    expect(s.retry?.at).toBeGreaterThan(NOW);
    stop();
  });

  it('retries at launch even inside the backoff', async () => {
    const t = setup({ sessions: [log(1)] });
    t.status.setState({ lastError: { at: 'x', message: 'boom' }, retry: { attempts: 1, at: NOW + 60_000 } });
    const stop = t.sync.start();
    await t.flush();
    expect(t.written).toHaveLength(1);
    expect(t.status.getState().lastError).toBeNull();
    expect(t.status.getState().retry).toBeNull();
    stop();
  });

  it('waits out the backoff for changes in the store, but not for the retry button', async () => {
    const t = setup();
    const stop = t.sync.start();
    await t.flush();
    t.status.setState({ retry: { attempts: 3, at: NOW + 3_600_000 } });
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    expect(t.written).toEqual([]);
    // A skip, an undo or another unrelated change does not force a try either.
    t.store.setState((s) => ({ sessions: [...s.sessions, log(2, { skipped: true })] }));
    await t.flush();
    expect(t.written).toEqual([]);
    await t.sync.retryNow();
    expect(t.written).toHaveLength(1);
    stop();
  });

  it('stops and shows the state when permission is not granted', async () => {
    const t = setup({ permission: 'denied' });
    const stop = t.sync.start();
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    expect(t.written).toEqual([]);
    expect(t.status.getState().permission).toBe('denied');
    expect(t.status.getState().lastError).toBeNull();
    stop();
  });

  it('fails the job when a native call hangs, and the queue goes on', async () => {
    const t = setup({ timeoutMs: 30 });
    const stop = t.sync.start();
    await t.flush();
    t.hold();
    t.store.setState({ sessions: [log(1)] });
    await new Promise((r) => setTimeout(r, 80));
    expect(t.status.getState().lastError?.message).toMatch(/timed out/);
    expect(t.status.getState().retry?.attempts).toBe(1);
    await t.sync.retryNow();
    expect(t.written.map((w) => w.id)).toEqual([idOf(1)]);
    stop();
  });

  it('clears the failure once the failing session is gone', async () => {
    const t = setup({ sessions: [] });
    t.status.setState({ lastError: { at: 'x', message: 'boom' }, retry: { attempts: 2, at: NOW + 1000 } });
    const stop = t.sync.start();
    await t.flush();
    expect(t.status.getState().lastError).toBeNull();
    expect(t.status.getState().retry).toBeNull();
    stop();
  });

  it('survives a permission call that rejects', async () => {
    const t = setup();
    const sync = createHealthSync({
      store: t.store,
      status: t.status,
      platform: {
        permission: async () => {
          throw new Error('native');
        },
        request: async () => 'granted',
        openSettings() {},
        write: async () => {},
      },
      now: () => NOW,
    });
    const stop = sync.start();
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    expect(t.status.getState().permission).toBe('unavailable');
    stop();
  });
});

describe('turning sync on and off', () => {
  it('turns on only when permission is granted, keeping queued marks', async () => {
    const t = setup({ healthSync: false, permission: 'denied' });
    t.status.setState({ dirty: [5] });
    expect(await t.sync.enable()).toBe('denied');
    expect(t.store.getState().healthSync).toBe(false);
    t.calls.permission = 'granted';
    expect(await t.sync.enable()).toBe('granted');
    expect(t.store.getState().healthSync).toBe(true);
    expect(t.status.getState().since).toBe(new Date(NOW).toISOString());
    expect(t.status.getState().dirty).toEqual([5]);
  });

  it('never writes while off, and keeps the unwritten work for when it is back on', async () => {
    const t = setup();
    const stop = t.sync.start();
    await t.flush();
    t.calls.failNext = 1;
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    expect(t.written).toEqual([]);
    t.sync.disable();
    expect(t.store.getState().healthSync).toBe(false);
    expect(t.status.getState()).toMatchObject({ since: null, retry: null, dirty: [1] });
    t.store.setState((s) => ({ sessions: [...s.sessions, log(2)] }));
    await t.flush();
    expect(t.written).toEqual([]);
    await t.sync.enable();
    await t.sync.retryNow();
    expect(t.written.map((w) => w.id)).toEqual([idOf(1)]);
    stop();
  });

  it('stops a run that is under way when sync is turned off', async () => {
    const t = setup();
    const stop = t.sync.start();
    await t.flush();
    const release = t.hold();
    t.store.setState({ sessions: [log(1), log(2)] });
    await t.flush();
    t.sync.disable();
    t.calls.failNext = 1;
    release();
    await t.flush();
    await t.flush();
    // The first write was already native; the second is never started and no retry is queued.
    expect(t.written.map((w) => w.id)).toEqual([]);
    expect(t.status.getState().retry).toBeNull();
    expect(t.healthIdOf(2)).toBeUndefined();
    stop();
  });
});

describe('export', () => {
  it('writes only sessions without an id or with an edit, and says what it did', async () => {
    const t = setup({
      healthSync: false,
      sessions: [
        log(1, { healthId: idOf(1) }),
        log(2),
        log(3, { skipped: true }),
        log(4, { finishedAt: undefined }),
        log(5, { results: {} }),
        log(6, { healthId: idOf(6) }),
      ],
    });
    t.status.setState({ dirty: [6] });
    const result = await t.sync.exportPast();
    expect(result).toMatchObject({ written: 2, alreadyThere: 1, skippedEmpty: 1, failed: false });
    expect(t.written.map((w) => w.id)).toEqual([idOf(2), idOf(6)]);
    expect(t.healthIdOf(2)).toBe(idOf(2));
    expect(t.status.getState().dirty).toEqual([]);
    const again = await t.sync.exportPast();
    expect(again).toMatchObject({ written: 0, alreadyThere: 3, skippedEmpty: 1 });
    expect(t.written).toHaveLength(2);
  });

  it('sends everything in one native call where the platform allows it', async () => {
    const t = setup({ healthSync: false, batch: true, sessions: [log(1), log(2), log(3)] });
    const result = await t.sync.exportPast();
    expect(result.written).toBe(3);
    expect(t.calls.batches).toEqual([[idOf(1), idOf(2), idOf(3)]]);
    expect([1, 2, 3].map(t.healthIdOf)).toEqual([idOf(1), idOf(2), idOf(3)]);
  });

  it('records nothing for a batch that failed, and reports it', async () => {
    const t = setup({ healthSync: false, batch: true, sessions: [log(1), log(2)] });
    t.calls.failNext = 1;
    expect(await t.sync.exportPast()).toMatchObject({ written: 0, failed: true });
    expect(t.healthIdOf(1)).toBeUndefined();
    expect(t.status.getState().lastError).not.toBeNull();
    // Export is a button press: it does not start a retry timer while sync is off.
    expect(t.status.getState().retry).toBeNull();
  });

  it('reports a failure and refuses without permission', async () => {
    const t = setup({ healthSync: false, sessions: [log(1), log(2)] });
    t.calls.failNext = 1;
    expect(await t.sync.exportPast()).toMatchObject({ written: 0, failed: true });
    t.calls.permission = 'denied';
    expect(await t.sync.exportPast()).toMatchObject({ written: 0, failed: false, permission: 'denied' });
  });

  it('keeps what was written when a later session fails', async () => {
    const t = setup({ healthSync: false, sessions: [log(1), log(2)] });
    let first = true;
    const sync = createHealthSync({
      store: t.store,
      status: t.status,
      platform: {
        permission: async () => 'granted',
        request: async () => 'granted',
        openSettings() {},
        write: async () => {
          if (!first) throw new Error('boom');
          first = false;
        },
      },
      now: () => NOW,
    });
    expect(await sync.exportPast()).toMatchObject({ written: 1, failed: true });
    expect(t.healthIdOf(1)).toBe(idOf(1));
    expect(t.healthIdOf(2)).toBeUndefined();
  });
});
