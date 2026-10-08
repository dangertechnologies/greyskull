import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Outcome, SessionLog } from '../domain';
import { isPersonalRecord, sessionFor, warmups } from '../domain';
import { cancelRestAlert, ensureRestAlertPermission, scheduleRestAlert } from '../restAlert';
import { useStore } from '../store';
import { endRestActivity, startRestActivity } from '../widgets';

export interface SessionItem {
  exerciseId: string;
  kind: 'warmup' | 'work' | 'amrap';
  /** Index into the draft's sets for work items; null for warm-ups. */
  setIndex: number | null;
  /** 1-based position among the exercise's items of the same family, and how many there are. */
  position: number;
  total: number;
  targetReps: number | null;
  weightKg: number;
  logged: boolean;
  reps: number;
}

export interface FinishedExercise {
  exerciseId: string;
  fromKg: number;
  outcome: Outcome;
  /** A new best weight, or more last-set reps at the best weight. */
  pr: boolean;
}

export interface SessionApi {
  draft: SessionLog;
  items: SessionItem[];
  /** First item not yet logged; `items.length` when everything is done. */
  activeIndex: number;
  record(itemIndex: number, reps: number): void;
  setWeight(exerciseId: string, kg: number): void;
  /** The item the view shows: the one the user picked, else the first open one. */
  selectedIndex: number;
  /** Show another item (a logged set to edit, or the open one). */
  select(itemIndex: number): void;
  restRemaining: number | null;
  /** Length of the current rest in seconds, including ±30 s adjustments (for the progress bar). */
  restTotal: number;
  skipRest(): void;
  /** Make the current rest longer or shorter (never below 0). */
  addRest(seconds: number): void;
  isComplete: boolean;
  finish(): FinishedExercise[];
}

const cancelPending = async (pending: Promise<string | null>): Promise<void> => {
  const id = await pending;
  if (id) await cancelRestAlert(id);
};

/**
 * The engine behind every session view. State lives in the store's draft (persisted on every set), warm-ups
 * and the rest timer are local to the screen.
 */
