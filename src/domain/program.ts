import type { PluginId } from '../config/plans';
import { PLANS } from '../config/plans';
import { groupErrors } from './groups';
import { getLadder } from './ladders';
import type {
  ActiveProgram,
  Day,
  Exercise,
  Group,
  GroupKind,
  LiftState,
  Program,
  ResolvedSlot,
  Rules,
  Scheme,
  Slot,
} from './types';

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
  /** Held for time (`3x30s`, `3x10-30s`): `reps` and `repsMax` are seconds. */
  timed: boolean;
}

/** `5x5`, `2x5+`, `2xAMRAP`, `2x8-12`; a trailing `s` on fixed or ranged reps makes them seconds. */
export const SCHEME_PATTERN = /^(\d+)x(?:(AMRAP)|(\d+)(?:(\+)|(s))?|(\d+)-(\d+)(s)?)$/;

/** Parses a scheme string; null when it is not one the app understands. */
export function tryParseScheme(s: string): ParsedScheme | null {
  const m = SCHEME_PATTERN.exec(s);
  if (!m) return null;
  const sets = Number(m[1]);
  if (sets < 1) return null;
  if (m[2]) return { sets, reps: null, repsMax: null, amrap: true, timed: false };
  if (m[3]) {
    const timed = m[5] === 's';
    const reps = Number(m[3]);
    return timed && reps < 1 ? null : { sets, reps, repsMax: null, amrap: m[4] === '+', timed };
  }
  const min = Number(m[6]);
  const max = Number(m[7]);
  return min >= 1 && max >= min ? { sets, reps: min, repsMax: max, amrap: false, timed: m[8] === 's' } : null;
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
  slots: ResolvedSlot[];
  groups?: Group[];
}

/** Exercise id behind a lift key: `'BARBELL_SQUAT@T2'` → `'BARBELL_SQUAT'`. */
export const exerciseOfLift = (key: string): string => key.split('@')[0];

/** A ladder slot's lift is the ladder id; alternating pairs use the exercise resolved for this session. */
export function liftKeyOf(slot: Slot, exercise?: string): string {
  return (
    slot.ladder ??
    slot.lift ??
    exercise ??
    (typeof slot.exercise === 'string' ? slot.exercise : slot.exercise[0])
  );
}

/**
 * The program's next session (day and exercises at `program.position`). Pure and derived on demand.
 * Days, alternating pairs and 5/3/1 weeks all count from the program's own position.
 */
