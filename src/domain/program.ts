import type { PluginId } from '../config/plans';
import { PLANS } from '../config/plans';
import type { Exercise, LiftState, Program, ProgressionModel, Scheme, Slot } from './types';

/** Programs of the built-in plans, by plan id (see src/config/plans.ts). */
export const TEMPLATES: Record<string, Program> = Object.fromEntries(PLANS.map((p) => [p.id, p.program]));

export type { PluginId };

const clone = (p: Program): Program => JSON.parse(JSON.stringify(p)) as Program;

const slotIds = (s: Slot): string[] => (typeof s.exercise === 'string' ? [s.exercise] : s.exercise);

function appendEverywhere(p: Program, exercise: string): Program {
  const next = clone(p);
  for (const day of next.days) {
    if (!day.slots.some((s) => slotIds(s).includes(exercise))) {
      day.slots.push({ exercise, scheme: '2xAMRAP' });
    }
  }
  return next;
}

/** Phrak variant: rows on the first day, chin-ups on the second. Idempotent. */
function swapRows(p: Program): Program {
  const next = clone(p);
  const replace = (day: Program['days'][number] | undefined, from: string, to: string) => {
    if (!day) return;
    for (const slot of day.slots) if (slot.exercise === from) slot.exercise = to;
  };
  replace(next.days[0], 'CHINUPS', 'BENT_OVER_ROW');
  replace(next.days[1], 'BENT_OVER_ROW', 'CHINUPS');
  return next;
}

/** Optional extras; which ones a plan offers is listed in its config entry. */
export const PLUGINS: Record<PluginId, { label: string; apply(p: Program): Program }> = {
  curls: { label: 'Curls', apply: (p) => appendEverywhere(p, 'CURLS') },
  chins: { label: 'Chin-ups', apply: (p) => appendEverywhere(p, 'CHINUPS') },
  dips: { label: 'Dips', apply: (p) => appendEverywhere(p, 'DIPS') },
  abs: { label: 'Crunches', apply: (p) => appendEverywhere(p, 'CRUNCHES') },
  rows_instead_of_chins: { label: 'Rows instead of chin-ups', apply: swapRows },
};

export interface ParsedScheme {
  sets: number;
  /** Fixed or minimum reps; null when every set is AMRAP. */
  reps: number | null;
  /** Top of a rep range (double progression), else null. */
  repsMax: number | null;
  /** True when the last set (or every set, for `xAMRAP`) is as many reps as possible. */
  amrap: boolean;
}

const SCHEME_PATTERN = /^(\d+)x(?:(AMRAP)|(\d+)(\+)?|(\d+)-(\d+))$/;

/** Parses a scheme string; null when it is not one the app understands. */
export function tryParseScheme(s: string): ParsedScheme | null {
  const m = SCHEME_PATTERN.exec(s);
  if (!m) return null;
  const sets = Number(m[1]);
  if (sets < 1) return null;
  if (m[2]) return { sets, reps: null, repsMax: null, amrap: true };
  if (m[3]) return { sets, reps: Number(m[3]), repsMax: null, amrap: m[4] === '+' };
  const min = Number(m[5]);
  const max = Number(m[6]);
  return min >= 1 && max >= min ? { sets, reps: min, repsMax: max, amrap: false } : null;
}

export function parseScheme(s: Scheme): ParsedScheme {
  const parsed = tryParseScheme(s);
  if (!parsed) throw new Error(`Unknown scheme ${s}`);
  return parsed;
}

/**
 * Rep target for each work set; `null` marks an AMRAP set. For a rep range the target is the lift's current
 * rep goal (`liftReps`), clamped to the range and starting at the bottom.
 */
export function setTargets(s: Scheme, liftReps?: number): (number | null)[] {
  const { sets, reps, repsMax, amrap } = parseScheme(s);
  const target =
    reps !== null && repsMax !== null ? Math.min(repsMax, Math.max(reps, liftReps ?? reps)) : reps;
  return Array.from({ length: sets }, (_, i) =>
    target === null || (amrap && i === sets - 1) ? null : target,
  );
}

const pairKey = (a: string, b: string): string => [a, b].sort().join('|');

export interface ResolvedSession {
  dayName: string;
  /** Fraction of working weight for the day (1 unless the plan marks it light/medium). */
  intensity: number;
  slots: {
    exercise: string;
    lift: string;
    scheme: Scheme;
    progression: ProgressionModel;
    stages?: Scheme[];
    advanceAt?: number;
    week?: number;
    lastInWeek?: boolean;
  }[];
}

/** Exercise id behind a lift key: `'BARBELL_SQUAT@T2'` → `'BARBELL_SQUAT'`. */
export const exerciseOfLift = (key: string): string => key.split('@')[0];

/** Alternating pairs use the exercise resolved for this session. */
export function liftKeyOf(slot: Slot, exercise?: string): string {
  return slot.lift ?? exercise ?? (typeof slot.exercise === 'string' ? slot.exercise : slot.exercise[0]);
}

