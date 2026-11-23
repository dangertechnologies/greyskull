import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { haptics } from '../design/haptics';
import type { Group } from '../domain';
import { nameOf } from '../format';
import type { SessionApi, SessionItem } from '../hooks/useSession';
import { cancelTimerAlerts, ensureRestAlertPermission, scheduleTimerAlerts } from '../restAlert';
import { useStore } from '../store';
import { endRestActivity, showTimerActivity } from '../widgets';
import {
  boundaries,
  buzzes,
  end,
  isPaused,
  nextBoundaryAt,
  pause,
  planOf,
  positionAt,
  resume,
  skip,
  start,
  type TimerAnchor,
  type TimerPosition,
} from './clock';
import { anchorOf, useTimers } from './store';

const KEEP_AWAKE_TAG = 'workout-timer';

export interface GroupTimer {
  group: Group;
  /** The group's sets in timer order, with their index in `session.items`. */
  steps: { item: SessionItem; index: number }[];
  anchor: TimerAnchor | undefined;
  /** Null before the timer starts. */
  position: TimerPosition | null;
  paused: boolean;
  /** Notifications are off: said once, the first time a timer starts. */
  deniedNotice: boolean;
  start(): void;
  pause(): void;
  resume(): void;
  skip(): void;
  end(): void;
}

/** "Minute 4 of 10", "Round 3 of 8". */
export const stepLabel = (group: Group, step: number, steps: number): string =>
  `${group.kind === 'emom' ? 'Minute' : 'Round'} ${step + 1} of ${steps}`;

/**
 * An EMOM or interval timer for one group of the open workout. Its position comes from anchors persisted
 * outside the workout log (see ./store), so leaving the screen, a suspended app or a relaunch lands on the
 * same minute. While the screen is open: buzzes at every boundary, keeps the screen awake, and shows the
 * countdown in the Live Activity. In the background, local notifications mark the boundaries.
 */
export function useGroupTimer(session: SessionApi, groupId: string): GroupTimer | null {
  const n = session.draft.n;
  const group = session.groups.find((g) => g.id === groupId);
  const steps = session.items.flatMap((item, index) => (item.group?.id === groupId ? [{ item, index }] : []));
  const plan = useMemo(
    () => planOf(group ?? { id: groupId, kind: 'emom' }, steps.length),
    [group, groupId, steps.length],
  );
  const anchor = useTimers((s) => anchorOf(s, n, groupId));
  const setAnchor = useTimers((s) => s.setAnchor);
  const toldDenied = useTimers((s) => s.toldDenied);
  const exercises = useStore((s) => s.exercises);
  const [deniedNotice, setDeniedNotice] = useState(false);

  const [now, setNow] = useState(() => Date.now());
  const running = !!anchor && !isPaused(anchor) && anchor.endedAt === undefined;
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);
  const position = anchor ? positionAt(plan, anchor, now) : null;

  const update = useCallback(
    (next: (a: TimerAnchor | undefined, at: number) => TimerAnchor | undefined) => {
      const at = Date.now();
      setNow(at);
      const current = anchorOf(useTimers.getState(), n, groupId);
      const changed = next(current, at);
      if (changed && changed !== current) setAnchor(n, groupId, changed);
    },
    [n, groupId, setAnchor],
  );

  // Reaching the end by time is stored, so the workout moves on (and stays moved on after a relaunch).
  const done = position?.done === true;
  useEffect(() => {
    if (done) update((a, at) => (a ? end(a, at) : a));
  }, [done, update]);

  // One buzz per boundary crossed while the screen is open; the first look after a relaunch stays quiet.
  const last = useRef<TimerPosition | null>(null);
  useEffect(() => {
    if (position && buzzes(last.current, position)) haptics.success();
    last.current = position;
  });

  // The screen stays awake while a timer screen is open and its timer has not ended.
  const ended = anchor?.endedAt !== undefined;
  useEffect(() => {
    if (ended) return undefined;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
  }, [ended]);

  const name = (item: SessionItem | undefined) => (item ? nameOf(exercises, item.exerciseId) : '');
  const step = position?.step ?? 0;
  const current = steps[step]?.item;
  const nextItem = steps[step + 1]?.item;
  const kicker = group ? stepLabel(group, step, steps.length).toUpperCase() : '';
  const resting = position?.phase === 'rest';
  const label = resting
    ? `Rest, then ${nextItem ? name(nextItem) : 'done'}`
    : nextItem
      ? `Next: ${name(nextItem)}`
      : 'Last one';

  // Live Activity: the countdown to the next boundary, refreshed at each boundary and on pause or resume.
  const activityKey =
    anchor && !ended ? `${step}:${position?.phase}:${isPaused(anchor)}:${anchor.skipMs}` : null;
  const activityRef = useRef({ kicker, title: resting ? 'Rest' : name(current), label });
  activityRef.current = { kicker, title: resting ? 'Rest' : name(current), label };
  useEffect(() => {
    const a = anchorOf(useTimers.getState(), n, groupId);
    if (activityKey === null || !a) {
      endRestActivity();
      return;
    }
    const at = Date.now();
    showTimerActivity({
      ...activityRef.current,
      startsAt: at,
      endsAt: nextBoundaryAt(plan, a, at),
      ...(isPaused(a) ? { pausedAt: at } : {}),
    });
  }, [activityKey, n, groupId, plan]);
  useEffect(() => endRestActivity, []);

  // Notifications at the boundaries only while the app is in the background; back in front they are cancelled.
  const alertText = useRef<(b: ReturnType<typeof boundaries>[number]) => { title: string; body: string }>(
    () => ({ title: '', body: '' }),
  );
  alertText.current = (b) => {
    if (!group) return { title: '', body: '' };
    if (b.phase === 'done') return { title: 'Timer done', body: 'On to the rest of your workout.' };
    if (b.phase === 'rest') return { title: 'Rest', body: `${plan.restS} s` };
    const item = steps[b.step]?.item;
    return {
      title: stepLabel(group, b.step, steps.length),
      body: item
        ? `${name(item)} · ${item.timed ? `${item.targetReps} s` : `${item.targetReps ?? 'max'} reps`}`
        : '',
    };
  };
  useEffect(() => {
    void cancelTimerAlerts(); // stale ones from before a relaunch
    const sub = AppState.addEventListener('change', (status) => {
      const a = anchorOf(useTimers.getState(), n, groupId);
      if (status === 'background' && a) {
        const list = boundaries(plan, a, Date.now()).map((b) => ({ inS: b.inS, ...alertText.current(b) }));
        if (list.length > 0) void scheduleTimerAlerts(list);
      } else if (status === 'active') void cancelTimerAlerts();
    });
    return () => sub.remove();
  }, [n, groupId, plan]);

  if (!group) return null;
  return {
    group,
    steps,
    anchor,
    position,
    paused: !!anchor && isPaused(anchor),
    deniedNotice,
    start: () => {
      update((a, at) => a ?? start(at));
      void ensureRestAlertPermission().then((granted) => {
        if (granted || toldDenied) return;
        setDeniedNotice(true);
        useTimers.getState().setToldDenied();
      });
    },
    pause: () => update((a, at) => (a ? pause(a, at) : a)),
    resume: () => update((a, at) => (a ? resume(a, at) : a)),
    skip: () => update((a, at) => (a ? skip(plan, a, at) : a)),
    end: () => {
      void cancelTimerAlerts();
      update((a, at) => end(a ?? start(at), at));
    },
  };
}
