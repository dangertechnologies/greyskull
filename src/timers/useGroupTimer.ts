import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { haptics } from '../design/haptics';
import type { Group } from '../domain';
import { nameOf } from '../format';
import type { SessionApi, SessionItem } from '../hooks/useSession';
import { ensureRestAlertPermission } from '../restAlert';
import { useStore } from '../store';
import { targetText, timerStepLabel } from '../views/groupText';
import {
  buzzes,
  end,
  isPaused,
  pause,
  planOf,
  positionAt,
  resume,
  skip,
  start,
  type TimerAnchor,
  type TimerPosition,
} from './clock';
import { anchorOf, type TimerBlock, useTimers } from './store';

export const KEEP_AWAKE_TAG = 'workout-timer';

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
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  skip(): void;
  end(): void;
}

/**
 * An EMOM or interval timer for one group of the open workout, as the timer screen sees it. Its position comes
 * from anchors persisted outside the workout log (see ./store), so leaving the screen, a suspended app or a
 * relaunch lands on the same minute. While the screen is open it buzzes and announces every boundary and keeps
 * the screen awake (not while paused). Alerts and the Live Activity belong to the app-level owner (./owner).
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
    (next: (a: TimerAnchor | undefined, at: number) => TimerAnchor | undefined, block?: TimerBlock) => {
      const at = Date.now();
      setNow(at);
      const current = anchorOf(useTimers.getState(), n, groupId);
      const changed = next(current, at);
      if (changed && changed !== current) setAnchor(n, groupId, changed, block);
    },
    [n, groupId, setAnchor],
  );

  // Reaching the end by time is stored, so the workout moves on (and stays moved on after a relaunch).
  const done = position?.done === true;
  useEffect(() => {
    if (done) update((a, at) => (a ? end(a, at) : a));
  }, [done, update]);

  const name = (item: SessionItem | undefined) => (item ? nameOf(exercises, item.exerciseId) : '');
  // One buzz and one spoken line per boundary crossed while the screen is open; a relaunch stays quiet.
  const last = useRef<TimerPosition | null>(null);
  useEffect(() => {
    if (position && buzzes(last.current, position)) {
      haptics.success();
      const item = steps[position.step]?.item;
      const said = position.done
        ? 'Timer done'
        : position.phase === 'rest'
          ? `Rest, ${position.remainingS} seconds`
          : item?.group
            ? `${timerStepLabel(item.group)}, ${name(item)}, ${targetText(item)}`
            : '';
      if (said) AccessibilityInfo.announceForAccessibility(said);
    }
    last.current = position;
  });

  // The screen stays awake while a timer screen is open and its timer runs (or has not started yet).
  const awake = !anchor || running;
  useEffect(() => {
    if (!awake) return undefined;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
  }, [awake]);

  if (!group) return null;
  const block: TimerBlock = {
    kind: group.kind === 'emom' ? 'emom' : 'interval',
    plan,
    steps: steps.map(({ item }) => ({
      label: item.group ? timerStepLabel(item.group) : '',
      name: name(item),
      target: targetText(item),
    })),
  };
  return {
    group,
    steps,
    anchor,
    position,
    paused: !!anchor && isPaused(anchor),
    deniedNotice,
    // Ask for notifications first, so the clock does not start behind the system dialog.
    start: async () => {
      const granted = await ensureRestAlertPermission();
      if (!granted && !useTimers.getState().toldDenied) {
        setDeniedNotice(true);
        useTimers.getState().setToldDenied();
      }
      update((a, at) => a ?? start(at), block);
    },
    pause: () => update((a, at) => (a ? pause(a, at) : a)),
    resume: () => update((a, at) => (a ? resume(a, at) : a)),
    skip: () => update((a, at) => (a ? skip(plan, a, at) : a)),
    end: () => update((a, at) => end(a ?? start(at), at), block),
  };
}
