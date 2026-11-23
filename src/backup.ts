import type { AppState, Exercise, Program, SessionLog } from './domain';
import { tryParseScheme, validateProgram } from './domain';
import type { OneProgramState } from './store';
import { migratePersisted, restoreExercises, stateProblem, upgradeOneProgramState } from './store';

export interface BackupSummary {
  sessions: number;
  exercises: number;
  custom: number;
  planName: string | null;
  lastSession: string | null;
}

export type BackupResult =
  | { ok: true; state: AppState; summary: BackupSummary }
  | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function badSession(s: unknown): string | null {
  if (!isObject(s) || !isNum(s.n) || typeof s.startedAt !== 'string') return 'a session is malformed';
  if (!isObject(s.results) || !Array.isArray(s.order)) return `session ${String(s.n)} is malformed`;
  for (const r of Object.values(s.results)) {
    if (!isObject(r) || !isNum(r.weightKg) || !Array.isArray(r.sets))
      return `session ${String(s.n)} has a bad result`;
    for (const set of r.sets) {
      if (
        !isObject(set) ||
        !isNum(set.reps) ||
        !(set.target === null || isNum(set.target)) ||
        (set.kg !== undefined && (!isNum(set.kg) || set.kg < 0))
      ) {
        return `session ${String(s.n)} has a bad set`;
      }
    }
  }
  return null;
}

const badLifts = (lifts: unknown): boolean =>
  !isObject(lifts) ||
  Object.values(lifts).some(
    (l) =>
      !isObject(l) ||
      !isNum(l.weightKg) ||
      l.weightKg < 0 ||
      (l.stage !== undefined && (!Number.isInteger(l.stage) || (l.stage as number) < 0)) ||
      (l.touchedAt !== undefined && typeof l.touchedAt !== 'string'),
  );

/**
 * Parse and validate a backup produced by "Export backup" (an AppState snapshot). Nothing is written:
 * the caller decides whether to apply it. Backups with one program (`version` 2) are converted like stored
 * data from that version; missing newer fields fall back to defaults.
 */
export function parseBackup(raw: string): BackupResult {
  try {
    return parse(raw);
  } catch (e) {
    // Every structural check should catch damage first; this keeps a missed case from crashing the import.
    return { ok: false, error: `The backup is damaged: ${e instanceof Error ? e.message : String(e)}.` };
  }
}

function parse(raw: string): BackupResult {
  let data: unknown;
  try {
    data = JSON.parse(raw.trim());
  } catch {
    return { ok: false, error: 'That is not valid JSON.' };
  }
  if (!isObject(data) || (data.version !== 2 && data.version !== 3))
    return { ok: false, error: 'This is not a Greyskull v2 backup.' };
  const onePlan = data.version === 2;
  if (
    !isObject(data.exercises) ||
    !Array.isArray(data.sessions) ||
    (onePlan ? !isObject(data.lifts) : !Array.isArray(data.programs))
  ) {
    return { ok: false, error: 'The backup is missing exercises, lifts or sessions.' };
  }
  if (!isNum(data.nextSession) || (data.unit !== 'kg' && data.unit !== 'lb') || !isObject(data.inventory)) {
    return { ok: false, error: 'The backup is missing basic settings.' };
  }
  for (const s of data.sessions) {
    const problem = badSession(s);
    if (problem) return { ok: false, error: `The backup is damaged: ${problem}.` };
  }
  if (
    !onePlan &&
    ((data.customPlans !== undefined && !Array.isArray(data.customPlans)) ||
      (data.programs as unknown[]).some(
        (p) =>
          !isObject(p) ||
          typeof p.id !== 'string' ||
          !Number.isInteger(p.position) ||
          (p.position as number) < 0,
      ))
  ) {
    return { ok: false, error: 'The program in the backup is invalid: it has no id or position' };
  }
  const liftSets = onePlan
    ? [data.lifts]
    : (data.programs as unknown[]).map((p) => (isObject(p) ? p.lifts : undefined));
  // 0 kg is valid: bodyweight and ladder lifts carry no weight.
  if (liftSets.some(badLifts)) return { ok: false, error: 'A lift weight is invalid.' };
  for (const e of Object.values(data.exercises)) {
    if (!isObject(e) || typeof e.id !== 'string' || typeof e.name !== 'string') {
      return { ok: false, error: 'An exercise is malformed.' };
    }
  }
  const problem = stateProblem(data);
  if (problem) return { ok: false, error: `The backup is damaged: ${problem}.` };

  // A half-finished workout is not worth restoring across devices.
  const converted = onePlan
    ? upgradeOneProgramState({ ...(data as unknown as OneProgramState), draft: null })
    : migratePersisted({ ...data, draft: null }, 4);
  // Built-ins come from this app's catalog with the user's own fields from the backup on top (a one-program
  // backup's built-ins were refreshed by the conversion, so their stale content does not count as the user's).
  const state: AppState = { ...converted, exercises: restoreExercises(converted.exercises) };

  const programs: Program[] = [...state.programs, ...state.customPlans.map((p) => p.program)];
  for (const program of programs) {
    if (!isObject(program) || !Array.isArray(program.days)) {
      return { ok: false, error: 'The program in the backup is invalid: it has no days' };
    }
    const errors = validateProgram(program, state.exercises);
    const schemes = program.days.flatMap((d) => d.slots.map((s) => s.scheme));
    if (errors.length > 0 || schemes.some((s) => !tryParseScheme(s))) {
      return { ok: false, error: `The program in the backup is invalid: ${errors[0] ?? 'unknown scheme'}` };
    }
  }

  const done = state.sessions.filter((s: SessionLog) => !s.skipped);
  const last = done[done.length - 1];
  return {
    ok: true,
    state,
    summary: {
      sessions: done.length,
      exercises: Object.keys(state.exercises).length,
      custom: Object.values(state.exercises).filter((e: Exercise) => e.custom).length,
      planName: state.programs[0]?.template ?? null,
      lastSession: last?.finishedAt ?? last?.startedAt ?? null,
    },
  };
}
