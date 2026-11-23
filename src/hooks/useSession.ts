import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Group, GroupKind, LiftState, Outcome, ResolvedSlot, SessionLog } from '../domain';
import { isPersonalRecord, parseScheme, sessionFor, warmups } from '../domain';
import { setOrder } from '../domain/groups';
import { startRoute } from '../programStart';
import { cancelRestAlert, ensureRestAlertPermission, scheduleRestAlert } from '../restAlert';
import { useStore } from '../store';
import { anchorOf, useTimers } from '../timers/store';
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
  minReps?: number;
  perSetWeight?: boolean;
  weightKg: number;
  logged: boolean;
  /** Reps, or seconds for a timed set. */
  reps: number;
  /** Held for time: targets and reps are seconds. */
  timed?: boolean;
  /** Work sets of a superset, circuit, EMOM or interval. */
  group?: ItemGroup;
}

export interface ItemGroup {
  id: string;
  kind: GroupKind;
  /** "A1": the group's letter in the day and the exercise's place in it. */
  label: string;
  /** 1-based round (minute of an EMOM) and how many the group has. */
  round: number;
  rounds: number;
  /** Rest after this set: set on the last set of a round; none between the exercises of a round. */
  restAfterS?: number;
  /** Index of this set among the group's sets (the EMOM minute, the interval round), for the timer. */
  step: number;
  /** How many sets the group has in all (the timer's length in steps). */
  steps: number;
}

/**
 * Seconds of rest after logging `items[index]` (before it is logged). Ungrouped sets rest the global time. A
 * superset or circuit rests its group's time once every set of the round is logged, never between them. No rest
 * before or inside an EMOM or interval block (it keeps its own clock), nor after the last set.
 */
export function restAfter(items: SessionItem[], index: number, restSeconds: number): number {
  const item = items[index];
  if (!item || item.kind === 'warmup' || item.logged) return 0;
  const nextOpen = items.find((i, k) => k !== index && !i.logged && i.kind !== 'warmup' && k > index);
  if (!nextOpen || (nextOpen.group && isTimerKind(nextOpen.group.kind))) return 0;
  const g = item.group;
  if (!g) return restSeconds;
  if (isTimerKind(g.kind)) return 0;
  const round = items.filter((i) => i.group?.id === g.id && i.group.round === g.round);
  if (round.some((i) => i !== item && !i.logged)) return 0;
  return round.find((i) => i.group?.restAfterS !== undefined)?.group?.restAfterS ?? 0;
}

/** Groups run by a clock rather than by the Done button. */
export const isTimerKind = (kind: GroupKind): boolean => kind === 'emom' || kind === 'interval';