/** Which day and exercises session `n` (0-based) is. Pure and derived on demand from the program. */
export function sessionFor(
  program: Program,
  session: number,
  lifts: Record<string, LiftState> = {},
): ResolvedSession {
  // Days, alternating pairs and 5/3/1 weeks count from the session the program started at.
  const n = Math.max(0, session - (program.startN ?? 0));
  const len = program.days.length;
  const resolve = (at: number) =>
    program.days[at % len].slots.map((slot) => {
      let exercise: string;
      if (typeof slot.exercise === 'string') exercise = slot.exercise;
      else {
        const [a, b] = slot.exercise;
        const key = pairKey(a, b);
        const dayHasPair = program.days.map((d) =>
          d.slots.some(
            (s) => typeof s.exercise !== 'string' && pairKey(s.exercise[0], s.exercise[1]) === key,
          ),
        );
        const perCycle = dayHasPair.filter(Boolean).length;
        const partial = dayHasPair.slice(0, at % len).filter(Boolean).length;
        const count = Math.floor(at / len) * perCycle + partial;
        exercise = count % 2 === 0 ? a : b;
      }
      const lift = liftKeyOf(slot, exercise);
      const stage = Math.max(0, Math.min((slot.stages?.length ?? 1) - 1, lifts[lift]?.stage ?? 0));
      return {
        ...slot,
        exercise,
        lift,
        scheme: slot.stages?.[stage] ?? slot.scheme,
        progression: slot.progression ?? program.rules.progression ?? 'amrap',
      };
    });
  const slots = resolve(n).map((slot) =>
    slot.progression === '531'
      ? {
          ...slot,
          week: Math.floor(n / len) % 3,
          lastInWeek: !Array.from({ length: len - (n % len) - 1 }, (_, i) => resolve(n + i + 1)).some(
            (later) => later.some((s) => s.lift === slot.lift),
          ),
        }
      : slot,
  );
  const day = program.days[n % len];
  return { dayName: day.name, intensity: day.intensity ?? 1, slots };
}

export function validateProgram(p: Program, catalog?: Record<string, Exercise>): string[] {
  const errors: string[] = [];
  if (p.days.length === 0) errors.push('Add at least one day.');
  if (!Number.isInteger(p.sessionsPerWeek) || p.sessionsPerWeek < 1 || p.sessionsPerWeek > 7)
    errors.push('Training days per week must be between 1 and 7.');
  if (p.startN !== undefined && !(Number.isInteger(p.startN) && p.startN >= 0))
    errors.push('Invalid program start.');
  const models = ['amrap', 'linear', 'double', 'stages', '531'];
  if (p.rules.progression !== undefined && !models.includes(p.rules.progression))
    errors.push('Unknown progression model.');
  const liftExercises = new Map<string, string>();
  const pairOrder = new Map<string, string>();
  for (const day of p.days) {
    if (day.slots.length === 0) errors.push(`${day.name} has no exercises.`);
    if (day.intensity !== undefined && !(day.intensity > 0 && day.intensity <= 1)) {
      errors.push(`${day.name}: intensity must be between 0 and 100 %.`);
    }
    const seen = new Set<string>();
    for (const slot of day.slots) {
      for (const id of slotIds(slot)) {
        if (catalog && !(id in catalog)) errors.push(`${day.name}: unknown exercise ${id}.`);
        if (seen.has(id)) errors.push(`${day.name}: ${catalog?.[id]?.name ?? id} appears twice.`);
        seen.add(id);
        const key = liftKeyOf(slot, id);
        const known = liftExercises.get(key);
        if (known !== undefined && known !== id)
          errors.push(`${day.name}: lift ${key} must use the same exercise everywhere.`);
        liftExercises.set(key, id);
      }
      if (!tryParseScheme(slot.scheme)) errors.push(`${day.name}: unknown scheme ${slot.scheme}.`);
      if (slot.progression !== undefined && !models.includes(slot.progression))
        errors.push(`${day.name}: unknown progression model.`);
      if (slot.advanceAt !== undefined && (!Number.isInteger(slot.advanceAt) || slot.advanceAt < 1))
        errors.push(`${day.name}: invalid advanceAt.`);
      if (
        slot.lift !== undefined &&
        (typeof slot.lift !== 'string' || !slot.lift || typeof slot.exercise !== 'string')
      )
        errors.push(`${day.name}: lift keys require a single exercise, not an alternating pair.`);
      if (
        slot.stages !== undefined &&
        (!Array.isArray(slot.stages) ||
          slot.stages.length === 0 ||
          slot.stages.some((s) => typeof s !== 'string' || !tryParseScheme(s)) ||
          slot.stages[0] !== slot.scheme)
      )
        errors.push(`${day.name}: invalid stages (scheme must match stage 0).`);
      if (typeof slot.exercise !== 'string') {
        const [a, b] = slot.exercise;
        if (a === b) errors.push(`${day.name}: an alternating pair needs two different exercises.`);
        const key = pairKey(a, b);
        const order = `${a}|${b}`;
        const known = pairOrder.get(key);
        if (known === undefined) pairOrder.set(key, order);
        else if (known !== order)
          errors.push(`${day.name}: ${a} / ${b} must use the same order on every day.`);
      }
    }
  }
  return errors;
}

export function exerciseIdsOf(program: Program): string[] {
  const ids = new Set<string>();
  for (const day of program.days)
    for (const slot of day.slots)
      slotIds(slot).forEach((id) => {
        ids.add(id);
      });
  return [...ids];
}

export function liftKeysOf(program: Program): string[] {
  return [
    ...new Set(
      program.days.flatMap((day) =>
        day.slots.flatMap((slot) => slotIds(slot).map((id) => liftKeyOf(slot, id))),
      ),
    ),
  ];
}
