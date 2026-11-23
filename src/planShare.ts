import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { CustomPlan, Equipment, Exercise, Kind, Muscle, Pattern, Program } from './domain';
import { exerciseIdsOf, parseProgram, validateProgram } from './domain';
import { linkProblem } from './exerciseEdit';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, PATTERN_LABELS } from './exerciseFilter';
import { customId } from './exerciseId';
import { uniqueProgramName } from './programPicker';

export const PLAN_FORMAT = 'greyskull-plan';
export const PLAN_VERSION = 1;
/** An import larger than this is refused before it is parsed. A full 14-day plan is well under 100 kB. */
export const MAX_IMPORT_CHARS = 200_000;
const MAX_EXERCISES = 100;
const MAX_TEXT = 100;
const MAX_LONG_TEXT = 2000;
const MAX_FORM_LINES = 20;
const MAX_FORM_LINE = 300;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max = MAX_TEXT): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const amount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
const KINDS: Kind[] = ['barbell', 'bodyweight', 'dumbbell', 'machine', 'kettlebell'];
const LEVELS = ['beginner', 'intermediate', 'expert'] as const;

/** Every field of an exercise that travels in a shared plan (and nothing else does). */
const FIELDS: (keyof Exercise)[] = [
  'name',
  'shortName',
  'abbr',
  'kind',
  'increment',
  'step',
  'barKg',
  'description',
  'goodForm',
  'badForm',
  'url',
  'video',
  'equipment',
  'muscles',
  'secondary',
  'pattern',
  'level',
  'timed',
];

class Refused extends Error {}
function must(ok: boolean, message: string): asserts ok {
  if (!ok) throw new Refused(message);
}

const pair = (v: unknown, where: string): { kg: number; lb: number } => {
  must(isObject(v) && amount(v.kg) && amount(v.lb), `${where} is not a weight.`);
  return { kg: v.kg as number, lb: v.lb as number };
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
  must(Array.isArray(v) && v.length <= MAX_FORM_LINES, `${where} is not a short list.`);
  must(
    v.every((x) => typeof x === 'string' && x.length <= MAX_FORM_LINE),
    `${where} has a line that is too long.`,
  );
  return v as string[];
};

