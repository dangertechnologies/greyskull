import { createStore } from 'zustand/vanilla';
import type { ActiveProgram, ExerciseResult, SessionLog } from '../domain';
import { type HealthStatus, initialHealthStatus, type Permission } from './status';
import { createHealthSync, type HealthPlatform } from './sync';
import type { HealthWorkout } from './workout';

interface FakeState {
  healthSync: boolean;
  sessions: SessionLog[];
  programs: ActiveProgram[];
  setHealthId(n: number, id: string): void;
  setHealthSync(on: boolean): void;
}

const NOW = Date.parse('2026-11-23T10:00:00.000Z');
const log = (n: number, patch: Partial<SessionLog> = {}): SessionLog => ({
  n,
  dayName: 'Day A',
  startedAt: `2026-11-2${n}T08:00:00.000Z`,
  finishedAt: `2026-11-2${n}T09:00:00.000Z`,
  results: {},
  order: [],
  programName: 'Plan',
  ...patch,
});

function setup(opts: { sessions?: SessionLog[]; healthSync?: boolean; permission?: Permission } = {}) {
  const store = createStore<FakeState>()((set) => ({
    healthSync: opts.healthSync ?? true,
    sessions: opts.sessions ?? [],
    programs: [],
    setHealthId: (n, id) =>
      set((s) => ({ sessions: s.sessions.map((l) => (l.n === n ? { ...l, healthId: id } : l)) })),
    setHealthSync: (on) => set({ healthSync: on }),
  }));
  const status = createStore<HealthStatus>()(() => ({
    ...initialHealthStatus(),
    since: '2026-11-01T00:00:00.000Z',
  }));
  const written: HealthWorkout[] = [];
  const calls = { failNext: 0, permission: opts.permission ?? ('granted' as Permission) };
  const platform: HealthPlatform = {
    permission: async () => calls.permission,
    request: async () => calls.permission,
    openSettings: jest.fn(),
    write: async (w) => {
      if (calls.failNext > 0) {
        calls.failNext--;
        throw new Error('boom');
      }
      written.push(w);
    },
  };
  let now = NOW;
  const sync = createHealthSync({ store, status, platform, now: () => now });
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return {
    store,
    status,
    written,
    calls,
    sync,
    flush,
    tick: (ms: number) => {
      now += ms;
    },
  };
}

