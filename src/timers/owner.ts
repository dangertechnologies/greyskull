import { AppState } from 'react-native';
import type { SessionLog } from '../domain';
import { cancelTimerAlerts, installTimerSound, scheduleTimerAlerts } from '../restAlert';
import type { TimerProps } from '../widgets/definitions';
import {
  type Boundary,
  boundaries,
  elapsedMs,
  end,
  isPaused,
  nextBoundaryAt,
  positionAt,
  type TimerAnchor,
  totalS,
} from './clock';
import { type TimerBlock, useTimers } from './store';

/** How long a paused timer's Live Activity stays true without an update. */
const PAUSED_STALE_MS = 8 * 60 * 60 * 1000;

export interface TimerActivity {
  show(props: TimerProps, staleAt: number): void;
  end(): void;
}

/** The words of a boundary alert. */
export function alertFor(block: TimerBlock, b: Boundary): { title: string; body: string } {
  if (b.phase === 'done') return { title: 'Timer done', body: 'On to the rest of your workout.' };
  if (b.phase === 'rest') {
    const next = block.steps[b.step + 1];
    return { title: 'Rest', body: `${block.plan.restS} s${next ? `, then ${next.name}` : ''}` };
  }
  const step = block.steps[b.step];
  return { title: step?.label ?? '', body: step ? `${step.name} · ${step.target}` : '' };
}

/**
 * What the Live Activity shows. While the app is open: the current step and a countdown to the next boundary
 * (refreshed at each boundary). In the background, where the app cannot update it: the whole block with a
 * countdown to its end, which stays true; the boundaries come as notifications. Paused: frozen at the time left.
 */
export function activityFor(
  block: TimerBlock,
  a: TimerAnchor,
  at: number,
  foreground: boolean,
): { props: TimerProps; staleAt: number } {
  const pos = positionAt(block.plan, a, at);
  const step = block.steps[pos.step];
  const next = block.steps[pos.step + 1];
  const resting = pos.phase === 'rest';
  const kicker = `${step?.label ?? ''}${resting ? ' · rest' : ''}`.toUpperCase();
  const label = next ? `Next: ${next.name} · ${next.target}` : 'Last one';
  const title = resting ? 'Rest' : (step?.name ?? '');
  if (isPaused(a)) {
    const left = Math.max(0, nextBoundaryAt(block.plan, a, at) - (a.pauses.at(-1)?.from ?? at));
    return {
      props: { kicker, title, label, startsAt: at, endsAt: at + left, pausedAt: at },
      staleAt: at + PAUSED_STALE_MS,
    };
  }
  if (!foreground) {
    const endsAt = at + Math.max(0, totalS(block.plan) * 1000 - elapsedMs(a, at));
    const what = block.kind === 'emom' ? 'minute' : 'round';
    return {
      props: {
        kicker:
          block.kind === 'emom' ? `EMOM · ${block.plan.steps} MIN` : `INTERVALS · ${block.steps.length} SETS`,
        title: block.kind === 'emom' ? 'EMOM' : 'Intervals',
        label: `Each ${what} comes as a notification`,
        startsAt: at,
        endsAt,
      },
      staleAt: endsAt,
    };
  }
  const endsAt = Math.max(at, nextBoundaryAt(block.plan, a, at));
  return { props: { kicker, title, label, startsAt: at, endsAt }, staleAt: endsAt };
}

/**
 * The one owner of an EMOM or interval block's side effects, for the whole app rather than the timer screen:
 * boundary alerts (scheduled while the block runs, cancelled on pause, end, finish or discard) and the Live
 * Activity, all derived from the persisted anchors. Forgets the timers once their workout is gone. Returns the
 * unsubscribe.
 */
export function watchTimers(
  store: {
    getState(): { draft: SessionLog | null; hydrated: boolean };
    subscribe(l: () => void): () => void;
  },
  activity: TimerActivity,
  now: () => number = Date.now,
): () => void {
  let appState: string | null | undefined = AppState.currentState;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let scheduledFor = '?'; // unknown: alerts left from before a relaunch are cancelled on the first look
  let shown = '';
  void installTimerSound();

  const stop = () => {
    if (scheduledFor !== '') void cancelTimerAlerts();
    if (shown !== '') activity.end();
    scheduledFor = '';
    shown = '';
  };

  const sync = () => {
    if (timeout) clearTimeout(timeout);
    timeout = null;
    const main = store.getState();
    const t = useTimers.getState();
    if (!main.hydrated || !useTimers.persist.hasHydrated()) return;
    if (t.n !== null && main.draft?.n !== t.n) {
      stop();
      t.clear(); // the workout was finished or discarded
      return;
    }
    const live = Object.entries(t.anchors).find(([id, a]) => a.endedAt === undefined && t.blocks[id]);
    if (!live || t.n === null) return stop();
    const [id, anchor] = live;
    const block = t.blocks[id];
    const at = now();
    if (positionAt(block.plan, anchor, at).done) {
      stop();
      t.setAnchor(t.n, id, end(anchor, at)); // ran out while no screen was looking
      return;
    }

    const alertsKey = `${id}:${JSON.stringify(anchor)}`;
    if (alertsKey !== scheduledFor) {
      scheduledFor = alertsKey;
      if (isPaused(anchor)) void cancelTimerAlerts();
      else
        void scheduleTimerAlerts(
          boundaries(block.plan, anchor, at).map((b) => ({ inS: b.inS, ...alertFor(block, b) })),
        );
    }

    const foreground = appState === 'active';
    const pos = positionAt(block.plan, anchor, at);
    const viewKey = `${alertsKey}:${foreground}:${foreground ? `${pos.step}:${pos.phase}` : ''}`;
    if (viewKey !== shown) {
      shown = viewKey;
      const { props, staleAt } = activityFor(block, anchor, at, foreground);
      activity.show(props, staleAt);
    }
    // While open, move the Live Activity on at the next boundary.
    if (foreground && !isPaused(anchor))
      timeout = setTimeout(sync, Math.max(50, nextBoundaryAt(block.plan, anchor, at) - at + 50));
  };

  const unTimers = useTimers.subscribe(sync);
  const unHydrate = useTimers.persist.onFinishHydration(sync);
  const unStore = store.subscribe(sync);
  const sub = AppState.addEventListener('change', (status) => {
    appState = status;
    sync();
  });
  sync();
  return () => {
    if (timeout) clearTimeout(timeout);
    unTimers();
    unHydrate();
    unStore();
    sub.remove();
  };
}
