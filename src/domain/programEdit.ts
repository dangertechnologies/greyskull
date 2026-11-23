import { getPlan } from '../config/plans';
import { getLadder } from './ladders';
import type { PluginId } from './program';
import { PLUGINS, tryParseScheme } from './program';
import type {
  Day,
  Exercise,
  Group,
  GroupKind,
  Program,
  ProgressionModel,
  Rules,
  Scheme,
  Slot,
} from './types';
import { DEFAULT_RULES } from './types';

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
  options: { sessionsPerWeek: number; rules: Rules },
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

/** Drop groups that lost every exercise, and supersets and circuits left with fewer than two. */
function tidyGroups(day: Day): Day {
  if (!day.groups) return day;
  const size = (id: string) => day.slots.filter((s) => s.group === id).length;
  const dead = new Set(day.groups.filter((g) => size(g.id) < GROUP_MIN[g.kind]).map((g) => g.id));
  if (dead.size === 0) return day;
  const groups = day.groups.filter((g) => !dead.has(g.id));
  const slots = day.slots.map((s) => {
    if (s.group === undefined || !dead.has(s.group)) return s;
    const { group: _group, ...rest } = s;
    return rest;
  });
  const { groups: _groups, ...rest } = day;
  return groups.length > 0 ? { ...rest, slots, groups } : { ...rest, slots };
}

export function removeSlot(program: Program, dayIndex: number, slotIndex: number): Program {
  const next = withDay(program, dayIndex, (slots) => slots.filter((_s, i) => i !== slotIndex));
  next.days[dayIndex] = tidyGroups(next.days[dayIndex]);
  return next;
}

/** Whether the exercises of every group are still next to each other. */
const grouped = (slots: Slot[]): boolean => {
  const last = new Map<string, number>();
  for (const [i, s] of slots.entries()) {
    if (s.group === undefined) continue;
    const prev = last.get(s.group);
    if (prev !== undefined && prev !== i - 1) return false;
    last.set(s.group, i);
  }
  return true;
};

const relocate = (slots: Slot[], from: number, to: number): Slot[] => {
  const copy = [...slots];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
};

/**
 * Move one step. An exercise outside a group hops over a whole group; a member of a group only swaps with
 * its neighbours inside it. A move that is not possible returns the same program.
 */
export function moveSlot(program: Program, dayIndex: number, slotIndex: number, dir: 1 | -1): Program {
  const slots = program.days[dayIndex].slots;
  const slot = slots[slotIndex];
  const neighbour = slots[slotIndex + dir];
  if (!slot || !neighbour) return program;
  let to = slotIndex + dir;
  if (slot.group !== undefined) {
    if (neighbour.group !== slot.group) return program;
  } else if (neighbour.group !== undefined) {
    const members = slots.flatMap((s, i) => (s.group === neighbour.group ? [i] : []));
    to = dir === 1 ? members[members.length - 1] : members[0];
  }
  return withDay(program, dayIndex, (all) => relocate(all, slotIndex, to));
}

/**
 * Move a slot to an absolute position (used by drag-to-reorder); out-of-range targets are clamped. A drop that
 * would split a group is ignored and returns the same program.
 */
export function moveSlotTo(program: Program, dayIndex: number, from: number, to: number): Program {
  const slots = program.days[dayIndex].slots;
  const target = Math.max(0, Math.min(slots.length - 1, to));
  if (from === target || !slots[from]) return program;
  const moved = relocate(slots, from, target);
  return grouped(moved) ? withDay(program, dayIndex, () => moved) : program;
}

/** Where a row dragged `dy` px from `index` lands, given the row pitch (height + gap) and the row count. */
export function dragTarget(index: number, dy: number, rowPitch: number, count: number): number {
  if (!(rowPitch > 0)) return index;
  return Math.max(0, Math.min(count - 1, index + Math.round(dy / rowPitch)));
}

