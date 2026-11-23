import { active } from '../__fixtures__/oneProgram';
import { TEMPLATES } from '../domain';
import { initialState } from '../store';
import { startPublisher } from './publisher';

jest.useFakeTimers();

const program = (id: string, name: string) => ({ ...active(TEMPLATES.base, 0, {}), id, name });

function fakeStore() {
  let state = { ...initialState(), hydrated: true };
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    set(patch: Partial<typeof state>) {
      state = { ...state, ...patch };
      for (const l of [...listeners]) l();
    },
  };
}

const kindsOf = (write: jest.Mock<unknown, [string, unknown]>) => write.mock.calls.map((c) => c[0]);

describe('catalog publisher', () => {
  test('publishes once at launch, before any change', async () => {
    const store = fakeStore();
    const write = jest.fn(async (_kind: string, _entities: unknown) => undefined);
    startPublisher({ store, write });
    await jest.advanceTimersByTimeAsync(0);
    expect(kindsOf(write)).toEqual(['nextWorkout', 'program']);
  });

  test('waits for the store to load', async () => {
    const store = fakeStore();
    store.set({ hydrated: false });
    const write = jest.fn(async (_kind: string, _entities: unknown) => undefined);
    startPublisher({ store, write });
    await jest.advanceTimersByTimeAsync(1000);
    expect(write).not.toHaveBeenCalled();
  });

  test('a burst of changes is written once, 300 ms after the last', async () => {
    const store = fakeStore();
    const write = jest.fn(async (_kind: string, _entities: unknown) => undefined);
    startPublisher({ store, write });
    await jest.advanceTimersByTimeAsync(0);
    write.mockClear();
    store.set({ programs: [program('a', 'Alpha')] });
    await jest.advanceTimersByTimeAsync(200);
    store.set({ programs: [program('a', 'Alpha'), program('b', 'Beta')] });
    await jest.advanceTimersByTimeAsync(299);
    expect(write).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(kindsOf(write)).toEqual(['nextWorkout', 'program']);
    expect(write.mock.calls[1][1]).toHaveLength(2);
  });

  test.each([
    ['rename', { programs: [program('a', 'Renamed')] }],
    ['pause', { programs: [{ ...program('a', 'Alpha'), paused: true }] }],
    ['unit', { unit: 'lb' as const }],
    ['weights to confirm', { needsWeightConfirm: true }],
  ])('a %s is published', async (_name, patch) => {
    const store = fakeStore();
    store.set({ programs: [program('a', 'Alpha')] });
    const write = jest.fn(async (_kind: string, _entities: unknown) => undefined);
    startPublisher({ store, write });
    await jest.advanceTimersByTimeAsync(0);
    write.mockClear();
    store.set(patch);
    await jest.advanceTimersByTimeAsync(300);
    expect(write).toHaveBeenCalled();
  });

  test('a change that alters nothing the intents read is not written', async () => {
    const store = fakeStore();
    const write = jest.fn(async (_kind: string, _entities: unknown) => undefined);
    startPublisher({ store, write });
    await jest.advanceTimersByTimeAsync(0);
    write.mockClear();
    store.set({ sessions: [] });
    await jest.advanceTimersByTimeAsync(300);
    expect(write).not.toHaveBeenCalled();
  });

  test('a failed write is retried after 1 s, 5 s and 30 s, then waits for the next change', async () => {
    const store = fakeStore();
    const write = jest.fn(async (_kind: string, _entities: unknown) => {
      throw new Error('disk');
    });
    startPublisher({ store, write });
    await jest.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(999);
    expect(write).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(5000);
    expect(write).toHaveBeenCalledTimes(3);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(write).toHaveBeenCalledTimes(4);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(write).toHaveBeenCalledTimes(4);
    store.set({ programs: [program('a', 'Alpha')] });
    await jest.advanceTimersByTimeAsync(300);
    expect(write).toHaveBeenCalledTimes(5);
  });

  test('a retry that works stops retrying', async () => {
    const store = fakeStore();
    const write = jest
      .fn<Promise<void>, [string, unknown]>()
      .mockRejectedValueOnce(new Error('disk'))
      .mockResolvedValue(undefined);
    startPublisher({ store, write });
    await jest.advanceTimersByTimeAsync(1000);
    const calls = write.mock.calls.length;
    await jest.advanceTimersByTimeAsync(60_000);
    expect(write.mock.calls.length).toBe(calls);
  });

  test('stopping cancels pending writes and retries', async () => {
    const store = fakeStore();
    const write = jest.fn(async (_kind: string, _entities: unknown) => {
      throw new Error('disk');
    });
    const stop = startPublisher({ store, write });
    await jest.advanceTimersByTimeAsync(0);
    stop();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(write).toHaveBeenCalledTimes(1);
  });
});
