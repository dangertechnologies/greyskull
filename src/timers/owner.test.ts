import { AppState } from 'react-native';
import type { SessionLog } from '../domain';
import { pause, start } from './clock';
import { activityFor, watchTimers } from './owner';
import { type TimerBlock, useTimers } from './store';

const mockScheduled = new Map<string, { title: string; seconds: number }>();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(
    async (r: { identifier: string; content: { title: string }; trigger: { seconds: number } }) => {
      mockScheduled.set(r.identifier, { title: r.content.title, seconds: r.trigger.seconds });
      return r.identifier;
    },
  ),
  getAllScheduledNotificationsAsync: jest.fn(async () =>
    [...mockScheduled.keys()].map((identifier) => ({ identifier })),
  ),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => void mockScheduled.delete(id)),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

const block: TimerBlock = {
  kind: 'emom',
  plan: { steps: 2, workS: 60, restS: 0 },
  steps: [
    { label: 'Minute 1 of 2', name: 'Swing', target: '15 reps' },
    { label: 'Minute 2 of 2', name: 'Push-up', target: '12 reps' },
  ],
};
const draft = { n: 7 } as SessionLog;

let appListener: (s: string) => void = () => undefined;
let state: { draft: SessionLog | null; hydrated: boolean };
let listeners: (() => void)[];
const store = {
  getState: () => state,
  subscribe: (l: () => void) => {
    listeners.push(l);
    return () => undefined;
  },
};
const setDraft = (d: SessionLog | null) => {
  state = { ...state, draft: d };
  for (const l of listeners) l();
};
const flush = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const activity = { show: jest.fn(), end: jest.fn() };

beforeEach(() => {
  jest.useFakeTimers({ now: 1_000_000 });
  mockScheduled.clear();
  activity.show.mockClear();
  activity.end.mockClear();
  state = { draft, hydrated: true };
  listeners = [];
  useTimers.setState({ n: null, anchors: {}, blocks: {}, toldDenied: false });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, l) => {
    appListener = l as (s: string) => void;
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
});
afterEach(() => jest.useRealTimers());

test('a running block schedules its boundaries and shows the minute in the Live Activity', async () => {
  const stop = watchTimers(store, activity);
  useTimers.getState().setAnchor(7, 'e', start(Date.now()), block);
  await flush();
  expect([...mockScheduled.values()].map((a) => `${a.title}@${a.seconds}`)).toEqual([
    'Minute 2 of 2@60',
    'Timer done@120',
  ]);
  expect(activity.show).toHaveBeenLastCalledWith(
    expect.objectContaining({ kicker: 'MINUTE 1 OF 2', title: 'Swing', endsAt: Date.now() + 60_000 }),
    Date.now() + 60_000,
  );
  // At the boundary the Live Activity moves on by itself while the app is open.
  jest.advanceTimersByTime(60_100);
  expect(activity.show).toHaveBeenLastCalledWith(
    expect.objectContaining({ kicker: 'MINUTE 2 OF 2' }),
    expect.any(Number),
  );
  stop();
});

test('pause cancels the alerts and freezes the countdown at the time left, never an inverted range', async () => {
  watchTimers(store, activity);
  const a = start(Date.now());
  useTimers.getState().setAnchor(7, 'e', a, block);
  await flush();
  jest.setSystemTime(Date.now() + 20_000);
  useTimers.getState().setAnchor(7, 'e', pause(a, Date.now()));
  await flush();
  expect(mockScheduled.size).toBe(0);
  // Shown again ten minutes into the pause: still 40 s left.
  const later = Date.now() + 600_000;
  const { props } = activityFor(block, pause(a, Date.now()), later, true);
  expect(props.endsAt - props.startsAt).toBe(40_000);
  expect(props.pausedAt).toBe(later);
});

test('in the background the activity shows the whole block, which stays true without updates', async () => {
  watchTimers(store, activity);
  useTimers.getState().setAnchor(7, 'e', start(Date.now()), block);
  await flush();
  appListener('background');
  expect(activity.show).toHaveBeenLastCalledWith(
    expect.objectContaining({ kicker: 'EMOM · 2 MIN', endsAt: Date.now() + 120_000 }),
    Date.now() + 120_000,
  );
  appListener('active');
  expect(activity.show).toHaveBeenLastCalledWith(
    expect.objectContaining({ kicker: 'MINUTE 1 OF 2' }),
    expect.any(Number),
  );
});

test('a finished or discarded workout ends the activity, cancels the alerts and forgets the timers', async () => {
  watchTimers(store, activity);
  useTimers.getState().setAnchor(7, 'e', start(Date.now()), block);
  await flush();
  expect(mockScheduled.size).toBe(2);
  setDraft(null);
  await flush();
  expect(activity.end).toHaveBeenCalled();
  expect(mockScheduled.size).toBe(0);
  expect(useTimers.getState().anchors).toEqual({});
});

test('a block that ran out with no screen open is ended and its alerts cancelled', async () => {
  useTimers.setState({ n: 7, anchors: { e: start(Date.now() - 200_000) }, blocks: { e: block } });
  mockScheduled.set('workout-timer-3', { title: 'stale', seconds: 1 });
  watchTimers(store, activity);
  await flush();
  expect(useTimers.getState().anchors.e.endedAt).toBeDefined();
  expect(mockScheduled.size).toBe(0);
});
