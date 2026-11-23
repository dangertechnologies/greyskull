import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { CustomPlan, Exercise, Program } from './domain';
import { exerciseIdsOf, own, parseProgram, validateProgram } from './domain';
import { sanitizeExercise } from './domain/sanitizeExercise';
import { customId } from './exerciseId';
import { uniqueProgramName } from './programPicker';

export const PLAN_FORMAT = 'greyskull-plan';
export const PLAN_VERSION = 1;
/** An import larger than this is refused before it is parsed. A full 14-day plan is well under 100 kB. */
export const MAX_IMPORT_CHARS = 200_000;
const MAX_EXERCISES = 100;
const MAX_TEXT = 100;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max = MAX_TEXT): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;

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

/** An exercise from a file, rebuilt from the known fields. Throws `Refused` with the reason. */
function exerciseFrom(v: unknown, n: number): Exercise {
  const r = sanitizeExercise(v, `Exercise ${n + 1}`);
  must(r.ok, r.ok ? '' : r.error);
  return r.exercise;
}

const sameExercise = (a: Exercise, b: Exercise): boolean =>
  FIELDS.every((f) => JSON.stringify(a[f] ?? null) === JSON.stringify(b[f] ?? null));

/** The plan as a JSON string, with the custom exercises it uses. Built-in exercises are not included. */
export function exportPlan(plan: CustomPlan, exercises: Record<string, Exercise>): string {
  const used = exerciseIdsOf(plan.program)
    .map((id) => own(exercises, id))
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
    typeof data.version === 'number' && Number.isInteger(data.version) && data.version >= 1,
    'This file has no valid version number.',
  );
  must(
    data.version <= PLAN_VERSION,
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
  // A file may list an exercise once, and only the ones the program uses are read and added.
  const listed = data.exercises.flatMap((e) => (isObject(e) && typeof e.id === 'string' ? [e.id] : []));
  const twice = listed.find((id, i) => listed.indexOf(id) !== i);
  must(twice === undefined, `The file lists the exercise ${twice} twice.`);
  const used = new Set(exerciseIdsOf(parsed.program));
  const incoming = data.exercises
    .map((e, n) => ({ e, n }))
    .filter(({ e }) => isObject(e) && typeof e.id === 'string' && used.has(e.id))
    .map(({ e, n }) => exerciseFrom(e, n));

  const catalog: Record<string, Exercise> = { ...have.exercises };
  const added: Exercise[] = [];
  const map = new Map<string, string>();
  for (const e of incoming) {
    const clash = Object.hasOwn(catalog, e.id) ? catalog[e.id] : undefined;
    if (clash?.custom && !clash.archived && sameExercise(clash, e)) continue;
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
