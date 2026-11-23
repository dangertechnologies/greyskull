import { LIMITS, linkProblem } from '../exerciseEdit';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, PATTERN_LABELS } from '../exerciseFilter';
import { BAR_MAX } from './plates';
import type { Equipment, Exercise, Kind, Muscle, Pattern } from './types';

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number = LIMITS.name): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const amount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
const KINDS: Kind[] = ['barbell', 'bodyweight', 'dumbbell', 'machine', 'kettlebell'];
const LEVELS = ['beginner', 'intermediate', 'expert'] as const;

class Refused extends Error {}
function must(ok: boolean, message: string): asserts ok {
  if (!ok) throw new Refused(message);
}

const pair = (v: unknown, where: string): { kg: number; lb: number } => {
  must(isObject(v) && amount(v.kg) && amount(v.lb), `${where} is not a weight.`);
  return { kg: v.kg as number, lb: v.lb as number };
};

/** A weight step the weight stepper and the rounding divide by: at least 0.5 (the editor's minimum). */
const stepPair = (v: unknown, where: string): { kg: number; lb: number } => {
  const p = pair(v, where);
  must(p.kg >= 0.5 && p.lb >= 0.5, `${where} must be at least 0.5.`);
  return p;
};

/** A bar of its own: heavier than nothing and no heavier than 50 kg (110 lb). */
const barPair = (v: unknown, where: string): { kg: number; lb: number } => {
  const p = pair(v, where);
  must(
    p.kg > 0 && p.kg <= BAR_MAX.kg && p.lb > 0 && p.lb <= BAR_MAX.lb,
    `${where} must be over 0 and at most ${BAR_MAX.kg} kg (${BAR_MAX.lb} lb).`,
  );
  return p;
};

const known = <T extends string>(v: unknown, allowed: Record<T, unknown>, where: string): T[] => {
  must(Array.isArray(v) && v.length <= 40, `${where} is not a list.`);
  // Own keys only: "constructor" or "toString" would otherwise pass as a known value.
  for (const x of v)
    must(
      typeof x === 'string' && Object.hasOwn(allowed, x),
      `${where}: unknown value ${JSON.stringify(x).slice(0, 40)}.`,
    );
  return v as T[];
};

const lines = (v: unknown, where: string): string[] => {
  must(Array.isArray(v) && v.length <= LIMITS.tips, `${where} is not a short list.`);
  must(
    v.every((x) => typeof x === 'string' && x.length <= LIMITS.tip),
    `${where} has a line that is too long.`,
  );
  return v as string[];
};

function rebuild(v: unknown, label: string): Exercise {
  must(isObject(v), `${label} is not an exercise.`);
  must(text(v.id), `${label} has no id.`);
  must(text(v.name), `${label} has no name (at most ${LIMITS.name} letters).`);
  must(KINDS.includes(v.kind as Kind), `${v.name}: unknown kind.`);
  const where = String(v.name);
  const out: Exercise = {
    id: v.id as string,
    name: (v.name as string).trim(),
    shortName: text(v.shortName) ? (v.shortName as string).trim() : (v.name as string).trim().split(/\s+/)[0],
    kind: v.kind as Kind,
    increment: pair(v.increment, `${where}: increment`),
    custom: true,
  };
  if (v.abbr !== undefined) {
    must(typeof v.abbr === 'string', `${where}: abbreviation.`);
    if (v.abbr.trim()) out.abbr = v.abbr.trim().slice(0, 3).toUpperCase();
  }
  if (v.step !== undefined) out.step = stepPair(v.step, `${where}: weight step`);
  if (v.barKg !== undefined) out.barKg = barPair(v.barKg, `${where}: bar`);
  if (v.description !== undefined) {
    must(
      typeof v.description === 'string' && v.description.length <= LIMITS.description,
      `${where}: description is too long.`,
    );
    out.description = v.description;
  }
  if (v.goodForm !== undefined) out.goodForm = lines(v.goodForm, `${where}: good form`);
  if (v.badForm !== undefined) out.badForm = lines(v.badForm, `${where}: bad form`);
  // A link that is not a web address is dropped: it would otherwise be offered to the browser.
  for (const key of ['url', 'video'] as const) {
    const link = v[key];
    if (typeof link === 'string' && link.trim() && linkProblem(link) === null) out[key] = link.trim();
  }
  if (v.equipment !== undefined)
    out.equipment = known<Equipment>(v.equipment, EQUIPMENT_LABELS, `${where}: equipment`);
  if (v.muscles !== undefined) out.muscles = known<Muscle>(v.muscles, MUSCLE_LABELS, `${where}: muscles`);
  if (v.secondary !== undefined)
    out.secondary = known<Muscle>(v.secondary, MUSCLE_LABELS, `${where}: muscles`);
  if (v.pattern !== undefined) {
    must(
      typeof v.pattern === 'string' && Object.hasOwn(PATTERN_LABELS, v.pattern),
      `${where}: unknown pattern.`,
    );
    out.pattern = v.pattern as Pattern;
  }
  if (v.level !== undefined) {
    must(LEVELS.includes(v.level as (typeof LEVELS)[number]), `${where}: unknown level.`);
    out.level = v.level as Exercise['level'];
  }
  if (v.timed === true) out.timed = true;
  return out;
}

/**
 * A custom exercise from an untrusted source (a shared plan, a backup, stored state), rebuilt from the fields a
 * custom exercise has: text within the editor's limits, weights in range, a bar of 0 to 50 kg, known equipment,
 * muscles, pattern and level. A link that is not an http(s) address is dropped; anything else wrong refuses the
 * exercise with the reason. `archived` is not kept (a caller restoring its own data adds it back), and the id is
 * only checked to be short text: a caller that keys a record by it checks `isReservedKey` itself.
 */
export function sanitizeExercise(
  v: unknown,
  label = 'An exercise',
): { ok: true; exercise: Exercise } | { ok: false; error: string } {
  try {
    return { ok: true, exercise: rebuild(v, label) };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, error: e.message };
    throw e;
  }
}
