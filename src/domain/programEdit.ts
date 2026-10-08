import { getPlan } from '../config/plans';
import type { PluginId } from './program';
import { PLUGINS, tryParseScheme } from './program';
import type { Program, Rules, Scheme, Slot } from './types';

/** Schemes the scheme chip cycles through, roughly from GSLP to hypertrophy work. */
export const SCHEMES: Scheme[] = [
  '2x5+',
  '1x5+',
  '3x5+',
  '5x5',
  '3x5',
  '1x5',
  '2x8-12',
  '3x8',
  '2x10',
  '2xAMRAP',
];

const clone = (p: Program): Program => JSON.parse(JSON.stringify(p)) as Program;

/** Template + switched-on plugins + the chosen options → the program the user starts with. */
export function buildProgram(
  base: Program,
  plugins: PluginId[],
  options: { sessionsPerWeek: 2 | 3; rules: Rules },
): Program {
  let program = clone(base);
  for (const id of plugins) {
    if (getPlan(base.template)?.plugins.includes(id)) program = PLUGINS[id].apply(program);
  }
  return { ...program, sessionsPerWeek: options.sessionsPerWeek, rules: { ...options.rules } };
}

/** The order an alternating pair is already written in elsewhere in the program, if any. */
function knownOrder(program: Program, a: string, b: string): [string, string] | null {
  for (const day of program.days) {
    for (const slot of day.slots) {
      if (typeof slot.exercise === 'string') continue;
      const [x, y] = slot.exercise;
      if ((x === a && y === b) || (x === b && y === a)) return [x, y];
    }
  }
  return null;
}

function withDay(program: Program, dayIndex: number, change: (slots: Slot[]) => Slot[]): Program {
  const next = clone(program);
  next.days[dayIndex].slots = change(next.days[dayIndex].slots);
  return next;
}

export function addSlot(
  program: Program,
  dayIndex: number,
  exercise: string,
  scheme: Scheme = '2x5+',
): Program {
  return withDay(program, dayIndex, (slots) => [...slots, { exercise, scheme }]);
}

/** Add an alternating pair; an already-used pair keeps its existing order so every day agrees. */
export function addAlternatingSlot(
  program: Program,
  dayIndex: number,
  a: string,
  b: string,
  scheme: Scheme = '2x5+',
): Program {
  const pair = knownOrder(program, a, b) ?? [a, b];
  return withDay(program, dayIndex, (slots) => [...slots, { exercise: pair, scheme }]);
}

export function removeSlot(program: Program, dayIndex: number, slotIndex: number): Program {
  return withDay(program, dayIndex, (slots) => slots.filter((_s, i) => i !== slotIndex));
}

export function moveSlot(program: Program, dayIndex: number, slotIndex: number, dir: 1 | -1): Program {
  const target = slotIndex + dir;
  return withDay(program, dayIndex, (slots) => {
    if (target < 0 || target >= slots.length) return slots;
    const copy = [...slots];
    [copy[slotIndex], copy[target]] = [copy[target], copy[slotIndex]];
    return copy;
  });
}

/** Move a slot to an absolute position (used by drag-to-reorder); out-of-range targets are clamped. */
export function moveSlotTo(program: Program, dayIndex: number, from: number, to: number): Program {
  return withDay(program, dayIndex, (slots) => {
    const target = Math.max(0, Math.min(slots.length - 1, to));
    if (from === target || !slots[from]) return slots;
    const copy = [...slots];
    const [moved] = copy.splice(from, 1);
    copy.splice(target, 0, moved);
    return copy;
  });
}

/** Where a row dragged `dy` px from `index` lands, given the row pitch (height + gap) and the row count. */
export function dragTarget(index: number, dy: number, rowPitch: number, count: number): number {
  if (!(rowPitch > 0)) return index;
  return Math.max(0, Math.min(count - 1, index + Math.round(dy / rowPitch)));
}

export function setSlotScheme(
  program: Program,
  dayIndex: number,
  slotIndex: number,
  scheme: Scheme,
): Program {
  return withDay(program, dayIndex, (slots) => slots.map((s, i) => (i === slotIndex ? { ...s, scheme } : s)));
}

export function renameDay(program: Program, dayIndex: number, name: string): Program {
  const next = clone(program);
  next.days[dayIndex].name = name;
  return next;
}

export function addDay(program: Program): Program {
  const next = clone(program);
  next.days.push({ name: `Day ${next.days.length + 1}`, slots: [] });
  return next;
}

export function removeDay(program: Program, dayIndex: number): Program {
  const next = clone(program);
  next.days = next.days.filter((_d, i) => i !== dayIndex);
  return next;
}

export type SchemeMode = 'fixed' | 'lastAmrap' | 'allAmrap' | 'range';

export interface SchemeParts {
  sets: number;
  mode: SchemeMode;
  reps: number;
  repsMax: number;
}

/** Break a scheme into the controls the scheme sheet edits. */
export function schemeParts(scheme: Scheme): SchemeParts {
  const parsed = tryParseScheme(scheme);
  if (!parsed) return { sets: 2, mode: 'lastAmrap', reps: 5, repsMax: 12 };
  if (parsed.reps === null) return { sets: parsed.sets, mode: 'allAmrap', reps: 5, repsMax: 12 };
  if (parsed.repsMax !== null)
    return { sets: parsed.sets, mode: 'range', reps: parsed.reps, repsMax: parsed.repsMax };
  return {
    sets: parsed.sets,
    mode: parsed.amrap ? 'lastAmrap' : 'fixed',
    reps: parsed.reps,
    repsMax: Math.max(12, parsed.reps),
  };
}

/** The scheme string for the sheet's controls (range max is kept above the minimum). */
export function buildScheme({ sets, mode, reps, repsMax }: SchemeParts): Scheme {
  switch (mode) {
    case 'allAmrap':
      return `${sets}xAMRAP`;
    case 'lastAmrap':
      return `${sets}x${reps}+`;
    case 'range':
      return `${sets}x${reps}-${Math.max(reps, repsMax)}`;
    default:
      return `${sets}x${reps}`;
  }
}