export function sessionFor(
  program: ActiveProgram,
  lifts: Record<string, LiftState> = program.lifts,
): ResolvedSession {
  const n = Math.max(0, program.position);
  const len = program.days.length;
  const resolve = (at: number): ResolvedSlot[] =>
    program.days[at % len].slots.map((slot) => {
      const ladder = slot.ladder === undefined ? undefined : getLadder(slot.ladder);
      if (ladder) {
        const step = Math.max(0, Math.min(ladder.steps.length - 1, lifts[ladder.id]?.step ?? 0));
        const { exercise, scheme } = ladder.steps[step];
        return {
          ...slot,
          exercise,
          lift: ladder.id,
          scheme: scheme ?? slot.scheme,
          progression: 'ladder' as const,
          step,
        };
      }
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
  return {
    dayName: day.name,
    intensity: day.intensity ?? 1,
    slots,
    ...(day.groups ? { groups: day.groups } : {}),
  };
}

export function validateProgram(p: Program, catalog?: Record<string, Exercise>): string[] {
  const errors: string[] = [];
  if (p.days.length === 0) errors.push('Add at least one day.');
  if (!Number.isInteger(p.sessionsPerWeek) || p.sessionsPerWeek < 1 || p.sessionsPerWeek > 7)
    errors.push('Training days per week must be between 1 and 7.');
  if (p.startN !== undefined && !(Number.isInteger(p.startN) && p.startN >= 0))
    errors.push('Invalid program start.');
  const models = ['amrap', 'linear', 'double', 'stages', '531', 'ladder'];
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
      const ladder = slot.ladder === undefined ? undefined : getLadder(slot.ladder);
      if (slot.ladder !== undefined && !ladder) errors.push(`${day.name}: unknown ladder ${slot.ladder}.`);
      if (ladder && slot.exercise !== ladder.steps[0].exercise)
        errors.push(`${day.name}: ${ladder.name} must start at ${ladder.steps[0].exercise}.`);
      if (slot.ladder !== undefined && slot.progression !== undefined && slot.progression !== 'ladder')
        errors.push(`${day.name}: a ladder slot uses ladder progression.`);
      if (slot.ladder === undefined && (slot.progression ?? p.rules.progression) === 'ladder')
        errors.push(`${day.name}: ladder progression needs a ladder.`);
      // A ladder can reach any of its steps, and a session keeps one result per exercise.
      for (const id of ladder ? ladder.steps.map((s) => s.exercise) : slotIds(slot)) {
        const name = catalog?.[id]?.name ?? id;
        if (catalog && !(id in catalog)) errors.push(`${day.name}: unknown exercise ${id}.`);
        if (seen.has(id))
          errors.push(
            ladder
              ? `${day.name}: ${ladder.name} shares ${name} with another exercise of the day.`
              : `${day.name}: ${name} appears twice.`,
          );
        seen.add(id);
        const key = liftKeyOf(slot, id);
        const known = liftExercises.get(key);
        const owner = ladder ? `ladder ${ladder.id}` : id;
        if (known !== undefined && known !== owner)
          errors.push(`${day.name}: lift ${key} must use the same exercise everywhere.`);
        liftExercises.set(key, owner);
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
    errors.push(...groupErrors(day, setCounts));
  }
  return errors;
}

/** Every set count a slot can have: one per ladder step, or its scheme and stages. */
function setCounts(slot: Slot): number[] {
  const ladder = slot.ladder === undefined ? undefined : getLadder(slot.ladder);
  const schemes = ladder
    ? ladder.steps.map((s) => s.scheme ?? slot.scheme)
    : [slot.scheme, ...(slot.stages ?? [])];
  return schemes.flatMap((s) => tryParseScheme(s)?.sets ?? []);
}

/** Every exercise a program can use, including each step of its ladders. */
export function exerciseIdsOf(program: Program): string[] {
  const ids = new Set<string>();
  for (const day of program.days)
    for (const slot of day.slots) {
      const ladder = slot.ladder === undefined ? undefined : getLadder(slot.ladder);
      for (const id of ladder ? ladder.steps.map((s) => s.exercise) : slotIds(slot)) ids.add(id);
    }
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

class InvalidProgram extends Error {}

type Json = Record<string, unknown>;
const MAX_DAYS = 14;
const MAX_SLOTS = 20;
const MAX_TEXT = 100;
const GROUP_KINDS: GroupKind[] = ['superset', 'circuit', 'emom', 'interval'];

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_TEXT;
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isList = (v: unknown, max: number): v is unknown[] => Array.isArray(v) && v.length <= max;

function check(ok: boolean, error: string): asserts ok {
  if (!ok) throw new InvalidProgram(error);
}

/** Copies the optional fields that are present; a present field that fails `valid` is an error. */
function optional(src: Json, keys: string[], valid: (v: unknown) => boolean, where: string): Json {
  const out: Json = {};
  for (const key of keys) {
    if (src[key] === undefined) continue;
    check(valid(src[key]), `${where}: invalid ${key}.`);
    out[key] = src[key];
  }
  return out;
}

function slotOf(v: unknown, where: string): Slot {
  check(isObject(v), `${where} is not an exercise.`);
  const { exercise, scheme } = v;
  check(
    isText(exercise) || (isList(exercise, 2) && exercise.length === 2 && exercise.every(isText)),
    `${where}: invalid exercise.`,
  );
  check(isText(scheme), `${where}: invalid scheme.`);
  return {
    exercise,
    scheme,
    ...optional(v, ['lift', 'progression', 'ladder', 'group'], isText, where),
    ...optional(v, ['advanceAt'], isNumber, where),
    ...optional(v, ['stages'], (s) => isList(s, 10) && s.every(isText), where),
  } as Slot;
}

function groupOf(v: unknown, where: string): Group {
  check(isObject(v) && isText(v.id), `${where}: invalid group.`);
  check(GROUP_KINDS.includes(v.kind as GroupKind), `${where}: unknown group kind.`);
  return {
    id: v.id,
    kind: v.kind as GroupKind,
    ...optional(v, ['rounds', 'restS', 'workS', 'minutes'], isNumber, `${where}, group ${v.id}`),
  };
}

function dayOf(v: unknown, i: number): Day {
  const where = `Day ${i + 1}`;
  check(isObject(v) && isText(v.name), `${where}: invalid name.`);
  check(isList(v.slots, MAX_SLOTS), `${where}: at most ${MAX_SLOTS} exercises.`);
  check(v.groups === undefined || isList(v.groups, MAX_SLOTS), `${where}: invalid groups.`);
  return {
    name: v.name,
    slots: v.slots.map((s, j) => slotOf(s, `${where}, exercise ${j + 1}`)),
    ...optional(v, ['intensity'], isNumber, where),
    ...(v.groups ? { groups: v.groups.map((g) => groupOf(g, where)) } : {}),
  };
}

function rulesOf(v: unknown): Rules {
  check(isObject(v), 'Invalid rules.');
  const { doubleAt, deloadPct, failsBeforeDeload, warmups } = v;
  check(isNumber(doubleAt) && isNumber(deloadPct) && isNumber(failsBeforeDeload), 'Invalid rules.');
  check(typeof warmups === 'boolean', 'Invalid rules.');
  const increment = (i: unknown) => isObject(i) && isNumber(i.kg) && isNumber(i.lb);
  const increments = (m: unknown) =>
    isObject(m) &&
    Object.keys(m).length <= 200 &&
    Object.entries(m).every(([k, i]) => isText(k) && increment(i));
  return {
    doubleAt,
    deloadPct,
    failsBeforeDeload,
    warmups,
    ...optional(v, ['progression'], isText, 'Rules'),
    ...optional(v, ['increments'], increments, 'Rules'),
  };
}

/**
 * Structural check of untrusted JSON (an imported or generated plan): shapes, types and sizes, keeping only the
 * fields a program has. Run `validateProgram` on the result for the training rules.
 */
export function parseProgram(input: unknown): { ok: true; program: Program } | { ok: false; error: string } {
  try {
    check(isObject(input), 'Not a program.');
    check(isText(input.template), 'Invalid template.');
    check(isNumber(input.sessionsPerWeek), 'Invalid training days per week.');
    check(isList(input.days, MAX_DAYS) && input.days.length > 0, `A program has 1 to ${MAX_DAYS} days.`);
    const program: Program = {
      template: input.template,
      sessionsPerWeek: input.sessionsPerWeek,
      rules: rulesOf(input.rules),
      days: input.days.map(dayOf),
      ...optional(input, ['startN'], isNumber, 'Program'),
    };
    return { ok: true, program };
  } catch (e) {
    if (e instanceof InvalidProgram) return { ok: false, error: e.message };
    throw e;
  }
}
