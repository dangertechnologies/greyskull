import type { AppState, Exercise, Program, SessionLog } from './domain';
import { STORED_LIMITS, validateProgram } from './domain';
import { NULLABLE_USER_FIELDS, USER_FIELDS } from './domain/exerciseFields';
import { isReservedKey } from './domain/own';
import { NEWER_VERSION_ERROR } from './storage';
import type { OneProgramState } from './store';
import {
  isEquipment,
  migratePersisted,
  repairStored,
  restoreExercises,
  STORE_VERSION,
  stateProblem,
  upgradeOneProgramState,
  withNextSession,
} from './store';

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

/** The largest backup read or parsed: a real one is a few MB at most, even with years of workouts. */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export const BACKUP_TOO_LARGE = `That file is too large to be a backup (the limit is ${MAX_BACKUP_BYTES / 1024 / 1024} MB).`;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const KINDS = ['barbell', 'bodyweight', 'dumbbell', 'machine', 'kettlebell'];
const reserved = (map: Record<string, unknown>): boolean => Object.keys(map).some(isReservedKey);
/** A lift key is an exercise id or ladder id, optionally `<id>@tier`; neither part may be a name every object has. */
const saneLiftKey = (k: unknown): boolean =>
  typeof k === 'string' && k.length > 0 && k.length <= 100 && !k.split('@').some(isReservedKey);

/** An ISO 8601 date-time the app can compare and sort by time (`toISOString` output and its time-zone forms). */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/;
export const isIsoDate = (v: unknown): v is string =>
  typeof v === 'string' && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v));

function badSession(s: unknown): string | null {
  // An id that is missing, broken or repeated is renumbered (`normaliseSessionIds`), never refused.
  if (!isObject(s) || typeof s.startedAt !== 'string') return 'a session is malformed';
  if (!isIsoDate(s.startedAt) || (s.finishedAt !== undefined && !isIsoDate(s.finishedAt)))
    return `session ${String(s.n)} has a date that is not a date and time`;
  if (!isObject(s.results) || !Array.isArray(s.order) || reserved(s.results))
    return `session ${String(s.n)} is malformed`;
  // The app reads `results[id]` for every id in the order, so each one must be a result of its own.
  if (s.order.some((id) => typeof id !== 'string' || !Object.hasOwn(s.results as object, id)))
    return `session ${String(s.n)} lists an exercise that has no result`;
  for (const r of Object.values(s.results)) {
    if (!isObject(r) || !isNum(r.weightKg) || !Array.isArray(r.sets))
      return `session ${String(s.n)} has a bad result`;
    if (r.skipped !== undefined && r.skipped !== true) return `session ${String(s.n)} has a bad result`;
    if (r.lift !== undefined && !saneLiftKey(r.lift)) return `session ${String(s.n)} has a bad lift key`;
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
  !Object.keys(lifts).every(saneLiftKey) ||
  Object.values(lifts).some(
    (l) =>
      !isObject(l) ||
      !isNum(l.weightKg) ||
      l.weightKg < 0 ||
      (l.stage !== undefined && (!Number.isInteger(l.stage) || (l.stage as number) < 0)) ||
      (l.touchedAt !== undefined && typeof l.touchedAt !== 'string'),
  );

/**
 * Parse and validate a backup produced by "Export backup" (an AppState snapshot), or the app's own data file
 * (`state.json` or one of its kept copies, the snapshot inside `{ state, version }`). Nothing is written: the
 * caller decides whether to apply it. Backups with one program (`version` 2) are converted like stored data
 * from that version; missing newer fields fall back to defaults.
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
  if (raw.length > MAX_BACKUP_BYTES) return { ok: false, error: BACKUP_TOO_LARGE };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return { ok: false, error: 'That is not valid JSON.' };
  }
  // The data file: store versions before 4 held one program, as a version 2 backup does.
  if (isObject(parsed) && isObject(parsed.state) && typeof parsed.version === 'number') {
    if (parsed.version > STORE_VERSION) return { ok: false, error: NEWER_VERSION_ERROR };
    parsed = { ...parsed.state, version: parsed.version < 4 ? 2 : 3 };
  }
  if (!isObject(parsed) || (parsed.version !== 2 && parsed.version !== 3))
    return { ok: false, error: 'This is not a Greyskull v2 backup.' };
  // The user's own data: what an older version let them save is filled in or loaded as it is (see `repairStored`).
  const data = repairStored(parsed);
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
  for (const [key, e] of Object.entries(data.exercises)) {
    // A stored built-in marks a user field it switched off as `null`; fields that always have a value cannot be.
    const nullable = NULLABLE_USER_FIELDS as readonly string[];
    if (
      !isObject(e) ||
      typeof e.id !== 'string' ||
      typeof e.name !== 'string' ||
      e.id !== key ||
      isReservedKey(key) ||
      (e.kind !== undefined && !KINDS.includes(e.kind as never)) ||
      [
        e.pattern,
        e.level,
        e.pictogram,
        e.background,
        e.icon,
        ...[e.equipment, e.muscles, e.secondary].flat(),
      ].some((v) => typeof v === 'string' && isReservedKey(v)) ||
      USER_FIELDS.some((f) => e[f] === null && !nullable.includes(f))
    ) {
      return { ok: false, error: 'An exercise is malformed.' };
    }
  }
  if (data.equipment !== undefined && !(Array.isArray(data.equipment) && data.equipment.every(isEquipment)))
    return { ok: false, error: 'The equipment list in the backup is invalid.' };
  const problem = stateProblem(data);
  if (problem) return { ok: false, error: `The backup is damaged: ${problem.replace(/\.$/, '')}.` };

  // A half-finished workout is not worth restoring across devices.
  const converted = withNextSession(
    onePlan
      ? upgradeOneProgramState({ ...(data as unknown as OneProgramState), draft: null })
      : migratePersisted({ ...data, draft: null }, 4),
  );
  // Built-ins come from this app's catalog with the user's own fields from the backup on top (a one-program
  // backup's built-ins were refreshed by the conversion, so their stale content does not count as the user's).
  const state: AppState = { ...converted, exercises: restoreExercises(converted.exercises) };

  const programs: Program[] = [...state.programs, ...state.customPlans.map((p) => p.program)];
  for (const program of programs) {
    if (!isObject(program) || !Array.isArray(program.days)) {
      return { ok: false, error: 'The program in the backup is invalid: it has no days' };
    }
    const errors = validateProgram(program, state.exercises, STORED_LIMITS);
    if (errors.length > 0) return { ok: false, error: `The program in the backup is invalid: ${errors[0]}` };
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