/** Whether the scheme is a range (`2x8-12`, `3x10-30s`), which double progression needs. */
const isRange = (scheme: Scheme): boolean => tryParseScheme(scheme)?.repsMax != null;
const isTimed = (scheme: Scheme): boolean => tryParseScheme(scheme)?.timed === true;

/** The same sets with a range from the scheme's reps up (reps +4, or seconds +15). */
function toRange(scheme: Scheme): Scheme {
  const p = tryParseScheme(scheme);
  if (!p) return scheme;
  if (p.timed) {
    const seconds = p.reps ?? 30;
    return `${p.sets}x${seconds}-${seconds + 15}s`;
  }
  const reps = p.reps ?? 8;
  return `${p.sets}x${reps}-${reps + 4}`;
}

/** Replace a slot's scheme and, when it has stages, the first stage with it (the two must agree). */
const withScheme = (s: Slot, scheme: Scheme): Slot => ({
  ...s,
  scheme,
  ...(s.stages ? { stages: [scheme, ...s.stages.slice(1)] } : {}),
});

export function setSlotScheme(
  program: Program,
  dayIndex: number,
  slotIndex: number,
  scheme: Scheme,
): Program {
  return withDay(program, dayIndex, (slots) =>
    slots.map((s, i) => {
      if (i !== slotIndex) return s;
      const next = withScheme(s, scheme);
      // A hold has no AMRAP, 5/3/1 or stages: it moves by a fixed target (linear) or a range of seconds (double).
      const model = s.progression ?? program.rules.progression ?? 'amrap';
      if (isTimed(scheme) && !s.ladder && model !== 'linear' && model !== 'double')
        next.progression = isRange(scheme) ? 'double' : 'linear';
      return next;
    }),
  );
}

/** A slot for an exercise the user just added: a scheme its kind can progress under. */
export function defaultSlot(exercise: Exercise): Slot {
  const bodyweight = exercise.kind === 'bodyweight';
  if (exercise.timed)
    return bodyweight
      ? { exercise: exercise.id, scheme: '3x20-40s', progression: 'double' }
      : { exercise: exercise.id, scheme: '3x30s', progression: 'linear' };
  if (bodyweight) return { exercise: exercise.id, scheme: '3x8-12', progression: 'double' };
  return { exercise: exercise.id, scheme: '2x5+' };
}

export function addExercise(program: Program, dayIndex: number, exercise: Exercise): Program {
  return withDay(program, dayIndex, (slots) => [...slots, defaultSlot(exercise)]);
}

export type ProgressionChoice = 'amrap' | 'linear' | 'double' | 'ladder';
export interface ProgressionOption {
  model: ProgressionChoice;
  /** Why the exercise cannot use it; absent when it can. */
  disabled?: string;
}

const idsOf = (slot: Slot): string[] => (typeof slot.exercise === 'string' ? [slot.exercise] : slot.exercise);

/** What a slot can progress under. Bodyweight lifts only move by a rep range or a ladder, holds not by AMRAP. */
export function progressionOptions(slot: Slot, exercises: Record<string, Exercise>): ProgressionOption[] {
  const bodyweight = idsOf(slot).some((id) => exercises[id]?.kind === 'bodyweight');
  const timed = [slot.scheme, ...(slot.stages ?? [])].some(isTimed);
  const onlyDouble = 'Bodyweight exercises only progress with Double (a rep range) or a ladder.';
  return [
    {
      model: 'amrap',
      disabled: timed
        ? 'A hold cannot use AMRAP. Use Double (a range of seconds) or a ladder.'
        : bodyweight
          ? onlyDouble
          : undefined,
    },
    { model: 'linear', disabled: bodyweight ? onlyDouble : undefined },
    { model: 'double' },
    {
      model: 'ladder',
      disabled:
        typeof slot.exercise === 'string' ? undefined : 'A ladder cannot replace an alternating pair.',
    },
  ];
}

