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
  | { status: 'fits' }
  | { status: 'missing'; missing: Equipment[] }
  /** The user has not said what equipment they own. */
  | { status: 'unknown' };

const KIND_EQUIPMENT: Record<Kind, Equipment[]> = {
  barbell: ['barbell'],
  dumbbell: ['dumbbell'],
  kettlebell: ['kettlebell'],
  machine: ['machine'],
  bodyweight: [],
};

/** What an exercise needs: its listed equipment, or what its kind implies when none is listed. */
const needs = (e: Exercise): Equipment[] => {
  const listed = (e.equipment ?? []).filter((x) => x !== 'none');
  return listed.length > 0 || e.equipment?.length ? listed : KIND_EQUIPMENT[e.kind];
};

/** Every exercise a program can ask for, including the steps of its ladders. */
function exerciseIds(program: Program): string[] {
  const ids = new Set<string>();
  for (const day of program.days) {
    for (const slot of day.slots) {
      for (const id of typeof slot.exercise === 'string' ? [slot.exercise] : slot.exercise) ids.add(id);
      const ladder = slot.ladder ? (ladders as Ladder[]).find((l) => l.id === slot.ladder) : undefined;
      for (const step of ladder?.steps ?? []) ids.add(step.exercise);
    }
  }
  return [...ids];
}

/** Whether the equipment the user owns covers every exercise of the program. */
export function equipmentFit(
  program: Program,
  exercises: Record<string, Exercise>,
  owned: Equipment[],
): EquipmentFit {
  if (owned.length === 0) return { status: 'unknown' };
  const missing = new Set<Equipment>();
  for (const id of exerciseIds(program)) {
    const exercise = exercises[id];
    if (!exercise) continue;
    for (const item of needs(exercise)) if (!owned.includes(item)) missing.add(item);
  }
  return missing.size === 0 ? { status: 'fits' } : { status: 'missing', missing: [...missing] };
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
