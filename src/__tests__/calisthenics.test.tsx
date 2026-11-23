import { act } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import { lifts, programId, setProgram } from '../__fixtures__/oneProgram';
import type { LiftState, Program } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));

const get = () => useStore.getState();
const allRoutes = () => ({ ...routes(), 'ladder/[id]': require('../../app/ladder/[id]') });

/** A pull-up ladder and a dip ladder (its first step is a timed support hold). */
const program = (): Program => ({
  template: 'custom',
  sessionsPerWeek: 3,
  rules: { doubleAt: 10, deloadPct: 0.1, failsBeforeDeload: 1, warmups: true },
  days: [
    {
      name: 'A',
      slots: [
        { exercise: 'CAL_SCAPULAR_PULL', scheme: '3x5-8', ladder: 'rr_pullup' },
        { exercise: 'CAL_SUPPORT_HOLD', scheme: '3x5-8', ladder: 'rr_dip' },
      ],
    },
  ],
});

/** Replace a lift state as if it was set long ago (no `touchedAt`), so a break can ease it. */
function setStale(key: string, state: Partial<LiftState>) {
  useStore.setState((s) => ({
    programs: s.programs.map((p, i) =>
      i === 0 ? { ...p, lifts: { ...p.lifts, [key]: { weightKg: 0, startKg: 0, fails: 0, ...state } } } : p,
    ),
  }));
}

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true, restSeconds: 0 });
  setProgram(program());
});
afterEach(() => jest.useRealTimers());

test('a ladder step shows its place; Harder and Easier swap the exercise in the workout', async () => {
  await renderRouter(allRoutes(), { initialUrl: `/session/0?program=${programId()}` });
  expect(await screen.findByText('Pull-up progression · step 1 of 6')).toBeTruthy();
  expect(screen.getByText('Scapular pull')).toBeTruthy();
  expect(screen.getByText('Arch hang · 3×8 to move on')).toBeTruthy();
  fireEvent.press(screen.getByTestId('ladder-harder'));
  expect(await screen.findByText('Arch hang')).toBeTruthy();
  expect(screen.getByText('Pull-up progression · step 2 of 6')).toBeTruthy();
  expect(lifts().rr_pullup.step).toBe(1);
  expect(get().draft?.order[0]).toBe('CAL_ARCH_HANG');
  fireEvent.press(screen.getByTestId('ladder-easier'));
  expect(await screen.findByText('Scapular pull')).toBeTruthy();
  expect(lifts().rr_pullup.step).toBe(0);
});

test('a hold is timed with the stopwatch and logged in seconds', async () => {
  jest.useFakeTimers();
  setStale('rr_pullup', { step: 0 });
  get().startSession(programId());
  for (let i = 0; i < 3; i++) get().logSet('CAL_SCAPULAR_PULL', i, 8);
  await renderRouter(allRoutes(), { initialUrl: '/session/0' });
  expect(await screen.findByText('Support hold')).toBeTruthy();
  expect(screen.getByText('Target 10 s')).toBeTruthy();
  fireEvent.press(screen.getByTestId('hold-toggle'));
  act(() => void jest.advanceTimersByTime(12_300));
  expect(screen.getByText('0:12')).toBeTruthy();
  expect(screen.getByText('Stopwatch running · buzz at 10 s')).toBeTruthy();
  fireEvent.press(screen.getByTestId('stop-hold'));
  expect(get().draft?.results.CAL_SUPPORT_HOLD.sets[0].reps).toBe(12);
  expect(screen.getByText('12 s')).toBeTruthy();
});

test('after a break the session says what was eased, and Undo takes it back', async () => {
  setStale('rr_pullup', { step: 2 });
  useStore.setState({
    sessions: [
      {
        n: 50,
        dayName: 'A',
        startedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        results: {
          CAL_PULLUP_NEGATIVE: { weightKg: 0, sets: [{ target: 5, reps: 5 }], lift: 'rr_pullup', step: 2 },
        },
        order: ['CAL_PULLUP_NEGATIVE'],
      },
    ],
    nextSession: 51,
  });
  await renderRouter(allRoutes(), { initialUrl: `/session/51?program=${programId()}` });
  expect(await screen.findByText('30 days since you last trained · ladders one step back')).toBeTruthy();
  expect(screen.getByText('Arch hang')).toBeTruthy();
  fireEvent.press(screen.getByTestId('undo-ease'));
  expect(await screen.findByText('Pull-up negative')).toBeTruthy();
  expect(screen.queryByTestId('ease-banner')).toBeNull();
  expect(get().draft?.eased).toBeUndefined();
});