/** The model that moves a slot: its own, else the program's, else AMRAP. */
export const effectiveModel = (slot: Slot, rules: Rules): ProgressionModel =>
  slot.ladder !== undefined ? 'ladder' : (slot.progression ?? rules.progression ?? 'amrap');

/** Why a slot would never add weight or reps, or null when it can. */
export function stuckReason(slot: Slot, rules: Rules, exercises: Record<string, Exercise>): string | null {
  if (slot.ladder !== undefined) return null;
  const model = effectiveModel(slot, rules);
  if (!idsOf(slot).some((id) => exercises[id]?.kind === 'bodyweight')) return null;
  if (model === 'double' && isRange(slot.scheme)) return null;
  if (model === 'double')
    return 'Double needs a rep range, such as 3x8-12, to progress a bodyweight exercise.';
  return 'This bodyweight exercise will not progress under this rule. Choose Double with a rep range, or a ladder.';
}

/** Set a slot's progression model (not the ladder; use `setSlotLadder`). A choice its exercise cannot use is ignored. */
export function setSlotProgression(
  program: Program,
  dayIndex: number,
  slotIndex: number,
  model: Exclude<ProgressionChoice, 'ladder'>,
  exercises: Record<string, Exercise>,
): Program {
  const slot = program.days[dayIndex].slots[slotIndex];
  if (!slot || progressionOptions(slot, exercises).find((o) => o.model === model)?.disabled) return program;
  return withDay(program, dayIndex, (slots) =>
    slots.map((s, i) => {
      if (i !== slotIndex) return s;
      const { ladder: _ladder, ...rest } = s;
      const next: Slot = { ...rest, progression: model };
      return model === 'double' && !isRange(s.scheme) ? withScheme(next, toRange(s.scheme)) : next;
    }),
  );
}

/** Make a slot follow a ladder: it starts at the ladder's first step and keeps a range of reps or seconds. */
export function setSlotLadder(
  program: Program,
  dayIndex: number,
  slotIndex: number,
  ladderId: string,
): Program {
  const ladder = getLadder(ladderId);
  if (!ladder || !program.days[dayIndex]?.slots[slotIndex]) return program;
  return withDay(program, dayIndex, (slots) =>
    slots.map((s, i) => {
      if (i !== slotIndex) return s;
      const keep = isRange(s.scheme) && !isTimed(s.scheme);
      return {
        exercise: ladder.steps[0].exercise,
        scheme: ladder.steps[0].scheme ?? (keep ? s.scheme : '3x5-8'),
        progression: 'ladder',
        ladder: ladder.id,
        ...(s.group === undefined ? {} : { group: s.group }),
      };
    }),
  );
}

const GROUP_MIN: Record<GroupKind, number> = { superset: 2, circuit: 2, emom: 1, interval: 1 };
export const GROUP_LABELS: Record<GroupKind, string> = {
  superset: 'Superset',
  circuit: 'Circuit',
  emom: 'EMOM',
  interval: 'Interval',
};
export type GroupSettings = Pick<Group, 'rounds' | 'restS' | 'workS' | 'minutes'>;

/** Why these exercises cannot become a group of this kind, or null when they can. */
export function canGroup(day: Day, indices: number[], kind: GroupKind): string | null {
  const at = [...new Set(indices)].sort((a, b) => a - b);
  if (at.length === 0) return 'Select the exercises to group.';
  if (at.some((i) => day.slots[i]?.group !== undefined))
    return 'Some of these exercises are already in a group.';
  if (at[at.length - 1] - at[0] + 1 !== at.length) return 'The exercises must be next to each other.';
  const min = GROUP_MIN[kind];
  if (at.length < min) return `A ${GROUP_LABELS[kind]} needs at least ${min} exercises.`;
  return null;
}

