import type { AppState } from '../domain';
import { fiveThreeOneSets, formatWeight, sessionFor, sessionWeightKg } from '../domain';
import { nameOf, weekLabel } from '../format';

/** What the "Next workout" widget shows. Plain JSON: it is handed to the widget extension as-is. */
export interface NextWorkoutProps {
  /** "Workout A" */
  title: string;
  /** "Week 3" */
  subtitle: string;
  /** "Squat 62.5 kg" — at most 4, bodyweight lifts show their name only. */
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

export function nextWorkoutProps(
  s: Pick<AppState, 'program' | 'nextSession' | 'lifts' | 'exercises' | 'inventory' | 'unit' | 'draft'>,
): NextWorkoutProps {
  if (!s.program) return EMPTY_NEXT;
  const session = sessionFor(s.program, s.nextSession, s.lifts);
  const lines = session.slots.slice(0, 4).map(({ exercise: id, lift, progression, week }) => {
    const exercise = s.exercises[id];
    const name = nameOf(s.exercises, id, true);
    if (!exercise || exercise.kind === 'bodyweight') return name;
    const working = s.lifts[lift]?.weightKg ?? 0;
    const kg =
      progression === '531'
        ? Math.max(
            ...fiveThreeOneSets(working, week ?? 0, exercise, s.inventory, s.unit).map((s) => s.kg ?? 0),
          )
        : sessionWeightKg(working, session.intensity, exercise, s.inventory, s.unit);
    return `${name} ${formatWeight(kg, s.unit)}`;
  });
  return {
    title: session.dayName,
    subtitle: weekLabel(s.program, s.nextSession),
    lines,
    inProgress: s.draft?.n === s.nextSession,
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