test('the one-page view times holds in a sheet and shows the ease banner too', async () => {
  jest.useFakeTimers();
  get().setSettings({ minimalist: true });
  await renderRouter(allRoutes(), { initialUrl: `/session/0?program=${programId()}` });
  expect(await screen.findByText('Pull-up progression · step 1 of 6')).toBeTruthy();
  fireEvent.press(screen.getByTestId('set-pill-CAL_SUPPORT_HOLD-1'));
  fireEvent.press(screen.getByTestId('hold-toggle'));
  act(() => void jest.advanceTimersByTime(15_000));
  fireEvent.press(screen.getByTestId('hold-toggle')); // pause
  fireEvent.press(screen.getByTestId('log-hold'));
  expect(get().draft?.results.CAL_SUPPORT_HOLD.sets[0].reps).toBe(15);
  expect(screen.getByText('15 s')).toBeTruthy();
});

test('finishing at the top of a step names the next step', async () => {
  setStale('rr_pullup', { step: 0, reps: 8 });
  get().startSession(programId());
  for (let i = 0; i < 3; i++) get().logSet('CAL_SCAPULAR_PULL', i, 8);
  for (let i = 0; i < 3; i++) get().logSet('CAL_SUPPORT_HOLD', i, 10);
  await renderRouter(allRoutes(), { initialUrl: '/session/0' });
  fireEvent.press(await screen.findByTestId('finish-workout'));
  expect(await screen.findByText('Step up: Arch hang')).toBeTruthy();
  expect(screen.queryByText(/0 kg/)).toBeNull();
});

describe('the ladder screen', () => {
  test('lists steps done, current with its rule, and next; tapping a step asks, then moves there', async () => {
    setStale('rr_pullup', { step: 2 });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Start here')?.onPress?.();
    });
    await renderRouter(allRoutes(), { initialUrl: `/ladder/rr_pullup?program=${programId()}` });
    expect(await screen.findByText('Step 3 of 6 · tap a step to start there')).toBeTruthy();
    expect(screen.getByLabelText('1. Scapular pull, done, 3×8')).toBeTruthy();
    expect(screen.getByText('3. Pull-up negative')).toBeTruthy();
    expect(screen.getByText('3×8 to move on')).toBeTruthy();
    expect(screen.getByLabelText(/4\. Band-assisted pull-up, not reached/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('ladder-step-4'));
    expect(alert).toHaveBeenCalledWith('Start at Pull-up?', expect.any(String), expect.any(Array));
    expect(lifts().rr_pullup.step).toBe(4);
    alert.mockRestore();
  });

  test('with sets of the ladder logged in the open workout, steps cannot be chosen', async () => {
    get().startSession(programId());
    get().logSet('CAL_SCAPULAR_PULL', 0, 5);
    const alert = jest.spyOn(Alert, 'alert');
    await renderRouter(allRoutes(), { initialUrl: `/ladder/rr_pullup?program=${programId()}` });
    expect(await screen.findByTestId('ladder-locked')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ladder-step-3'));
    expect(alert).not.toHaveBeenCalled();
    expect(lifts().rr_pullup.step ?? 0).toBe(0);
    alert.mockRestore();
  });

  test('the dialog says the workout in progress changes too when the ladder is in it', async () => {
    get().startSession(programId());
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderRouter(allRoutes(), { initialUrl: `/ladder/rr_pullup?program=${programId()}` });
    fireEvent.press(await screen.findByTestId('ladder-step-2'));
    expect(alert).toHaveBeenCalledWith(
      'Start at Pull-up negative?',
      'The workout in progress and your next workouts use this step.',
      expect.any(Array),
    );
    alert.mockRestore();
  });

  test('an unknown ladder or program shows a not-found state', async () => {
    await renderRouter(allRoutes(), { initialUrl: '/ladder/nope' });
    expect(await screen.findByText('Ladder not found')).toBeTruthy();
    act(() => require('expo-router').router.replace('/ladder/rr_pullup?program=gone'));
    expect(await screen.findByText('Program not found')).toBeTruthy();
  });
});

