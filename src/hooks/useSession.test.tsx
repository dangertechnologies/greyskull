import { act, renderHook } from '@testing-library/react-native';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { useSession } from './useSession';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const labels = (items: ReturnType<typeof useSession>) =>
  items!.items.map(
    (i) =>
      `${i.exerciseId.slice(0, 3)}:${i.kind}:${i.kind === 'warmup' ? `${i.weightKg}x${i.targetReps}` : i.targetReps}`,
  );

beforeEach(() => {
  jest.useFakeTimers();
  useStore.setState({ ...initialState(), hydrated: true, restSeconds: 90 });
  useStore.getState().setProgram(TEMPLATES.base);
  useStore.getState().setLift('BARBELL_SQUAT', { weightKg: 100 });
});
afterEach(() => jest.useRealTimers());

test('session 0 lists warm-ups then work sets in program order', () => {
  const { result } = renderHook(() => useSession(0));
  expect(labels(result.current)).toEqual([
    'MIL:warmup:20x5',
    'MIL:work:5',
    'MIL:amrap:null',
    'BAR:warmup:20x5',
    'BAR:warmup:55x4',
    'BAR:warmup:70x3',
    'BAR:warmup:85x2',
    'BAR:work:5',
    'BAR:amrap:null',
  ]);
  expect(result.current!.activeIndex).toBe(0);
  expect(result.current!.isComplete).toBe(false);
});

test('warm-ups can be switched off in the program rules', () => {
  const program = JSON.parse(JSON.stringify(TEMPLATES.base)) as typeof TEMPLATES.base;
  program.rules.warmups = false;
  useStore.getState().setProgram(program);
  const { result } = renderHook(() => useSession(0));
  expect(result.current!.items.every((i) => i.kind !== 'warmup')).toBe(true);
});

test('recording a set persists it, advances, and starts the rest timer', () => {
  const { result } = renderHook(() => useSession(0));
  act(() => result.current!.record(0, 5)); // warm-up: no rest
  expect(result.current!.activeIndex).toBe(1);
  expect(result.current!.restRemaining).toBeNull();
  act(() => result.current!.record(1, 5));
  expect(result.current!.restRemaining).toBe(90);
  expect(useStore.getState().draft?.results.MILITARY_PRESS.sets[0].reps).toBe(5);
  act(() => void jest.advanceTimersByTime(30_000));
  expect(result.current!.restRemaining).toBeLessThanOrEqual(60);
  expect(result.current!.restRemaining).toBeGreaterThan(55);
  act(() => result.current!.skipRest());
  expect(result.current!.restRemaining).toBeNull();
  act(() => result.current!.record(2, 12));
  act(() => void jest.advanceTimersByTime(91_000));
  expect(result.current!.restRemaining).toBeNull();
});

test('rest time 0 disables the rest timer; the last set never rests', () => {
  useStore.getState().setSettings({ restSeconds: 0 });
  const { result } = renderHook(() => useSession(0));
  act(() => result.current!.record(1, 5));
  expect(result.current!.restRemaining).toBeNull();
  useStore.getState().setSettings({ restSeconds: 60 });
  const last = result.current!.items.length - 1;
  act(() => result.current!.record(last, 4));
  expect(result.current!.restRemaining).toBeNull();
});

test('kill and resume continues at the same set (warm-ups of started lifts count as done)', () => {
  const first = renderHook(() => useSession(0));
  act(() => first.result.current!.record(1, 5));
  act(() => first.result.current!.record(2, 12));
  first.unmount();
  const second = renderHook(() => useSession(0));
  const s = second.result.current!;
  expect(s.draft.n).toBe(0);
  expect(s.items[s.activeIndex]).toMatchObject({ exerciseId: 'BARBELL_SQUAT', kind: 'warmup', position: 1 });
  expect(second.result.current!.restRemaining).toBeNull();
});

test('full session: press AMRAP 12 and squat AMRAP 4 progress once; finishing does not restart a draft', () => {
  const { result } = renderHook(() => useSession(0));
  const reps = [5, 5, 12, 5, 4, 3, 2, 5, 4];
  reps.forEach((r, i) => {
    expect(result.current!.activeIndex).toBe(i);
    act(() => result.current!.record(i, r));
    act(() => result.current!.skipRest());
  });
  expect(result.current!.isComplete).toBe(true);
  let summary: ReturnType<NonNullable<ReturnType<typeof useSession>>['finish']> = [];
  act(() => {
    summary = result.current!.finish();
  });
  expect(summary.map((f) => [f.exerciseId, f.fromKg, f.outcome.next.weightKg, f.outcome.change])).toEqual([
    ['MILITARY_PRESS', 20, 22.5, 'double'],
    ['BARBELL_SQUAT', 100, 100, 'same'],
  ]);
  const s = useStore.getState();
  expect(s.draft).toBeNull();
  expect(s.nextSession).toBe(1);
  expect(s.lifts.BARBELL_SQUAT.fails).toBe(1);
  expect(result.current).toBeNull();
  expect(s.sessions).toHaveLength(1);
});

test('changing the weight mid-session rescales warm-ups', async () => {
  const { result } = renderHook(() => useSession(0));
  await act(async () => result.current!.setWeight('BARBELL_SQUAT', 60));
  const squatWarm = result.current!.items.filter(
    (i) => i.exerciseId === 'BARBELL_SQUAT' && i.kind === 'warmup',
  );
  expect(squatWarm.map((w) => w.weightKg)).toEqual([20, 32.5, 42.5, 50]);
});
