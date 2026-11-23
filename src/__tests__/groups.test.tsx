import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from '@testing-library/react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert, type AlertButton } from 'react-native';
import { lifts, programId, setProgram } from '../__fixtures__/oneProgram';
import type { Group, Program, Slot } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';
import { useTimers } from '../timers/store';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));

const mockPermission = { granted: true, canAskAgain: true };
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => mockPermission),
  requestPermissionsAsync: jest.fn(async () => mockPermission),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

const get = () => useStore.getState();
/** Press a button that asks first, and confirm. */
const pressConfirmed = (testID: string) => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementationOnce((_t, _m, buttons?: AlertButton[]) => {
    buttons?.find((b) => b.style === 'destructive')?.onPress?.();
  });
  fireEvent.press(screen.getByTestId(testID));
  expect(alert).toHaveBeenCalled();
};
const startTimer = async () => {
  const button = await screen.findByTestId('timer-start');
  await act(async () => {
    fireEvent.press(button);
  });
};
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
  useTimers.setState({ n: null, anchors: {}, blocks: {}, toldDenied: false });
  Object.assign(mockPermission, { granted: true, canAskAgain: true });
  jest.mocked(activateKeepAwakeAsync).mockClear();
  jest.mocked(deactivateKeepAwake).mockClear();
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

test('logging A2 before A1 starts the group rest only once the round is complete', async () => {
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
  fireEvent.press(await screen.findByLabelText(/^A2 Assisted squat, set 1/));
  fireEvent.press(screen.getByText('Done A2 · start rest'));
  expect(screen.queryByTestId('rest-skip')).toBeNull();
  fireEvent.press(screen.getByText('Done A1'));
  expect(screen.getByTestId('rest-skip')).toBeTruthy();
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
  await startTimer();
  expect(screen.getByTestId('timer-step').props.children).toBe('Minute 1 of 4');
  expect(screen.getByTestId('timer-remaining').props.children).toBe('1:00');
  expect(screen.getByText('Log 8 reps')).toBeTruthy();
  expect(activateKeepAwakeAsync).toHaveBeenCalledWith('workout-timer');
  fireEvent.press(screen.getByTestId('timer-log'));
  expect(get().draft?.results.CAL_PUSHUP_WALL.sets[0].reps).toBe(8);
  expect(screen.getByText('Logged 8 reps')).toBeTruthy();

  tick(61_000);
  expect(screen.getByTestId('timer-step').props.children).toBe('Minute 2 of 4');
  expect(screen.getByText('Log 10 reps')).toBeTruthy();

  // Paused: the clock stops and the screen may sleep.
  fireEvent.press(screen.getByTestId('timer-pause'));
  expect(deactivateKeepAwake).toHaveBeenCalledWith('workout-timer');
  tick(120_000);
  expect(screen.getByTestId('timer-step').props.children).toBe('Minute 2 of 4');
  expect(screen.getByText('Paused')).toBeTruthy();
  fireEvent.press(screen.getByText('Resume'));
  fireEvent.press(screen.getByTestId('timer-skip'));
  expect(screen.getByTestId('timer-step').props.children).toBe('Minute 3 of 4');

  // A relaunch: the timers are read back from storage, and the minute comes from the stored timestamps.
  first.unmount();
  tick(30_000);
  const saved = (await AsyncStorage.getItem('greyskull-timers')) ?? '';
  expect(saved).toContain('"startedAt"');
  useTimers.setState({ n: null, anchors: {}, blocks: {} });
  await AsyncStorage.setItem('greyskull-timers', saved);
  await act(async () => {
    await useTimers.persist.rehydrate();
  });
  await renderRouter(routes(), { initialUrl: '/session/0' });
  expect((await screen.findByTestId('timer-step')).props.children).toBe('Minute 3 of 4');
  expect(screen.getByTestId('timer-remaining').props.children).toBe('0:30');

  jest.mocked(deactivateKeepAwake).mockClear();
  pressConfirmed('timer-end');
  // The block is behind us; the next exercise is up and the missed minutes stay at 0 reps.
  expect(await screen.findByText('Scapular pull')).toBeTruthy();
  expect(get().draft?.results.CAL_RDL_BODYWEIGHT.sets.map((s) => s.reps)).toEqual([0, 0]);
  expect(deactivateKeepAwake).toHaveBeenCalledWith('workout-timer');
});