describe('the lift screen', () => {
  /** Finished sessions of the pull-up ladder: `[step, reps]` per session, the first `own` in this program. */
  function history(rows: [number, number][], own = rows.length) {
    const exercise = (step: number) => ['CAL_SCAPULAR_PULL', 'CAL_ARCH_HANG', 'CAL_PULLUP_NEGATIVE'][step];
    useStore.setState({
      sessions: rows.map(([step, reps], n) => ({
        n,
        dayName: 'A',
        startedAt: new Date(Date.UTC(2026, 9, n + 1)).toISOString(),
        finishedAt: new Date(Date.UTC(2026, 9, n + 1)).toISOString(),
        programId: n < own ? programId() : 'removed',
        results: {
          [exercise(step)]: {
            weightKg: 0,
            sets: [{ target: 5, reps }],
            lift: 'rr_pullup',
            step,
            scheme: step === 1 ? ('3x10-30s' as const) : ('3x5-8' as const),
            ...(step === 1 ? { timed: true as const } : {}),
          },
        },
        order: [exercise(step)],
      })),
      nextSession: rows.length,
    });
  }

  test('a ladder charts its level with step names, and can chart every program', async () => {
    setStale('rr_pullup', { step: 2 });
    history(
      [
        [0, 8],
        [1, 20],
        [2, 5],
        [0, 6],
      ],
      3,
    );
    await renderRouter(allRoutes(), { initialUrl: `/lift/rr_pullup?program=${programId()}` });
    expect(
      await screen.findByLabelText('Pull-up progression: Level 2 to Level 3 over 3 sessions'),
    ).toBeTruthy();
    expect(screen.getByText('3 Pull-up negative')).toBeTruthy();
    expect(screen.getByText('Step now: Pull-up negative · 3 of 6')).toBeTruthy();
    expect(screen.getByText('Arch hang · 20 s')).toBeTruthy();
    expect(screen.getByText('Best last set at this step: 5 reps')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'All programs' }));
    expect(screen.getByLabelText('Pull-up progression: Level 1.3 to Level 3 over 4 sessions')).toBeTruthy();
  });

  test('a hold step counts its best in seconds; the top of the last step stays at the last level', async () => {
    setStale('rr_pullup', { step: 1 });
    history([
      [0, 8],
      [1, 20],
    ]);
    await renderRouter(allRoutes(), { initialUrl: `/lift/rr_pullup?program=${programId()}` });
    expect(await screen.findByText('Best last set at this step: 20 s')).toBeTruthy();
    screen.unmount();
    const exercise = 'CAL_LSIT_PULLUP';
    useStore.setState({
      sessions: [0, 1].map((n) => ({
        n,
        dayName: 'A',
        startedAt: new Date(Date.UTC(2026, 9, n + 1)).toISOString(),
        finishedAt: new Date(Date.UTC(2026, 9, n + 1)).toISOString(),
        programId: programId(),
        results: {
          [exercise]: {
            weightKg: 0,
            sets: [{ target: 8, reps: 5 + 3 * n }],
            lift: 'rr_pullup',
            step: 5,
            scheme: '3x5-8' as const,
          },
        },
        order: [exercise],
      })),
    });
    setStale('rr_pullup', { step: 5 });
    await renderRouter(allRoutes(), { initialUrl: `/lift/rr_pullup?program=${programId()}` });
    expect(
      await screen.findByLabelText('Pull-up progression: Level 6 to Level 6 over 2 sessions'),
    ).toBeTruthy();
  });

  test('a program id that no longer exists shows a not-found state', async () => {
    await renderRouter(allRoutes(), { initialUrl: '/lift/rr_pullup?program=gone' });
    expect(await screen.findByText('Program not found')).toBeTruthy();
  });

  test('a timed lift charts seconds', async () => {
    useStore.setState({
      sessions: [10, 25].map((reps, n) => ({
        n,
        dayName: 'A',
        startedAt: new Date(Date.UTC(2026, 9, n + 1)).toISOString(),
        finishedAt: new Date(Date.UTC(2026, 9, n + 1)).toISOString(),
        results: { CAL_SUPPORT_HOLD: { weightKg: 0, sets: [{ target: 10, reps }], timed: true } },
        order: ['CAL_SUPPORT_HOLD'],
      })),
    });
    await renderRouter(allRoutes(), { initialUrl: '/lift/CAL_SUPPORT_HOLD' });
    expect(await screen.findByLabelText('Support hold: 10 s to 25 s over 2 sessions')).toBeTruthy();
    expect(screen.getByText('Best last set: 25 s')).toBeTruthy();
  });
});

test('the past-session editor edits seconds for holds and added load for bodyweight', async () => {
  useStore.setState({
    sessions: [
      {
        n: 0,
        dayName: 'A',
        startedAt: new Date(Date.UTC(2026, 9, 1)).toISOString(),
        finishedAt: new Date(Date.UTC(2026, 9, 1)).toISOString(),
        programId: programId(),
        results: {
          CAL_SUPPORT_HOLD: { weightKg: 0, sets: [{ target: 10, reps: 12 }], timed: true },
          DIPS: { weightKg: 5, sets: [{ target: 8, reps: 8 }] },
        },
        order: ['CAL_SUPPORT_HOLD', 'DIPS'],
      },
    ],
    nextSession: 1,
  });
  await renderRouter(allRoutes(), { initialUrl: '/session/edit/0' });
  expect(await screen.findByText('12 s')).toBeTruthy();
  expect(screen.getByText('+5.0 kg')).toBeTruthy();
  expect(screen.getByText('8 reps')).toBeTruthy();
  const increase = () => screen.getAllByLabelText('Increase');
  fireEvent.press(increase()[0]); // hold 12 → 13 s
  fireEvent.press(increase()[1]); // dips added load 5 → 6.25 kg
  fireEvent.press(screen.getByText('Save'));
  const { results } = get().sessions[0];
  expect(results.CAL_SUPPORT_HOLD.sets[0].reps).toBe(13);
  expect(results.DIPS.weightKg).toBe(6.25);
});