/** Starting values that pass validation for `count` exercises. */
export function defaultGroupSettings(kind: GroupKind, count: number): GroupSettings {
  switch (kind) {
    case 'superset':
      return { restS: 90 };
    case 'circuit':
      return { rounds: 3, restS: 60 };
    case 'emom':
      return { minutes: count * Math.ceil(10 / count) };
    default:
      return { rounds: 8, workS: 30, restS: 15 };
  }
}

/** Only the settings the kind uses are kept. */
function settingsOf(kind: GroupKind, g: GroupSettings): GroupSettings {
  const pick = (keys: (keyof GroupSettings)[]): GroupSettings =>
    Object.fromEntries(keys.flatMap((k) => (g[k] === undefined ? [] : [[k, g[k]]])));
  if (kind === 'superset') return pick(['restS']);
  if (kind === 'circuit') return pick(['rounds', 'restS']);
  if (kind === 'emom') return pick(['minutes']);
  return pick(['rounds', 'workS', 'restS']);
}

const withSets = (scheme: Scheme, sets: number): Scheme => scheme.replace(/^\d+/, String(sets)) as Scheme;

/**
 * Circuits and intervals do one set per round and an EMOM one set per minute, so every exercise of the group
 * gets that many sets. Ladder steps carry their own sets, and minutes the exercises do not divide are left for
 * `validateProgram` to report.
 */
function conformSets(day: Day, group: Group): Day {
  const count = day.slots.filter((s) => s.group === group.id).length;
  const sets =
    group.kind === 'circuit' || group.kind === 'interval'
      ? group.rounds
      : group.kind === 'emom' && group.minutes !== undefined && count > 0 && group.minutes % count === 0
        ? group.minutes / count
        : undefined;
  if (sets === undefined || !(sets >= 1)) return day;
  return {
    ...day,
    slots: day.slots.map((s) =>
      s.group !== group.id || s.ladder !== undefined
        ? s
        : {
            ...s,
            scheme: withSets(s.scheme, sets),
            ...(s.stages ? { stages: s.stages.map((x) => withSets(x, sets)) } : {}),
          },
    ),
  };
}

/** Make the selected, consecutive exercises a group. A selection that cannot be grouped returns the same program. */
export function groupSlots(
  program: Program,
  dayIndex: number,
  indices: number[],
  kind: GroupKind,
  settings: GroupSettings,
): Program {
  const day = program.days[dayIndex];
  if (canGroup(day, indices, kind) !== null) return program;
  const used = new Set((day.groups ?? []).map((g) => g.id));
  let n = 1;
  while (used.has(`g${n}`)) n++;
  const group: Group = { id: `g${n}`, kind, ...settingsOf(kind, settings) };
  const at = new Set(indices);
  const next = clone(program);
  const target = next.days[dayIndex];
  target.slots = target.slots.map((s, i) => (at.has(i) ? { ...s, group: group.id } : s));
  target.groups = [...(target.groups ?? []), group];
  next.days[dayIndex] = conformSets(target, group);
  return next;
}

/** Change a group's rounds, rest, work time or minutes; the exercises' sets follow. */
export function updateGroup(
  program: Program,
  dayIndex: number,
  groupId: string,
  settings: GroupSettings,
): Program {
  const found = program.days[dayIndex].groups?.find((g) => g.id === groupId);
  if (!found) return program;
  const group: Group = {
    id: found.id,
    kind: found.kind,
    ...settingsOf(found.kind, { ...found, ...settings }),
  };
  const next = clone(program);
  const target = next.days[dayIndex];
  target.groups = (target.groups ?? []).map((g) => (g.id === groupId ? group : g));
  next.days[dayIndex] = conformSets(target, group);
  return next;
}