test('a corrupt stored timer is no timer: the workout still opens', async () => {
  emom();
  await AsyncStorage.setItem('greyskull-timers', '{"state":{"n":0,"anchors":{"e":{"startedAt":"x"}}');
  await act(async () => {
    await useTimers.persist.rehydrate();
  });
  expect(useTimers.persist.hasHydrated()).toBe(true);
  await AsyncStorage.setItem(
    'greyskull-timers',
    JSON.stringify({
      state: { n: 0, anchors: { e: { startedAt: 'x', pauses: 3 } }, blocks: {} },
      version: 1,
    }),
  );
  await act(async () => {
    await useTimers.persist.rehydrate();
  });
  expect(useTimers.getState().anchors).toEqual({});
  await renderRouter(routes(), { initialUrl: `/session/0?program=${programId()}` });
  expect(await screen.findByTestId('timer-start')).toBeTruthy();
});

test('an interval counts rounds, runs work then rest, and moves on by itself at the end', async () => {
  setProgram(
    day(
      [
        { exercise: 'CAL_ASSISTED_SQUAT', scheme: '2x10', group: 'i' },
        { exercise: 'CAL_PUSHUP_WALL', scheme: '2x8', group: 'i' },
      ],
      [{ id: 'i', kind: 'interval', rounds: 2, workS: 20, restS: 10 }],
    ),
  );
  await renderRouter(routes(), { initialUrl: `/session/0?program=${programId()}` });
  expect(await screen.findByText('2 rounds')).toBeTruthy();
  await startTimer();
  expect(screen.getByText('Work')).toBeTruthy();
  expect(screen.getByText('Rest 10 s')).toBeTruthy();
  tick(21_000);
  expect(screen.getByText('rest left')).toBeTruthy();
  expect(screen.getByTestId('timer-step').props.children).toBe('Round 1 of 2');
  tick(10_000);
  // The second exercise of round 1, not "round 2".
  expect(screen.getByTestId('timer-step').props.children).toBe('Round 1 of 2');
  expect(screen.getByText('Wall push-up')).toBeTruthy();
  tick(90_000);
  expect(await screen.findByTestId('finish-workout')).toBeTruthy();
  expect(useTimers.getState().anchors.i.endedAt).toBeDefined();
});

test('skipping a block marks its exercises skipped, so they keep their progression', async () => {
  emom();
  const before = JSON.stringify(lifts());
  await renderRouter(routes(), { initialUrl: `/session/0?program=${programId()}` });
  await screen.findByTestId('timer-skip-block');
  pressConfirmed('timer-skip-block');
  expect(await screen.findByText('Scapular pull')).toBeTruthy();
  expect(get().draft?.skippedExercises).toEqual(['CAL_PUSHUP_WALL', 'CAL_RDL_BODYWEIGHT']);
  fireEvent.press(screen.getByTestId('done-set'));
  fireEvent.press(await screen.findByTestId('finish-workout'));
  const kept = JSON.parse(before) as Record<string, unknown>;
  for (const key of Object.keys(kept).filter((k) => k !== 'CAL_SCAPULAR_PULL'))
    expect(lifts()[key]).toEqual(kept[key]);
});

test('a block can wait: Do it later shows the rest of the workout first', async () => {
  emom();
  await renderRouter(routes(), { initialUrl: `/session/0?program=${programId()}` });
  fireEvent.press(await screen.findByTestId('timer-later'));
  expect(await screen.findByText('Scapular pull')).toBeTruthy();
  // No rest is started before a timer block.
  fireEvent.press(screen.getByTestId('done-set'));
  expect(screen.queryByTestId('rest-skip')).toBeNull();
  expect(await screen.findByTestId('timer-start')).toBeTruthy();
});

test('notifications off: said once, on the first timer only', async () => {
  Object.assign(mockPermission, { granted: false, canAskAgain: false });
  setProgram(
    day(
      [
        { exercise: 'CAL_PUSHUP_WALL', scheme: '1x8', group: 'a' },
        { exercise: 'CAL_RDL_BODYWEIGHT', scheme: '1x10', group: 'b' },
      ],
      [
        { id: 'a', kind: 'emom', minutes: 1 },
        { id: 'b', kind: 'emom', minutes: 1 },
      ],
    ),
  );
  await renderRouter(routes(), { initialUrl: `/session/0?program=${programId()}` });
  await startTimer();
  expect(screen.getByText(/Notifications are off/)).toBeTruthy();
  tick(61_000);
  await startTimer();
  expect(screen.getByText('Bodyweight Romanian deadlift')).toBeTruthy();
  expect(screen.queryByText(/Notifications are off/)).toBeNull();
});
