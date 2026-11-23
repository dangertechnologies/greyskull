import { LIMITS, linkProblem } from '../exerciseEdit';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, PATTERN_LABELS } from '../exerciseFilter';
import { isReservedKey } from './own';
import { BAR_MAX } from './plates';
import type { Equipment, Exercise, Kind, Muscle, Pattern } from './types';

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

interface Limits {
  name: number;
  description: number;
  tips: number;
  tip: number;
  amount: number;
}
/** The editor's limits, for exercises from a shared plan. */
const EDITOR: Limits = {
  name: LIMITS.name,
  description: LIMITS.description,
  tips: LIMITS.tips,
  tip: LIMITS.tip,
  amount: 100,
};
/**
 * Stored data and the user's own backups: older versions saved custom exercises without the editor limits (long
 * names and ids, more form lines, any increment), and these must still load. Only absurd sizes are refused.
 */
const STORED: Limits = { name: 10_000, description: 10_000, tips: 1000, tip: 10_000, amount: 10_000 };
const KINDS: Kind[] = ['barbell', 'bodyweight', 'dumbbell', 'machine', 'kettlebell'];
const LEVELS = ['beginner', 'intermediate', 'expert'] as const;

class Refused extends Error {}
function must(ok: boolean, message: string): asserts ok {
  if (!ok) throw new Refused(message);
}

function rebuild(v: unknown, label: string, L: Limits, stored: boolean): Exercise {
  const text = (x: unknown): x is string =>
    typeof x === 'string' && x.trim().length > 0 && x.length <= L.name;
  const amount = (x: unknown): x is number =>
    typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= L.amount;
  const pair = (x: unknown, where: string): { kg: number; lb: number } => {
    must(isObject(x) && amount(x.kg) && amount(x.lb), `${where} is not a weight.`);
    return { kg: x.kg as number, lb: x.lb as number };
  };
  /** A weight step the weight stepper and the rounding divide by: at least 0.5 (the editor's minimum). */
  const stepPair = (x: unknown, where: string): { kg: number; lb: number } => {
    const p = pair(x, where);
    must(p.kg >= 0.5 && p.lb >= 0.5, `${where} must be at least 0.5.`);
    return p;
  };
  /** A bar of its own: heavier than nothing and no heavier than 50 kg (110 lb). */
  const barPair = (x: unknown, where: string): { kg: number; lb: number } => {
    const p = pair(x, where);
    must(
      p.kg > 0 && p.kg <= BAR_MAX.kg && p.lb > 0 && p.lb <= BAR_MAX.lb,
      `${where} must be over 0 and at most ${BAR_MAX.kg} kg (${BAR_MAX.lb} lb).`,
    );
    return p;
  };
  // Own keys only: "constructor" or "toString" would otherwise pass as a known value. Stored data keeps the
  // values this version knows (a later version may rename one); anything else refuses the exercise.
  const known = <T extends string>(x: unknown, allowed: Record<T, unknown>, where: string): T[] => {
    must(Array.isArray(x) && (stored || x.length <= 40), `${where} is not a list.`);
    const ok = (y: unknown): y is T => typeof y === 'string' && Object.hasOwn(allowed, y);
    if (stored) return [...new Set(x.filter(ok))];
    for (const y of x) must(ok(y), `${where}: unknown value ${JSON.stringify(y).slice(0, 40)}.`);
    return x as T[];
  };
  const lines = (x: unknown, where: string): string[] => {
    must(Array.isArray(x) && x.length <= L.tips, `${where} is not a short list.`);
    must(
      x.every((y) => typeof y === 'string' && y.length <= L.tip),
      `${where} has a line that is too long.`,
    );
    return x as string[];
  };

  must(isObject(v), `${label} is not an exercise.`);
  must(text(v.id), `${label} has no id.`);
  must(text(v.name), `${label} has no name (at most ${L.name} letters).`);
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
      typeof v.description === 'string' && v.description.length <= L.description,
      `${where}: description is too long.`,
    );
    out.description = v.description;
  }
  if (v.goodForm !== undefined) out.goodForm = lines(v.goodForm, `${where}: good form`);
  if (v.badForm !== undefined) out.badForm = lines(v.badForm, `${where}: bad form`);
  // A link that is not a web address is dropped from a shared plan. Stored data keeps the text the user typed
  // (older versions took any text): `openLink` opens only http(s) addresses.
  for (const key of ['url', 'video'] as const) {
    const link = v[key];
    if (
      typeof link === 'string' &&
      link.trim() &&
      (stored ? link.length <= L.tip : linkProblem(link) === null)
    )
      out[key] = link.trim();
  }
  // Display keys of older versions' pictures: kept from stored data unless they name what every object has.
  if (stored)
    for (const key of ['pictogram', 'background', 'icon'] as const) {
      const name = v[key];
      if (typeof name === 'string' && name.length <= 100 && !isReservedKey(name)) out[key] = name;
    }
  if (v.equipment !== undefined)
    out.equipment = known<Equipment>(v.equipment, EQUIPMENT_LABELS, `${where}: equipment`);
  if (v.muscles !== undefined) out.muscles = known<Muscle>(v.muscles, MUSCLE_LABELS, `${where}: muscles`);
  if (v.secondary !== undefined)
    out.secondary = known<Muscle>(v.secondary, MUSCLE_LABELS, `${where}: muscles`);
  const knownPattern = typeof v.pattern === 'string' && Object.hasOwn(PATTERN_LABELS, v.pattern);
  const knownLevel = LEVELS.includes(v.level as (typeof LEVELS)[number]);
  if (v.pattern !== undefined && (knownPattern || !stored)) {
    must(knownPattern, `${where}: unknown pattern.`);
    out.pattern = v.pattern as Pattern;
  }
  if (v.level !== undefined && (knownLevel || !stored)) {
    must(knownLevel, `${where}: unknown level.`);
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
 *
 * `stored`: the user's own data (the saved file, their backup). Text and lists may then be far longer than the
 * editor allows, links and picture keys are kept as stored, and unknown equipment, muscles, pattern or level are
 * left out instead of refusing the exercise.
 */
export function sanitizeExercise(
  v: unknown,
  label = 'An exercise',
  { stored = false }: { stored?: boolean } = {},
): { ok: true; exercise: Exercise } | { ok: false; error: string } {
  try {
    return { ok: true, exercise: rebuild(v, label, stored ? STORED : EDITOR, stored) };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, error: e.message };
    throw e;
  }
}
