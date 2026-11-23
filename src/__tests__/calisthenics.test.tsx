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

  test('an unknown ladder or program shows a not-found state', async () => {
    await renderRouter(allRoutes(), { initialUrl: '/ladder/nope' });
    expect(await screen.findByText('Ladder not found')).toBeTruthy();
    act(() => require('expo-router').router.replace('/ladder/rr_pullup?program=gone'));
    expect(await screen.findByText('Program not found')).toBeTruthy();
  });
});