/** Take the exercises out of a group; their sets stay as they are. */
export function ungroup(program: Program, dayIndex: number, groupId: string): Program {
  const next = clone(program);
  const day = next.days[dayIndex];
  day.slots = day.slots.map((s) => {
    if (s.group !== groupId) return s;
    const { group: _group, ...rest } = s;
    return rest;
  });
  const groups = (day.groups ?? []).filter((g) => g.id !== groupId);
  if (groups.length > 0) day.groups = groups;
  else delete day.groups;
  return next;
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

export type SchemeMode = 'fixed' | 'lastAmrap' | 'allAmrap' | 'range' | 'timed' | 'timedRange';

export interface SchemeParts {
  sets: number;
  mode: SchemeMode;
  /** Reps, or seconds in the two timed modes. */
  reps: number;
  repsMax: number;
}

export const isTimedMode = (mode: SchemeMode): boolean => mode === 'timed' || mode === 'timedRange';

/** Break a scheme into the controls the scheme sheet edits. */
export function schemeParts(scheme: Scheme): SchemeParts {
  const parsed = tryParseScheme(scheme);
  if (!parsed) return { sets: 2, mode: 'lastAmrap', reps: 5, repsMax: 12 };
  if (parsed.reps === null) return { sets: parsed.sets, mode: 'allAmrap', reps: 5, repsMax: 12 };
  if (parsed.timed)
    return {
      sets: parsed.sets,
      mode: parsed.repsMax !== null ? 'timedRange' : 'timed',
      reps: parsed.reps,
      repsMax: parsed.repsMax ?? parsed.reps + 15,
    };
  if (parsed.repsMax !== null)
    return { sets: parsed.sets, mode: 'range', reps: parsed.reps, repsMax: parsed.repsMax };
  return {
    sets: parsed.sets,
    mode: parsed.amrap ? 'lastAmrap' : 'fixed',
    reps: parsed.reps,
    repsMax: Math.max(12, parsed.reps),
  };
}

/** Change the mode; crossing between reps and seconds restarts the numbers (30 s, 20-40 s, 5 reps, 8-12 reps). */
export function switchMode(parts: SchemeParts, mode: SchemeMode): SchemeParts {
  if (isTimedMode(parts.mode) === isTimedMode(mode)) return { ...parts, mode };
  if (isTimedMode(mode))
    return mode === 'timed'
      ? { ...parts, mode, reps: 30, repsMax: 45 }
      : { ...parts, mode, reps: 20, repsMax: 40 };
  return mode === 'range'
    ? { ...parts, mode, reps: 8, repsMax: 12 }
    : { ...parts, mode, reps: 5, repsMax: 12 };
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
    case 'timed':
      return `${sets}x${reps}s`;
    case 'timedRange':
      return `${sets}x${reps}-${Math.max(reps, repsMax)}s`;
    default:
      return `${sets}x${reps}`;
  }
}

/** "Superset · rest 90 s", "Circuit · 3 rounds · rest 60 s", "EMOM · 10 min", "Interval · 8 rounds · 30 s work · 15 s rest". */
export function groupLabel(g: Group): string {
  const parts: string[] = [GROUP_LABELS[g.kind]];
  if (g.rounds !== undefined) parts.push(`${g.rounds} ${g.rounds === 1 ? 'round' : 'rounds'}`);
  if (g.minutes !== undefined) parts.push(`${g.minutes} min`);
  if (g.workS !== undefined) parts.push(`${g.workS} s work`);
  if (g.restS !== undefined) parts.push(g.kind === 'interval' ? `${g.restS} s rest` : `rest ${g.restS} s`);
  return parts.join(' · ');
}

/** A new program: one empty day, three sessions a week and the default rules. */
export function blankProgram(): Program {
  return {
    template: 'custom',
    sessionsPerWeek: 3,
    rules: { ...DEFAULT_RULES },
    days: [{ name: 'Day 1', slots: [] }],
  };
}

/** The days and rules of a program or plan as a new custom program (no lifts, position or history). */
export function copyProgram(source: Pick<Program, 'days' | 'sessionsPerWeek' | 'rules'>): Program {
  const { days, sessionsPerWeek, rules } = clone(source as Program);
  return { template: 'custom', days, sessionsPerWeek, rules };
}
