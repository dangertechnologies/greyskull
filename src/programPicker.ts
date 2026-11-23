import ladders from './catalog/ladders.json';
import { getPlan, type PlanCategory } from './config/plans';
import type { Equipment, Exercise, Kind, Ladder, Program } from './domain';

export const CATEGORIES = ['Strength', 'Hypertrophy', 'Calisthenics', 'Skills', 'Mobility'] as const;
export type Category = (typeof CATEGORIES)[number];

const LABELS: Record<PlanCategory, Category> = {
  strength: 'Strength',
  hypertrophy: 'Hypertrophy',
  calisthenics: 'Calisthenics',
  skills: 'Skills',
  mobility: 'Mobility',
};

/** The category of a built-in plan (its own `category`); a plan without one falls back to a table by id. */
export function categoryOf(planId: string): Category | null {
  const plan = getPlan(planId);
  if (plan) return LABELS[plan.category];
  const table: Record<string, Category> = {
    base: 'Strength',
    phrak: 'Strength',
    stronglifts: 'Strength',
    'starting-strength': 'Strength',
    gzclp: 'Strength',
    '531-beginners': 'Strength',
    allpro: 'Hypertrophy',
    'lyle-gbr': 'Hypertrophy',
    'full-body-hypertrophy': 'Hypertrophy',
    'shoulder-mobilex': 'Mobility',
  };
  return table[planId] ?? null;
}

export type EquipmentFit =
  /** `later`: equipment only later ladder steps use, which the user does not own (never makes it a miss). */
  | { status: 'fits'; later?: Equipment[] }
  | { status: 'missing'; missing: Equipment[]; later?: Equipment[] }
  /** The user has not said what equipment they own. */
  | { status: 'unknown' };

const KIND_EQUIPMENT: Record<Kind, Equipment[]> = {
  barbell: ['barbell'],
  dumbbell: ['dumbbell'],
  kettlebell: ['kettlebell'],
  machine: ['machine'],
  bodyweight: [],
};

/**
 * What an exercise needs, as a list of requirements where any one item of each satisfies it. Listed equipment
 * is all needed (a barbell and a bench), except on a bodyweight exercise, where the apparatus are alternatives
 * (a support hold on dip bars, parallettes or rings) and only bands are an extra on top. With none listed, its
 * kind decides.
 */
const needs = (e: Exercise): Equipment[][] => {
  const listed = (e.equipment ?? []).filter((x) => x !== 'none');
  if (listed.length === 0) return e.equipment?.length ? [] : KIND_EQUIPMENT[e.kind].map((x) => [x]);
  if (e.kind !== 'bodyweight') return listed.map((x) => [x]);
  const apparatus = listed.filter((x) => x !== 'bands');
  return [
    ...(listed.includes('bands') ? [['bands' as Equipment]] : []),
    ...(apparatus.length ? [apparatus] : []),
  ];
};

/**
 * The exercises a program starts with (each slot's exercise; for a ladder, its first step), and those only
 * later ladder steps use.
 */
function exerciseIds(program: Program): { start: Set<string>; later: Set<string> } {
  const start = new Set<string>();
  const later = new Set<string>();
  for (const day of program.days) {
    for (const slot of day.slots) {
      const ladder = slot.ladder ? (ladders as Ladder[]).find((l) => l.id === slot.ladder) : undefined;
      if (ladder && ladder.steps.length > 0) {
        start.add(ladder.steps[0].exercise);
        for (const step of ladder.steps.slice(1)) later.add(step.exercise);
      } else
        for (const id of typeof slot.exercise === 'string' ? [slot.exercise] : slot.exercise) start.add(id);
    }
  }
  return { start, later };
}

/**
 * Whether the equipment the user owns covers what the program needs to start. Equipment that only later
 * ladder steps use is listed in `later` and never makes the program a miss.
 */
export function equipmentFit(
  program: Program,
  exercises: Record<string, Exercise>,
  owned: Equipment[],
): EquipmentFit {
  if (owned.length === 0) return { status: 'unknown' };
  const { start, later } = exerciseIds(program);
  const unowned = (ids: Set<string>) => {
    const out = new Set<Equipment>();
    for (const id of ids) {
      const exercise = exercises[id];
      if (!exercise) continue;
      for (const anyOf of needs(exercise)) if (!anyOf.some((x) => owned.includes(x))) out.add(anyOf[0]);
    }
    return out;
  };
  const missing = unowned(start);
  const laterOnly = [...unowned(later)].filter((e) => !missing.has(e));
  const extra = laterOnly.length > 0 ? { later: laterOnly } : {};
  return missing.size === 0
    ? { status: 'fits', ...extra }
    : { status: 'missing', missing: [...missing], ...extra };
}

/** The soft second line under the badge: equipment later ladder steps use that the user does not own. */
export function laterLabel(fit: EquipmentFit): string | null {
  if (fit.status === 'unknown' || !fit.later?.length) return null;
  return `Later steps also use: ${fit.later.map((e) => e.replace('-', ' ')).join(', ')}`;
}

/** The badge text for a fit result. */
export function fitLabel(fit: EquipmentFit): string {
  if (fit.status === 'fits') return 'Fits your equipment';
  if (fit.status === 'unknown') return 'Equipment not set';
  const names = fit.missing.map((e) => e.replace('-', ' '));
  return `Missing: ${names.slice(0, 2).join(', ')}${names.length > 2 ? '…' : ''}`;
}

const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Whether `name` is already used by one of `taken` (ignoring case and surrounding spaces). */
export const nameTaken = (name: string, taken: string[]): boolean => taken.some((t) => sameName(t, name));

/** `name`, or `name 2`, `name 3`, ... when programs already use it. */
export function uniqueProgramName(name: string, taken: string[]): string {
  if (!nameTaken(name, taken)) return name;
  for (let n = 2; ; n++) if (!nameTaken(`${name} ${n}`, taken)) return `${name} ${n}`;
}
