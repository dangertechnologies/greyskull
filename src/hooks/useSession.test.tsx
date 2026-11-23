import { act, renderHook } from '@testing-library/react-native';
import { lifts, programId, setLift, setPosition, setProgram } from '../__fixtures__/oneProgram';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { useSession } from './useSession';

const labels = (items: ReturnType<typeof useSession>) =>
  items!.items.map(
    (i) =>
      `${i.exerciseId.slice(0, 3)}:${i.kind}:${i.kind === 'warmup' ? `${i.weightKg}x${i.targetReps}` : i.targetReps}`,
  );

beforeEach(() => {
  jest.useFakeTimers();
  useStore.setState({ ...initialState(), hydrated: true, restSeconds: 90 });
  setProgram(TEMPLATES.base);
  setLift('BARBELL_SQUAT', { weightKg: 100 });
});
afterEach(() => jest.useRealTimers());

test('session 0 lists warm-ups then work sets in program order', () => {
  const { result } = renderHook(() => useSession(0, programId()));
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
  setProgram(program);
  const { result } = renderHook(() => useSession(0, programId()));
  expect(result.current!.items.every((i) => i.kind !== 'warmup')).toBe(true);
});

test('recording a set persists it, advances, and starts the rest timer', () => {
  const { result } = renderHook(() => useSession(0, programId()));
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
  const { result } = renderHook(() => useSession(0, programId()));
  act(() => result.current!.record(1, 5));
  expect(result.current!.restRemaining).toBeNull();
  useStore.getState().setSettings({ restSeconds: 60 });
  const last = result.current!.items.length - 1;
  act(() => result.current!.record(last, 4));
  expect(result.current!.restRemaining).toBeNull();
});

test('kill and resume continues at the same set (warm-ups of started lifts count as done)', () => {
  const first = renderHook(() => useSession(0, programId()));
  act(() => first.result.current!.record(1, 5));
  act(() => first.result.current!.record(2, 12));
  first.unmount();
  const second = renderHook(() => useSession(0, programId()));
  const s = second.result.current!;
  expect(s.draft.n).toBe(0);
  expect(s.items[s.activeIndex]).toMatchObject({ exerciseId: 'BARBELL_SQUAT', kind: 'warmup', position: 1 });
  expect(second.result.current!.restRemaining).toBeNull();
});

test('full session: press AMRAP 12 and squat AMRAP 4 progress once; finishing does not restart a draft', () => {
  const { result } = renderHook(() => useSession(0, programId()));
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
  expect(lifts().BARBELL_SQUAT.fails).toBe(1);
  expect(result.current).toBeNull();
  expect(s.sessions).toHaveLength(1);
});

test('changing the weight mid-session rescales warm-ups', async () => {
  const { result } = renderHook(() => useSession(0, programId()));
  await act(async () => result.current!.setWeight('BARBELL_SQUAT', 60));
  const squatWarm = result.current!.items.filter(
    (i) => i.exerciseId === 'BARBELL_SQUAT' && i.kind === 'warmup',
  );
  expect(squatWarm.map((w) => w.weightKg)).toEqual([20, 32.5, 42.5, 50]);
});

describe('editing and rest controls', () => {
  test('selecting a logged set shows it; logging it again changes reps without a rest', async () => {
    useStore.getState().setSettings({ restSeconds: 90 });
    const { result } = renderHook(() => useSession(0, programId()));
    act(() => result.current?.record(0, 5)); // warm-up
    act(() => result.current?.record(1, 5)); // set 1 → rest starts
    act(() => result.current?.skipRest());
    expect(result.current?.selectedIndex).toBe(result.current?.activeIndex);
    await act(async () => result.current?.select(1));
    expect(result.current?.selectedIndex).toBe(1);
    act(() => result.current?.record(1, 7));
    expect(useStore.getState().draft?.results.MILITARY_PRESS.sets[0].reps).toBe(7);
    expect(result.current?.restRemaining).toBeNull();
    expect(result.current?.selectedIndex).toBe(result.current?.activeIndex); // follows the open set again
  });

  test('±30 s changes the rest, never below zero, and the total follows', () => {
    useStore.getState().setSettings({ restSeconds: 90 });
    const { result } = renderHook(() => useSession(0, programId()));
    act(() => result.current?.record(1, 5));
    expect(result.current?.restTotal).toBe(90);
    act(() => result.current?.addRest(30));
    expect(result.current?.restTotal).toBe(120);
    expect(result.current?.restRemaining).toBe(120);
    act(() => result.current?.addRest(-30));
    act(() => result.current?.addRest(-30));
    act(() => result.current?.addRest(-30));
    act(() => result.current?.addRest(-30));
    expect(result.current?.restRemaining ?? null).toBeNull(); // shortened to nothing: the rest is over
  });

  test('finish reports personal records against earlier sessions only', () => {
    const { result } = renderHook(() => useSession(0, programId()));
    result.current?.items.forEach((_i, index) => {
      act(() => result.current?.record(index, 5));
      act(() => result.current?.skipRest());
    });
    let first: ReturnType<NonNullable<ReturnType<typeof useSession>>['finish']> = [];
    act(() => {
      first = result.current?.finish() ?? [];
    });
    expect(first.every((f) => f.pr === false)).toBe(true); // nothing to beat on the first session
  });
});

test('531 items use each set weight and warm-ups ramp to the first main set', () => {
  setProgram({
    template: 'custom',
    sessionsPerWeek: 3,
    rules: { ...TEMPLATES.base.rules, progression: '531' },
    days: [{ name: 'A', slots: [{ exercise: 'BARBELL_SQUAT', scheme: '3x5+' }] }],
  });
  setLift('BARBELL_SQUAT', { weightKg: 100 });
  setPosition(2);
  const { result, unmount } = renderHook(() => useSession(0, programId()));
  const work = result.current!.items.filter((i) => i.kind !== 'warmup');
  expect(work.map((i) => i.weightKg)).toEqual([75, 85, 95, 75, 75, 75, 75, 75]);
  expect(work[2]).toMatchObject({ kind: 'amrap', minReps: 1, perSetWeight: true });
  expect(result.current!.items.filter((i) => i.kind === 'warmup').map((i) => i.weightKg)).toEqual([
    20, 40, 52.5, 62.5,
  ]);
  unmount();
});

test('the session takes its program from the draft, not the first program', () => {
  const noWarmups = JSON.parse(JSON.stringify(TEMPLATES.base)) as typeof TEMPLATES.base;
  noWarmups.rules.warmups = false;
  const second = useStore.getState().addProgram({ ...noWarmups, name: 'Second' });
  const draft = useStore.getState().startSession(second);
  const { result } = renderHook(() => useSession(draft.n));
  expect(result.current!.draft.programId).toBe(second);
  expect(result.current!.items.every((i) => i.kind !== 'warmup')).toBe(true);
});

test('another program cannot start while a workout is open', () => {
  const second = useStore.getState().addProgram({ ...TEMPLATES.base, name: 'Second' });
  useStore.getState().startSession(second);
  const { result } = renderHook(() => useSession(useStore.getState().nextSession, programId()));
  expect(result.current).toBeNull();
  expect(useStore.getState().draft?.programId).toBe(second);
});

test('a workout finished elsewhere is not started again by an open session screen', () => {
  const { result } = renderHook(() => useSession(0, programId()));
  expect(result.current!.draft.n).toBe(0);
  act(() => void useStore.getState().finishSession());
  expect(useStore.getState().draft).toBeNull();
  expect(result.current).toBeNull();
});
