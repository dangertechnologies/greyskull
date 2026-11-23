import type { AppState } from '../domain';
import { easedLifts, fiveThreeOneSets, sessionFor, sessionWeightKg } from '../domain';
import { nameOf, weekLabel, weightLabel } from '../format';
import { pickProgram } from '../programStart';

/** What the "Next workout" widget shows. Plain JSON: it is handed to the widget extension as-is. */
export interface NextWorkoutProps {
  /** "Workout A" */
  title: string;
  /** "Week 3" */
  subtitle: string;
  /** "Squat 62.5 kg" — at most 4; bodyweight lifts show their added load ("Dips +10 kg") or only their name. */
  lines: string[];
  /** True while a workout is in progress. */
  inProgress: boolean;
  /** False before a program exists. */
  ready: boolean;
}

export const EMPTY_NEXT: NextWorkoutProps = {
  title: 'Greyskull LP',
  subtitle: 'Open the app to set up',
  lines: [],
  inProgress: false,
  ready: false,
};

export const ALL_PAUSED_NEXT: NextWorkoutProps = {
  title: 'All programs paused',
  subtitle: 'Open the app to resume one',
  lines: [],
  inProgress: false,
  ready: false,
};

/** Weights moved from the old version stay hidden until the person has checked them. */
export const CONFIRM_NEXT: NextWorkoutProps = {
  title: 'Confirm your weights',
  subtitle: 'Open the app to check them',
  lines: [],
  inProgress: false,
  ready: false,
};

/**
 * The workout in progress (its own weights, as eased or changed since it started), else the next session of the
 * first program that is not paused, eased the way starting it would ease it. `now` is the clock for the break.
 */
export function nextWorkoutProps(
  s: Pick<
    AppState,
    'programs' | 'exercises' | 'inventory' | 'unit' | 'draft' | 'breakDeload' | 'bands' | 'sessions'
  > &
    Partial<Pick<AppState, 'needsWeightConfirm'>>,
  now = Date.now(),
): NextWorkoutProps {
  if (s.programs.length === 0) return EMPTY_NEXT;
  if (s.needsWeightConfirm) return CONFIRM_NEXT;
  const program = pickProgram(s);
  if (!program) return ALL_PAUSED_NEXT;
  const line = (id: string, kg: number) => {
    const exercise = s.exercises[id];
    const name = nameOf(s.exercises, id, true);
    return exercise ? `${name}${weightLabel(kg, exercise, s.unit)}` : name;
  };
  const { draft } = s;
  if (draft && draft.programId === program.id) {
    return {
      title: draft.dayName,
      subtitle: weekLabel(program) + (draft.eased ? ', eased' : ''),
      lines: draft.order.slice(0, 4).map((id) => line(id, draft.results[id]?.weightKg ?? 0)),
      inProgress: true,
      ready: true,
    };
  }
  const { lifts: eased } = easedLifts(s, program, now);
  const lifts = { ...program.lifts, ...eased };
  const session = sessionFor(program, lifts);
  const lines = session.slots.slice(0, 4).map(({ exercise: id, lift, progression, week }) => {
    const exercise = s.exercises[id];
    if (!exercise) return line(id, 0);
    const working = lifts[lift]?.weightKg ?? 0;
    const kg =
      progression === '531'
        ? Math.max(
            ...fiveThreeOneSets(working, week ?? 0, exercise, s.inventory, s.unit).map((x) => x.kg ?? 0),
          )
        : sessionWeightKg(working, session.intensity, exercise, s.inventory, s.unit);
    return line(id, kg);
  });
  return {
    title: session.dayName,
    subtitle: weekLabel(program) + (Object.keys(eased).length > 0 ? ', eased' : ''),
    lines,
    inProgress: false,
    ready: true,
  };
}

/** Rest timer Live Activity content. Times are epoch ms so the system can run the countdown itself. */
export interface RestProps {
  /** "Bench press · set 2 of 3" */
  label: string;
  /** Epoch ms */
  startsAt: number;
  endsAt: number;
}

export const restProps = (label: string, seconds: number, now = Date.now()): RestProps => ({
  label,
  startsAt: now,
  endsAt: now + Math.max(0, seconds) * 1000,
});
