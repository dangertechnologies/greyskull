import { DEFAULT_RULES } from './types';
import type { Exercise, Program, Scheme, Slot } from './types';

const press = 'MILITARY_PRESS';
const bench = 'BENCH_PRESS';

export const TEMPLATES: Record<'base' | 'phrak', Program> = {
  base: {
    template: 'base',
    sessionsPerWeek: 3,
    rules: DEFAULT_RULES,
    days: [
      { name: 'Day 1', slots: [{ exercise: [press, bench], scheme: '2x5+' }, { exercise: 'BARBELL_SQUAT', scheme: '2x5+' }] },
      { name: 'Day 2', slots: [{ exercise: [press, bench], scheme: '2x5+' }, { exercise: 'DEADLIFT', scheme: '1x5+' }] },
      { name: 'Day 3', slots: [{ exercise: [press, bench], scheme: '2x5+' }, { exercise: 'BARBELL_SQUAT', scheme: '2x5+' }] },
    ],
  },
  phrak: {
    template: 'phrak',
    sessionsPerWeek: 3,
    rules: DEFAULT_RULES,
    days: [
      {
        name: 'A',
        slots: [
          { exercise: 'CHINUPS', scheme: '2x5+' },
          { exercise: press, scheme: '2x5+' },
          { exercise: 'BARBELL_SQUAT', scheme: '2x5+' },
        ],
      },
      {
        name: 'B',
        slots: [
          { exercise: 'BENT_OVER_ROW', scheme: '2x5+' },
          { exercise: bench, scheme: '2x5+' },
          { exercise: 'DEADLIFT', scheme: '1x5+' },
        ],
      },
    ],
  },
};

export type PluginId = 'curls' | 'chins' | 'dips' | 'abs' | 'rows_instead_of_chins';

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

export const PLUGINS: Record<
  PluginId,
  { label: string; templates: ('base' | 'phrak')[]; apply(p: Program): Program }
> = {
  curls: { label: 'Curls', templates: ['base', 'phrak'], apply: (p) => appendEverywhere(p, 'CURLS') },
  chins: { label: 'Chin-ups', templates: ['base'], apply: (p) => appendEverywhere(p, 'CHINUPS') },
  dips: { label: 'Dips', templates: ['base', 'phrak'], apply: (p) => appendEverywhere(p, 'DIPS') },
  abs: { label: 'Crunches', templates: ['base', 'phrak'], apply: (p) => appendEverywhere(p, 'CRUNCHES') },
  rows_instead_of_chins: { label: 'Rows instead of chin-ups', templates: ['phrak'], apply: swapRows },
};

export function parseScheme(s: Scheme): { sets: number; reps: number | null; amrap: boolean } {
  const [setsPart, repsPart] = s.split('x');
  const sets = Number(setsPart);
  if (repsPart === 'AMRAP') return { sets, reps: null, amrap: true };
  if (repsPart.endsWith('+')) return { sets, reps: Number(repsPart.slice(0, -1)), amrap: true };
  return { sets, reps: Number(repsPart), amrap: false };
}

/** Rep target for each work set; `null` marks an AMRAP set. */
export function setTargets(s: Scheme): (number | null)[] {
  const { sets, reps, amrap } = parseScheme(s);
  return Array.from({ length: sets }, (_, i) => (reps === null || (amrap && i === sets - 1) ? null : reps));
}

const pairKey = (a: string, b: string): string => [a, b].sort().join('|');

export interface ResolvedSession {
  dayName: string;
  slots: { exercise: string; scheme: Scheme }[];
}

/** Which day and exercises session `n` (0-based) is. Pure and derived on demand from the program. */
export function sessionFor(program: Program, n: number): ResolvedSession {
  const len = program.days.length;
  const day = program.days[n % len];
  const slots = day.slots.map((slot) => {
    if (typeof slot.exercise === 'string') return { exercise: slot.exercise, scheme: slot.scheme };
    const [a, b] = slot.exercise;
    const key = pairKey(a, b);
    // Sessions m < n whose day holds this pair: each full cycle contributes once per such day.
    const dayHasPair = program.days.map((d) =>
      d.slots.some((s) => typeof s.exercise !== 'string' && pairKey(s.exercise[0], s.exercise[1]) === key),
    );
    const perCycle = dayHasPair.filter(Boolean).length;
    const partial = dayHasPair.slice(0, n % len).filter(Boolean).length;
    const count = Math.floor(n / len) * perCycle + partial;
    return { exercise: count % 2 === 0 ? a : b, scheme: slot.scheme };
  });
  return { dayName: day.name, slots };
}

export function validateProgram(p: Program, catalog?: Record<string, Exercise>): string[] {
  const errors: string[] = [];
  if (p.days.length === 0) errors.push('Add at least one day.');
  const pairOrder = new Map<string, string>();
  for (const day of p.days) {
    if (day.slots.length === 0) errors.push(`${day.name} has no exercises.`);
    const seen = new Set<string>();
    for (const slot of day.slots) {
      for (const id of slotIds(slot)) {
        if (catalog && !(id in catalog)) errors.push(`${day.name}: unknown exercise ${id}.`);
        if (seen.has(id)) errors.push(`${day.name}: ${catalog?.[id]?.name ?? id} appears twice.`);
        seen.add(id);
      }
      if (typeof slot.exercise !== 'string') {
        const [a, b] = slot.exercise;
        if (a === b) errors.push(`${day.name}: an alternating pair needs two different exercises.`);
        const key = pairKey(a, b);
        const order = `${a}|${b}`;
        const known = pairOrder.get(key);
        if (known === undefined) pairOrder.set(key, order);
        else if (known !== order) errors.push(`${day.name}: ${a} / ${b} must use the same order on every day.`);
      }
    }
  }
  return errors;
}

export function exerciseIdsOf(program: Program): string[] {
  const ids = new Set<string>();
  for (const day of program.days) for (const slot of day.slots) slotIds(slot).forEach((id) => ids.add(id));
  return [...ids];
}
