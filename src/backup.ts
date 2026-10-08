import type { AppState, Exercise, SessionLog } from './domain';
import { tryParseScheme, validateProgram } from './domain';
import { initialState } from './store';

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
      if (!isObject(set) || !isNum(set.reps) || !(set.target === null || isNum(set.target))) {
        return `session ${String(s.n)} has a bad set`;
      }
    }
  }
  return null;
}

/**
 * Parse and validate a backup produced by "Export backup" (an AppState snapshot). Nothing is written:
 * the caller decides whether to apply it. Missing newer fields fall back to defaults so backups from
 * earlier v2 builds still import.
 */
export function parseBackup(raw: string): BackupResult {
  let data: unknown;
  try {
    data = JSON.parse(raw.trim());
  } catch {
    return { ok: false, error: 'That is not valid JSON.' };
  }
  if (!isObject(data) || data.version !== 2)
    return { ok: false, error: 'This is not a Greyskull v2 backup.' };
  if (!isObject(data.exercises) || !Array.isArray(data.sessions) || !isObject(data.lifts)) {
    return { ok: false, error: 'The backup is missing exercises, lifts or sessions.' };
  }
  if (!isNum(data.nextSession) || (data.unit !== 'kg' && data.unit !== 'lb') || !isObject(data.inventory)) {
    return { ok: false, error: 'The backup is missing basic settings.' };
  }
  for (const s of data.sessions) {
    const problem = badSession(s);
    if (problem) return { ok: false, error: `The backup is damaged: ${problem}.` };
  }
  for (const l of Object.values(data.lifts)) {
    if (!isObject(l) || !isNum(l.weightKg) || !(l.weightKg > 0))
      return { ok: false, error: 'A lift weight is invalid.' };
  }
  for (const e of Object.values(data.exercises)) {
    if (!isObject(e) || typeof e.id !== 'string' || typeof e.name !== 'string') {
      return { ok: false, error: 'An exercise is malformed.' };
    }
  }

  const base = initialState();
  const state = { ...base, ...(data as unknown as AppState) } as AppState;
  // Built-ins missing from the backup (older catalog) are added; the backup's own entries win.
  state.exercises = { ...base.exercises, ...state.exercises };
  state.inventory = { ...base.inventory, ...state.inventory };
  state.draft = null; // a half-finished workout is not worth restoring across devices

  if (state.program) {
    const errors = validateProgram(state.program, state.exercises);
    const schemes = state.program.days.flatMap((d) => d.slots.map((s) => s.scheme));
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
      planName: state.program?.template ?? null,
      lastSession: last?.finishedAt ?? last?.startedAt ?? null,
    },
  };
}