test('the one-page view shows and edits a bodyweight exercise’s added load', async () => {
  const p = program();
  p.days[0].slots.push({ exercise: 'CHINUPS', scheme: '3x5-8', progression: 'double' });
  setProgram(p);
  get().setLift(programId(), 'CHINUPS', { weightKg: 10 });
  get().setSettings({ minimalist: true });
  await renderRouter(allRoutes(), { initialUrl: `/session/0?program=${programId()}` });
  fireEvent.press(await screen.findByLabelText('Change added load, now +10 kg'));
  fireEvent.press(screen.getByLabelText('Increase'));
  expect(get().draft?.results.CHINUPS.weightKg).toBe(11.25);
  expect(screen.getAllByText('+11.25 kg').length).toBeGreaterThan(0);
});

describe('setup with calisthenics programs', () => {
  test.each([
    ['Recommended Routine'],
    ['Hybrid'],
    ['Six Ladders'],
    ['Skill Track'],
    ['GZCLP'],
    ['5/3/1 for Beginners'],
  ])('%s goes through the plates, plan and starting-weights steps', async (name) => {
    useStore.setState({ ...initialState(), hydrated: true });
    await renderRouter(allRoutes(), { initialUrl: '/' });
    fireEvent.press(await screen.findByTestId('get-started'));
    expect(screen.getAllByText(/per side/).length).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId('setup-next'));
    fireEvent.press(await screen.findByRole('radio', { name: new RegExp(`^${name.replace('/', '\\/')}`) }));
    fireEvent.press(screen.getByTestId('setup-next'));
    fireEvent.press(await screen.findByTestId('start-training'));
    expect(await screen.findByText(/^Next:/)).toBeTruthy();
  });
});

describe('holds, fix round', () => {
  test('Stop at 0:00 logs nothing; a running hold shows Stop even while a rest counts down', async () => {
    jest.useFakeTimers();
    get().setSettings({ restSeconds: 90 });
    setStale('rr_pullup', { step: 0 });
    get().startSession(programId());
    for (let i = 0; i < 3; i++) get().logSet('CAL_SCAPULAR_PULL', i, 8);
    await renderRouter(allRoutes(), { initialUrl: '/session/0' });
    fireEvent.press(await screen.findByTestId('hold-toggle'));
    expect(screen.getByTestId('stop-hold')).toBeDisabled();
    act(() => void jest.advanceTimersByTime(11_000));
    fireEvent.press(screen.getByTestId('stop-hold'));
    expect(get().draft?.results.CAL_SUPPORT_HOLD.sets[0].reps).toBe(11);
    expect(screen.getByTestId('rest-remaining')).toBeTruthy();
    fireEvent.press(screen.getByTestId('hold-toggle'));
    act(() => void jest.advanceTimersByTime(3_000));
    expect(screen.getByTestId('stop-hold')).toBeTruthy();
    expect(screen.queryByTestId('rest-remaining')).toBeNull();
  });

  test('the one-page view keeps a hold running when its sheet closes, and a logged hold can be cleared', async () => {
    jest.useFakeTimers();
    get().setSettings({ minimalist: true });
    await renderRouter(allRoutes(), { initialUrl: `/session/0?program=${programId()}` });
    expect(await screen.findByText(/or a hold to time it/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('set-pill-CAL_SUPPORT_HOLD-1'));
    fireEvent.press(screen.getByTestId('hold-toggle'));
    act(() => void jest.advanceTimersByTime(5_000));
    fireEvent.press(screen.getAllByLabelText('Close', { includeHiddenElements: true }).at(-1)!);
    act(() => void jest.advanceTimersByTime(4_000));
    fireEvent.press(screen.getByTestId('reopen-hold'));
    fireEvent.press(screen.getByTestId('log-hold'));
    expect(get().draft?.results.CAL_SUPPORT_HOLD.sets[0].reps).toBe(9);
    fireEvent.press(screen.getByTestId('set-pill-CAL_SUPPORT_HOLD-1'));
    fireEvent.press(screen.getByTestId('clear-hold'));
    expect(get().draft?.results.CAL_SUPPORT_HOLD.sets[0].reps).toBe(0);
  });
});