/** An exercise from a file, rebuilt from the known fields. Throws `Refused` with the reason. */
function exerciseFrom(v: unknown, n: number): Exercise {
  const label = `Exercise ${n + 1}`;
  must(isObject(v), `${label} is not an exercise.`);
  must(text(v.id), `${label} has no id.`);
  must(text(v.name), `${label} has no name (at most ${MAX_TEXT} letters).`);
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
  if (v.step !== undefined) out.step = pair(v.step, `${where}: step`);
  if (v.barKg !== undefined) out.barKg = pair(v.barKg, `${where}: bar`);
  if (v.description !== undefined) {
    must(
      typeof v.description === 'string' && v.description.length <= MAX_LONG_TEXT,
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

const sameExercise = (a: Exercise, b: Exercise): boolean =>
  FIELDS.every((f) => JSON.stringify(a[f] ?? null) === JSON.stringify(b[f] ?? null));

/** The plan as a JSON string, with the custom exercises it uses. Built-in exercises are not included. */
export function exportPlan(plan: CustomPlan, exercises: Record<string, Exercise>): string {
  const used = exerciseIdsOf(plan.program)
    .map((id) => exercises[id])
    .filter((e): e is Exercise => e?.custom === true);
  return JSON.stringify({ format: PLAN_FORMAT, version: PLAN_VERSION, plan, exercises: used }, null, 2);
}

export type ImportResult =
  | { ok: true; plan: CustomPlan; exercises: Exercise[]; renamed: { from: string; to: string }[] }
  | { ok: false; error: string };

/** A fresh plan id that is not in `taken`. */
export function newPlanId(taken: string[]): string {
  for (;;) {
    const id = `plan_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    if (!taken.includes(id)) return id;
  }
}

const ID = /^custom_[a-z0-9_]{1,80}$/;

/** The program with custom exercise ids replaced (slots, lift keys and per-exercise increments). */
function rewrite(program: Program, map: Map<string, string>): Program {
  if (map.size === 0) return program;
  const swap = (id: string) => map.get(id) ?? id;
  const swapLift = (key: string) => {
    const [id, ...rest] = key.split('@');
    return [swap(id), ...rest].join('@');
  };
  return {
    ...program,
    rules: {
      ...program.rules,
      ...(program.rules.increments
        ? {
            increments: Object.fromEntries(
              Object.entries(program.rules.increments).map(([k, v]) => [swap(k), v]),
            ),
          }
        : {}),
    },
    days: program.days.map((day) => ({
      ...day,
      slots: day.slots.map((s) => ({
        ...s,
        exercise:
          typeof s.exercise === 'string' ? swap(s.exercise) : (s.exercise.map(swap) as [string, string]),
        ...(s.lift === undefined ? {} : { lift: swapLift(s.lift) }),
      })),
    })),
  };
}

/**
 * Read a shared plan. Nothing is saved: the caller adds `exercises` and then saves `plan`. A custom exercise
 * you already have is reused; one with the same id but different content (or an id that is a built-in's) gets a
 * new id, and the plan is rewritten to match.
 */
export function importPlan(
  raw: string,
  have: { exercises: Record<string, Exercise>; customPlans: CustomPlan[] },
): ImportResult {
  try {
    return read(raw, have);
  } catch (e) {
    if (e instanceof Refused) return { ok: false, error: e.message };
    return {
      ok: false,
      error: `This program could not be read: ${e instanceof Error ? e.message : String(e)}.`,
    };
  }
}

function read(
  raw: string,
  have: { exercises: Record<string, Exercise>; customPlans: CustomPlan[] },
): ImportResult {
  must(
    raw.length <= MAX_IMPORT_CHARS,
    `This is too large to be a program (the limit is ${MAX_IMPORT_CHARS / 1000} kB).`,
  );
  must(raw.trim().length > 0, 'There is nothing to import: the text is empty.');
  let data: unknown;
  try {
    data = JSON.parse(raw.trim());
  } catch {
    throw new Refused('That is not valid JSON. Paste the whole text of a shared program.');
  }
  must(isObject(data) && data.format === PLAN_FORMAT, 'This is not a Greyskull program.');
  must(
    typeof data.version === 'number' && data.version <= PLAN_VERSION,
    'This program was made by a newer version of Greyskull. Update the app to open it.',
  );
  must(isObject(data.plan), 'The file has no program in it (plan).');
  const { plan } = data;
  must(text(plan.name), `The program needs a name (at most ${MAX_TEXT} letters).`);
  must(plan.summary === undefined || text(plan.summary, 300), 'The summary is too long.');
  must(
    Array.isArray(data.exercises) && data.exercises.length <= MAX_EXERCISES,
    `The list of exercises is invalid (at most ${MAX_EXERCISES}).`,
  );

  const parsed = parseProgram(plan.program);
  must(parsed.ok, `The program is invalid: ${parsed.ok ? '' : parsed.error}`);
  const incoming = data.exercises.map(exerciseFrom);

  const catalog: Record<string, Exercise> = { ...have.exercises };
  const added: Exercise[] = [];
  const map = new Map<string, string>();
  for (const e of incoming) {
    const clash = Object.hasOwn(catalog, e.id) ? catalog[e.id] : undefined;
    if (clash?.custom && sameExercise(clash, e)) continue;
    if (!clash && ID.test(e.id)) {
      catalog[e.id] = e;
      added.push(e);
      continue;
    }
    const id = customId(e.name, catalog);
    map.set(e.id, id);
    catalog[id] = { ...e, id };
    added.push({ ...e, id });
  }

  // A saved plan never poses as a built-in one, and never carries the history offset of another install.
  const { startN: _startN, ...rest } = rewrite(parsed.program, map);
  const program: Program = { ...rest, template: 'custom' };
  const errors = validateProgram(program, catalog);
  must(
    errors.length === 0,
    `The program is not valid: ${errors.slice(0, 3).join(' ')}${errors.length > 3 ? ` (and ${errors.length - 3} more)` : ''}`,
  );

  const name = uniqueProgramName(
    (plan.name as string).trim(),
    have.customPlans.map((p) => p.name),
  );
  return {
    ok: true,
    plan: {
      id: newPlanId(have.customPlans.map((p) => p.id)),
      name,
      ...(text(plan.summary, 300) ? { summary: (plan.summary as string).trim() } : {}),
      program,
    },
    exercises: added,
    renamed: [...map].map(([from, to]) => ({ from, to })),
  };
}

const fileName = (name: string): string =>
  `greyskull-${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'program'
  }.json`;

/** Open the share sheet with the plan as a .json file. Resolves false when sharing is not available. */
export async function sharePlan(plan: CustomPlan, exercises: Record<string, Exercise>): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const file = new File(Paths.cache, fileName(plan.name));
  await file.write(exportPlan(plan, exercises));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: `Share ${plan.name}`,
  });
  return true;
}

export const copyPlan = (plan: CustomPlan, exercises: Record<string, Exercise>): Promise<boolean> =>
  Clipboard.setStringAsync(exportPlan(plan, exercises));