export interface FinishedExercise {
  exerciseId: string;
  fromKg: number;
  outcome: Outcome;
  /** A new best weight, or more last-set reps at the best weight. */
  pr: boolean;
  /** The lift state the workout started from (eased after a break, else stored): tells a step or band change. */
  from?: LiftState;
  /** Ladder id when the exercise is a ladder step. */
  ladder?: string;
  /** Held for time: reps are seconds. */
  timed?: boolean;
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
  /** The day's groups (supersets, circuits, EMOMs, intervals). */
  groups: Group[];
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

/** The draft's resolved exercises (only a draft from before they were stored lacks them). */
const slotsOf = (draft: SessionLog, program: Parameters<typeof sessionFor>[0]): ResolvedSlot[] =>
  draft.slots ?? sessionFor({ ...program, position: draft.position ?? program.position }).slots;

/**
 * The engine behind every session view. State lives in the store's draft (persisted on every set), warm-ups
 * and the rest timer are local to the screen. Session `n` is the open draft; without one, `programId` names
 * the program to start a workout of. The program always comes from the draft once it exists.
 */
export function useSession(n: number, programId?: string): SessionApi | null {
  const draft = useStore((s) => s.draft);
  const program = useStore((s) =>
    s.programs.find((p) => p.id === (s.draft && s.draft.n === n ? s.draft.programId : programId)),
  );
  const exercises = useStore((s) => s.exercises);
  const inventory = useStore((s) => s.inventory);
  const unit = useStore((s) => s.unit);
  const restSeconds = useStore((s) => s.restSeconds);
  const startSession = useStore((s) => s.startSession);
  const logSet = useStore((s) => s.logSet);
  const unskipExercise = useStore((s) => s.unskipExercise);
  const setDraftWeight = useStore((s) => s.setDraftWeight);
  const finishSession = useStore((s) => s.finishSession);

  // After finishing, the draft is gone on purpose: never start a new one for the same session.
  const [finished, setFinished] = useState(false);
  const ready = draft !== null && draft.n === n;
  const hasDraft = draft !== null;
  const startId = program?.id;
  // Only the next session id starts a workout: a stale route (its workout finished or dropped) never does.
  const isNext = useStore((s) => s.nextSession === n);
  // Weights moved from the old version are checked first, as Today and Siri do: a link starts nothing before.
  const mustConfirm = useStore((s) => startRoute(s, startId).kind === 'confirm');
  useEffect(() => {
    if (!ready && !finished && !hasDraft && isNext && startId && !mustConfirm) startSession(startId);
  }, [ready, finished, hasDraft, isNext, startId, mustConfirm, startSession]);

  const [picked, setPicked] = useState<number | null>(null);
  const [doneWarmups, setDoneWarmups] = useState<ReadonlySet<string>>(new Set());

  const groups = useMemo<Group[]>(
    () =>
      ready && program
        ? (sessionFor({ ...program, position: draft.position ?? program.position }).groups ?? [])
        : [],
    [ready, program, draft?.position],
  );

  const items = useMemo<SessionItem[]>(() => {
    if (!ready || !program) return [];
    const resolved = slotsOf(draft, program);
    const slots = new Map(resolved.map((s) => [s.exercise, s]));
    const out: SessionItem[] = [];
    // Warm-ups are not persisted: they count as done once real work exists for the lift or any later lift.
    const laterLogged = new Set<string>();
    let seenLogged = false;
    for (const id of [...draft.order].reverse()) {
      if (seenLogged) laterLogged.add(id);
      if (draft.results[id]?.sets.some((x) => x.reps > 0)) seenLogged = true;
    }
    const warmupsOf = (id: string): SessionItem[] => {
      const result = draft.results[id];
      const exercise = exercises[id];
      const scheme = slots.get(id)?.scheme;
      if (!result || !exercise || !scheme || !program.rules.warmups) return [];
      const anyLogged = result.sets.some((s) => s.reps > 0);
      const warm = warmups(result.sets[0]?.kg ?? result.weightKg, scheme, exercise, inventory, unit);
      return warm.map((w, i) => {
        const logged = anyLogged || laterLogged.has(id) || doneWarmups.has(`${id}:${i}`);
        return {
          exerciseId: id,
          kind: 'warmup',
          setIndex: null,
          position: i + 1,
          total: warm.length,
          targetReps: w.reps,
          weightKg: w.kg,
          logged,
          reps: logged ? w.reps : 0,
        };
      });
    };
    // Grouped sets interleave (superset A1, A2, rest, A1, A2...); every other exercise goes set by set.
    // Exercises of the draft its slots no longer name (an old draft, the program changed) go last, ungrouped.
    const known = [
      ...resolved.filter((s) => draft.results[s.exercise] && exercises[s.exercise]),
      ...draft.order
        .filter((id) => draft.results[id] && exercises[id] && !resolved.some((s) => s.exercise === id))
        .map((id) => ({ exercise: id }) as ResolvedSlot),
    ];
    const counts = Object.fromEntries(known.map((s) => [s.exercise, draft.results[s.exercise].sets.length]));
    const steps = setOrder({ dayName: draft.dayName, intensity: 1, slots: known, groups }, counts);
    const letters = new Map(
      [...new Set(known.flatMap((s) => (s.group === undefined ? [] : [s.group])))]
        .filter((id) => groups.some((g) => g.id === id))
        .map((id, i) => [id, String.fromCharCode(65 + i)]),
    );
    for (const [k, step] of steps.entries()) {
      const id = step.exercise;
      const result = draft.results[id];
      const set = result.sets[step.set];
      if (step.set === 0) out.push(...warmupsOf(id));
      const week = slots.get(id)?.week ?? 0;
      const scheme = slots.get(id)?.scheme;
      const group = step.group === undefined ? undefined : groups.find((g) => g.id === step.group);
      const members = group ? known.filter((s) => s.group === group.id) : [];
      const groupSteps = group ? steps.filter((x) => x.group === group.id) : [];
      out.push({
        exerciseId: id,
        kind: set.target === null ? 'amrap' : 'work',
        setIndex: step.set,
        position: step.set + 1,
        total: result.sets.length,
        targetReps: set.target,
        weightKg: set.kg ?? result.weightKg,
        minReps:
          set.kg !== undefined
            ? week === 2
              ? 1
              : week === 1
                ? 3
                : 5
            : ((scheme && parseScheme(scheme).reps) ?? 5),
        ...(set.kg === undefined ? {} : { perSetWeight: true }),
        ...(result.timed ? { timed: true } : {}),
        logged: set.reps > 0,
        reps: set.reps,
        ...(group
          ? {
              group: {
                id: group.id,
                kind: group.kind,
                label: `${letters.get(group.id)}${members.findIndex((s) => s.exercise === id) + 1}`,
                round: step.set + 1,
                rounds: Math.max(...members.map((s) => counts[s.exercise])),
                ...(step.restAfterS === undefined ? {} : { restAfterS: step.restAfterS }),
                step: groupSteps.indexOf(steps[k]),
                steps: groupSteps.length,
              },
            }
          : {}),
      });
    }
    return out;
  }, [ready, draft, program, exercises, inventory, unit, doneWarmups, groups]);

  // Sets of an EMOM or interval whose timer has ended are behind you: unlogged ones stay missed (0 reps).
  const anchors = useTimers((s) => (s.n === n ? s.anchors : undefined));
  const passed = (i: SessionItem) =>
    !!i.group &&
    isTimerKind(i.group.kind) &&
    anchorOf({ n, anchors: anchors ?? {} }, n, i.group.id)?.endedAt !== undefined;
  const firstOpen = items.findIndex((i) => !i.logged && !passed(i));
  const activeIndex = firstOpen === -1 ? items.length : firstOpen;
  const isComplete =
    ready && items.length > 0 && items.every((i) => i.kind === 'warmup' || i.logged || passed(i));

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
        // A set logged for an exercise skipped earlier counts again.
        if (draft?.skippedExercises?.includes(item.exerciseId)) unskipExercise(item.exerciseId);
      }
      // Rest only after a *new* work set: warm-ups and edits of an already logged set do not start one. A
      // grouped set rests the group's time after its round (none between the exercises of a round); an EMOM
      // or interval keeps its own clock.
      const rest = restAfter(items, itemIndex, restSeconds);
      if (!wasLogged && rest > 0) {
        void ensureRestAlertPermission();
        const start = Date.now();
        setNow(start);
        setRestTotal(rest);
        setRestEndsAt(start + rest * 1000);
      }
    },
    [items, logSet, restSeconds, draft, unskipExercise],
  );

  const finish = useCallback((): FinishedExercise[] => {
    const state = useStore.getState();
    const before = state.draft;
    if (!before) throw new Error('No session in progress');
    const history = state.sessions;
    const owner = state.programs.find((p) => p.id === before.programId);
    const lifts = owner?.lifts ?? {};
    const slots = owner ? slotsOf(before, owner) : [];
    const outcomes = finishSession();
    useTimers.getState().clear(); // the workout's timers end with it
    setFinished(true);
    setRestEndsAt(null);
    return before.order
      .filter((id) => outcomes[id])
      .map((id) => {
        const result = before.results[id];
        const slot = slots.find((s) => s.exercise === id);
        const key = slot?.lift ?? id;
        return {
          from: before.eased?.lifts[key] ?? lifts[key],
          ...(slot?.ladder ? { ladder: slot.ladder } : {}),
          ...(result.timed ? { timed: true } : {}),
          exerciseId: id,
          fromKg: result.sets.some((s) => s.kg !== undefined)
            ? (lifts[key]?.weightKg ?? result.weightKg)
            : result.weightKg,
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
    groups,
    restRemaining,
    restTotal,
    skipRest: () => setRestEndsAt(null),
    addRest,
    isComplete,
    finish,
  };
}