export function useSession(n: number): SessionApi | null {
  const draft = useStore((s) => s.draft);
  const program = useStore((s) => s.program);
  const exercises = useStore((s) => s.exercises);
  const inventory = useStore((s) => s.inventory);
  const unit = useStore((s) => s.unit);
  const restSeconds = useStore((s) => s.restSeconds);
  const startSession = useStore((s) => s.startSession);
  const logSet = useStore((s) => s.logSet);
  const setDraftWeight = useStore((s) => s.setDraftWeight);
  const finishSession = useStore((s) => s.finishSession);

  // After finishing, the draft is gone on purpose: never start a new one for the same session.
  const [finished, setFinished] = useState(false);
  const ready = draft !== null && draft.n === n;
  useEffect(() => {
    if (!ready && !finished && program) startSession(n);
  }, [ready, finished, program, n, startSession]);

  const [picked, setPicked] = useState<number | null>(null);
  const [doneWarmups, setDoneWarmups] = useState<ReadonlySet<string>>(new Set());

  const items = useMemo<SessionItem[]>(() => {
    if (!ready || !program) return [];
    const schemes = new Map(sessionFor(program, n).slots.map((s) => [s.exercise, s.scheme]));
    const out: SessionItem[] = [];
    // Warm-ups are not persisted: they count as done once real work exists for the lift or any later lift.
    const laterLogged = new Set<string>();
    let seenLogged = false;
    for (const id of [...draft.order].reverse()) {
      if (seenLogged) laterLogged.add(id);
      if (draft.results[id]?.sets.some((x) => x.reps > 0)) seenLogged = true;
    }
    for (const id of draft.order) {
      const result = draft.results[id];
      const exercise = exercises[id];
      const scheme = schemes.get(id);
      if (!result || !exercise || !scheme) continue;
      const anyLogged = result.sets.some((s) => s.reps > 0);
      const warm = program.rules.warmups ? warmups(result.weightKg, scheme, exercise, inventory, unit) : [];
      warm.forEach((w, i) => {
        const logged = anyLogged || laterLogged.has(id) || doneWarmups.has(`${id}:${i}`);
        out.push({
          exerciseId: id,
          kind: 'warmup',
          setIndex: null,
          position: i + 1,
          total: warm.length,
          targetReps: w.reps,
          weightKg: w.kg,
          logged,
          reps: logged ? w.reps : 0,
        });
      });
      result.sets.forEach((set, i) => {
        out.push({
          exerciseId: id,
          kind: set.target === null ? 'amrap' : 'work',
          setIndex: i,
          position: i + 1,
          total: result.sets.length,
          targetReps: set.target,
          weightKg: result.weightKg,
          logged: set.reps > 0,
          reps: set.reps,
        });
      });
    }
    return out;
  }, [ready, draft, program, exercises, inventory, unit, doneWarmups, n]);

  const firstOpen = items.findIndex((i) => !i.logged);
  const activeIndex = firstOpen === -1 ? items.length : firstOpen;
  const isComplete = ready && items.length > 0 && items.every((i) => i.kind === 'warmup' || i.logged);

  // Rest timer: a single interval while resting, cleared on unmount or when rest ends.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(restSeconds);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (restEndsAt === null) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [restEndsAt]);
  useEffect(() => {
    if (restEndsAt !== null && now >= restEndsAt) {
      setRestEndsAt(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  }, [now, restEndsAt]);
  // While resting, a backgrounded app gets a local notification when the rest is over.
  useEffect(() => {
    if (restEndsAt === null) return undefined;
    let pending: Promise<string | null> | null = null;
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'background') {
        pending = scheduleRestAlert(Math.ceil((restEndsAt - Date.now()) / 1000));
      } else if (status === 'active' && pending) {
        void cancelPending(pending);
        pending = null;
      }
    });
    return () => {
      sub.remove();
      if (pending) void cancelPending(pending);
    };
  }, [restEndsAt]);
  // Lock Screen / Dynamic Island countdown (iOS builds with widgets only; a no-op everywhere else).
  const nextName = items[activeIndex] ? exercises[items[activeIndex].exerciseId]?.name : undefined;
  const restLabel = nextName ? `Next: ${nextName}` : 'Rest';
  const restLabelRef = useRef(restLabel);
  restLabelRef.current = restLabel;
  useEffect(() => {
    if (restEndsAt === null) endRestActivity();
    else startRestActivity(restLabelRef.current, Math.ceil((restEndsAt - Date.now()) / 1000));
  }, [restEndsAt]);
  useEffect(() => endRestActivity, []);
  const restRemaining = restEndsAt === null ? null : Math.max(0, Math.ceil((restEndsAt - now) / 1000));

  const record = useCallback(
    (itemIndex: number, reps: number) => {
      const item = items[itemIndex];
      if (!item) return;
      const wasLogged = item.logged && item.kind !== 'warmup';
      setPicked(null); // after logging, the view follows the next open set again
      if (item.kind === 'warmup') {
        setDoneWarmups((prev) => new Set(prev).add(`${item.exerciseId}:${item.position - 1}`));
      } else if (item.setIndex !== null) {
        logSet(item.exerciseId, item.setIndex, Math.max(1, reps));
      }
      // Rest only after a *new* work set: warm-ups and edits of an already logged set do not start one.
      if (item.kind !== 'warmup' && !wasLogged && restSeconds > 0 && itemIndex < items.length - 1) {
        void ensureRestAlertPermission();
        const start = Date.now();
        setNow(start);
        setRestTotal(restSeconds);
        setRestEndsAt(start + restSeconds * 1000);
      }
    },
    [items, logSet, restSeconds],
  );

  const finish = useCallback((): FinishedExercise[] => {
    const before = useStore.getState().draft;
    if (!before) throw new Error('No session in progress');
    const history = useStore.getState().sessions;
    const outcomes = finishSession();
    setFinished(true);
    setRestEndsAt(null);
    return before.order
      .filter((id) => outcomes[id])
      .map((id) => {
        const result = before.results[id];
        return {
          exerciseId: id,
          fromKg: result.weightKg,
          outcome: outcomes[id],
          pr:
            (before.intensity ?? 1) >= 1 &&
            isPersonalRecord(history, id, result.weightKg, result.sets.at(-1)?.reps ?? 0),
        };
      });
  }, [finishSession]);

  const addRest = useCallback((seconds: number) => {
    setRestEndsAt((end) => {
      if (end === null) return end;
      const next = Math.max(Date.now(), end + seconds * 1000);
      return next;
    });
    setRestTotal((total) => Math.max(1, total + seconds));
  }, []);

  if (!ready || !draft) return null;
  const selectedIndex = picked !== null && picked < items.length ? picked : activeIndex;
  return {
    draft,
    items,
    activeIndex,
    record,
    setWeight: setDraftWeight,
    selectedIndex,
    select: setPicked,
    restRemaining,
    restTotal,
    skipRest: () => setRestEndsAt(null),
    addRest,
    isComplete,
    finish,
  };
}
