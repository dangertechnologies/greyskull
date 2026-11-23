import { act } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { programId, setProgram } from '../__fixtures__/oneProgram';
import type { Group, Program, Slot } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';
import { useTimers } from '../timers/store';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));

const get = () => useStore.getState();
const day = (slots: Slot[], groups: Group[]): Program => ({
  template: 'custom',
  sessionsPerWeek: 3,
  rules: { doubleAt: 10, deloadPct: 0.1, failsBeforeDeload: 1, warmups: false },
  days: [{ name: 'A', slots, groups }],
});
const tick = (ms: number) => act(() => void jest.advanceTimersByTime(ms));

beforeEach(() => {
  jest.useFakeTimers();
  useStore.setState({ ...initialState(), hydrated: true, restSeconds: 90 });
  useTimers.setState({ n: null, anchors: {}, toldDenied: false });
});
afterEach(() => jest.useRealTimers());

test('a superset shows A1 and A2 together, rests only after the pair, for the group rest', async () => {
  setProgram(
    day(
      [
        { exercise: 'CAL_SCAPULAR_PULL', scheme: '2x5', group: 's' },
        { exercise: 'CAL_ASSISTED_SQUAT', scheme: '2x10', group: 's' },
      ],
      [{ id: 's', kind: 'superset', restS: 45 }],
    ),
  );
  await renderRouter(routes(), { initialUrl: `/session/0?program=${programId()}` });
  expect(await screen.findByText('Superset · Round 1 of 2')).toBeTruthy();
  expect(screen.getByTestId('round-card')).toBeTruthy();
  expect(screen.getByText('No rest: A2 Assisted squat next')).toBeTruthy();
  fireEvent.press(screen.getByText('Done A1'));
  expect(screen.queryByTestId('rest-skip')).toBeNull();
  expect(screen.getByText('After this: rest 45 s, then round 2')).toBeTruthy();
  fireEvent.press(screen.getByText('Done A2 · start rest'));
  expect(screen.getByTestId('rest-skip')).toBeTruthy();
  expect(screen.getByText('0:45')).toBeTruthy();
  // After the rest comes A1 of round 2, the set on screen.
  expect(screen.getByText(/Scapular pull · Superset · Round 2 of 2/)).toBeTruthy();
  expect(get().draft?.results.CAL_ASSISTED_SQUAT.sets[0].reps).toBe(10);
  fireEvent.press(screen.getByTestId('rest-skip'));
  expect(screen.getByText('Superset · Round 2 of 2')).toBeTruthy();
});

test('the one-page view labels grouped exercises and follows the same order', async () => {
  setProgram(
    day(
      [
        { exercise: 'CAL_SCAPULAR_PULL', scheme: '2x5', group: 's' },
        { exercise: 'CAL_ASSISTED_SQUAT', scheme: '2x10', group: 's' },
      ],
      [{ id: 's', kind: 'superset', restS: 45 }],
    ),
  );
  useStore.setState({ minimalist: true });
  await renderRouter(routes(), { initialUrl: `/session/0?program=${programId()}` });
  expect(await screen.findByText('Superset A · rest 45 s after each round')).toBeTruthy();
  expect(screen.getByText('A1 · Scapular pull')).toBeTruthy();
  expect(screen.getByText('A2 · Assisted squat')).toBeTruthy();
  fireEvent.press(screen.getByTestId('set-pill-CAL_SCAPULAR_PULL-1'));
  expect(screen.queryByTestId('rest-skip')).toBeNull();
  fireEvent.press(screen.getByTestId('set-pill-CAL_ASSISTED_SQUAT-1'));
  expect(screen.getByTestId('rest-skip')).toBeTruthy();
});

const emom = () =>
  setProgram(
    day(
      [
        { exercise: 'CAL_PUSHUP_WALL', scheme: '2x8', group: 'e' },
        { exercise: 'CAL_RDL_BODYWEIGHT', scheme: '2x10', group: 'e' },
        { exercise: 'CAL_SCAPULAR_PULL', scheme: '1x5' },
      ],
      [{ id: 'e', kind: 'emom', minutes: 4 }],
    ),
  );

test('EMOM: start, minute by minute from timestamps, log, pause, skip, relaunch, end early', async () => {
  emom();
  const first = await renderRouter(routes(), { initialUrl: `/session/0?program=${programId()}` });
  expect(await screen.findByText('Every minute for 4 minutes')).toBeTruthy();
  fireEvent.press(screen.getByTestId('timer-start'));
  expect(screen.getByTestId('timer-step').props.children).toBe('Minute 1 of 4');
  expect(screen.getByTestId('timer-remaining').props.children).toBe('1:00');
  expect(screen.getByText('Log 8 reps')).toBeTruthy();
  fireEvent.press(screen.getByTestId('timer-log'));
  expect(get().draft?.results.CAL_PUSHUP_WALL.sets[0].reps).toBe(8);

  tick(61_000);
  expect(screen.getByTestId('timer-step').props.children).toBe('Minute 2 of 4');
  expect(screen.getByText('Log 10 reps')).toBeTruthy();

  fireEvent.press(screen.getByTestId('timer-pause'));
  tick(120_000);
  expect(screen.getByTestId('timer-step').props.children).toBe('Minute 2 of 4');
  expect(screen.getByText('Paused')).toBeTruthy();
  fireEvent.press(screen.getByText('Resume'));
  fireEvent.press(screen.getByTestId('timer-skip'));
  expect(screen.getByTestId('timer-step').props.children).toBe('Minute 3 of 4');

  // A relaunch lands on the same minute: nothing counted ticks.
  first.unmount();
  tick(30_000);
  await renderRouter(routes(), { initialUrl: '/session/0' });
  expect((await screen.findByTestId('timer-step')).props.children).toBe('Minute 3 of 4');
  expect(screen.getByTestId('timer-remaining').props.children).toBe('0:30');

  fireEvent.press(screen.getByTestId('timer-end'));
  // The block is behind us; the next exercise is up and the missed minutes stay at 0 reps.
  expect(await screen.findByText('Scapular pull')).toBeTruthy();
  expect(get().draft?.results.CAL_RDL_BODYWEIGHT.sets.map((s) => s.reps)).toEqual([0, 0]);
});

test('an interval runs work then rest per round and moves on by itself at the end', async () => {
  setProgram(
    day(
      [{ exercise: 'CAL_ASSISTED_SQUAT', scheme: '3x10', group: 'i' }],
      [{ id: 'i', kind: 'interval', rounds: 3, workS: 20, restS: 10 }],
    ),
  );
  await renderRouter(routes(), { initialUrl: `/session/0?program=${programId()}` });
  fireEvent.press(await screen.findByTestId('timer-start'));
  expect(screen.getByText('Work')).toBeTruthy();
  expect(screen.getByText('Rest 10 s')).toBeTruthy();
  tick(21_000);
  expect(screen.getByText('rest left')).toBeTruthy();
  expect(screen.getByTestId('timer-step').props.children).toBe('Round 1 of 3');
  tick(70_000);
  expect(await screen.findByTestId('finish-workout')).toBeTruthy();
  expect(useTimers.getState().anchors.i.endedAt).toBeDefined();
});

test('a block can be skipped before it starts', async () => {
  emom();
  await renderRouter(routes(), { initialUrl: `/session/0?program=${programId()}` });
  fireEvent.press(await screen.findByTestId('timer-skip-block'));
  expect(await screen.findByText('Scapular pull')).toBeTruthy();
});