describe('health sync', () => {
  it('writes a workout that finishes while sync is on, then records its id', async () => {
    const t = setup();
    const stop = t.sync.start();
    await t.flush();
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    expect(t.written.map((w) => w.id)).toEqual(['greyskull-2026-11-21T08:00:00.000Z-1']);
    expect(t.store.getState().sessions[0].healthId).toBe('greyskull-2026-11-21T08:00:00.000Z-1');
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

  it('skips drafts, skipped sessions and sessions that already have an id', async () => {
    const t = setup();
    const stop = t.sync.start();
    t.store.setState({
      sessions: [log(1, { finishedAt: undefined }), log(2, { skipped: true }), log(3, { healthId: 'x' })],
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
    const write = async (w: HealthWorkout) => {
      active++;
      overlap ||= active > 1;
      await new Promise((r) => setTimeout(r, 5));
      order.push(Number(w.id.split('-').pop()));
      active--;
    };
    const sync = createHealthSync({
      store: t.store,
      status: t.status,
      platform: {
        permission: async () => 'granted',
        request: async () => 'granted',
        openSettings() {},
        write,
      },
      now: () => NOW,
    });
    const stop = sync.start();
    t.store.setState({ sessions: [log(1), log(2), log(3)] });
    t.store.setState((s) => ({ sessions: [...s.sessions, log(4)] }));
    await new Promise((r) => setTimeout(r, 80));
    expect(order).toEqual([1, 2, 3, 4]);
    expect(overlap).toBe(false);
    stop();
  });

  it('writes the same id again with a higher version when the session is edited', async () => {
    const t = setup();
    const stop = t.sync.start();
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    t.tick(1000);
    const results: Record<string, ExerciseResult> = { SQUAT: { weightKg: 100, sets: [] } };
    t.store.setState((s) => ({ sessions: s.sessions.map((l) => ({ ...l, results })) }));
    await t.flush();
    expect(t.written.map((w) => w.id)).toEqual([t.written[0].id, t.written[0].id]);
    expect(t.written[1].version).toBeGreaterThan(t.written[0].version);
    expect(t.status.getState().dirty).toEqual([]);
    stop();
  });

  it('keeps a failed write queued, reports it, and backs off', async () => {
    const t = setup();
    const stop = t.sync.start();
    await t.flush();
    t.calls.failNext = 1;
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    expect(t.written).toEqual([]);
    expect(t.store.getState().sessions[0].healthId).toBeUndefined();
    const s = t.status.getState();
    expect(s.lastError?.message).toContain('boom');
    expect(s.retry?.attempts).toBe(1);
    expect(s.retry?.at).toBeGreaterThan(NOW);
    stop();
  });

  it('retries on the next launch only after the backoff has passed', async () => {
    const t = setup({ sessions: [log(1)] });
    t.status.setState({
      lastError: { at: 'x', message: 'boom' },
      retry: { attempts: 1, at: NOW + 60_000 },
    });
    t.sync.start()();
    await t.flush();
    expect(t.written).toEqual([]);
    t.tick(61_000);
    const stop = t.sync.start();
    await t.flush();
    expect(t.written).toHaveLength(1);
    expect(t.status.getState().lastError).toBeNull();
    expect(t.status.getState().retry).toBeNull();
    stop();
  });

  it('writes a new workout at once even inside the backoff', async () => {
    const t = setup();
    t.status.setState({ retry: { attempts: 3, at: NOW + 3_600_000 } });
    const stop = t.sync.start();
    await t.flush();
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    expect(t.written).toHaveLength(1);
    stop();
  });

  it('writes again with the same id when a crash lost the id (no healthId stored)', async () => {
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

  it('turns on only when permission is granted', async () => {
    const t = setup({ healthSync: false, permission: 'denied' });
    expect(await t.sync.enable()).toBe('denied');
    expect(t.store.getState().healthSync).toBe(false);
    t.calls.permission = 'granted';
    expect(await t.sync.enable()).toBe('granted');
    expect(t.store.getState().healthSync).toBe(true);
    expect(t.status.getState().since).toBe(new Date(NOW).toISOString());
  });

  it('turning off forgets the start time and the queue', async () => {
    const t = setup();
    t.status.setState({ dirty: [1], retry: { attempts: 1, at: 1 } });
    t.sync.disable();
    expect(t.store.getState().healthSync).toBe(false);
    expect(t.status.getState()).toMatchObject({ since: null, dirty: [], retry: null });
  });

  it('exports every finished log, ignoring stored ids, and repeating is safe', async () => {
    const t = setup({
      healthSync: false,
      sessions: [
        log(1, { healthId: 'old' }),
        log(2),
        log(3, { skipped: true }),
        log(4, { finishedAt: undefined }),
      ],
    });
    const first = await t.sync.exportPast();
    t.tick(10);
    const second = await t.sync.exportPast();
    expect(first).toMatchObject({ written: 2, failed: false });
    expect(second).toMatchObject({ written: 2, failed: false });
    expect(t.written.map((w) => w.id)).toEqual([
      'greyskull-2026-11-21T08:00:00.000Z-1',
      'greyskull-2026-11-22T08:00:00.000Z-2',
      'greyskull-2026-11-21T08:00:00.000Z-1',
      'greyskull-2026-11-22T08:00:00.000Z-2',
    ]);
    expect(t.store.getState().sessions.find((l) => l.n === 1)?.healthId).toBe(
      'greyskull-2026-11-21T08:00:00.000Z-1',
    );
  });

  it('export reports a failure and refuses without permission', async () => {
    const t = setup({ healthSync: false, sessions: [log(1), log(2)] });
    t.calls.failNext = 1;
    expect(await t.sync.exportPast()).toMatchObject({ written: 0, failed: true });
    expect(t.status.getState().lastError).not.toBeNull();
    t.calls.permission = 'denied';
    expect(await t.sync.exportPast()).toMatchObject({ written: 0, failed: false, permission: 'denied' });
  });

  it('writes an edit again when it lands while the earlier write is in flight', async () => {
    const t = setup();
    let release = () => {};
    const writes: HealthWorkout[] = [];
    let first = true;
    const sync = createHealthSync({
      store: t.store,
      status: t.status,
      platform: {
        permission: async () => 'granted',
        request: async () => 'granted',
        openSettings() {},
        write: async (w) => {
          writes.push(w);
          if (first) {
            first = false;
            await new Promise<void>((r) => {
              release = r;
            });
          }
        },
      },
      now: () => NOW + writes.length,
    });
    const stop = sync.start();
    t.store.setState({ sessions: [log(1)] });
    await t.flush();
    // The first write is waiting; edit the session now, then let it finish.
    t.store.setState((s) => ({ sessions: s.sessions.map((l) => ({ ...l, healthId: 'x' })) }));
    t.store.setState((s) => ({
      sessions: s.sessions.map((l) => ({ ...l, results: { A: { weightKg: 1, sets: [] } } })),
    }));
    release();
    await t.flush();
    await t.flush();
    expect(writes).toHaveLength(2);
    expect(t.status.getState().dirty).toEqual([]);
    stop();
  });
});
