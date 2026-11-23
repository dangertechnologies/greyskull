import type { ActiveProgram, Exercise, Scheme, SessionLog, Unit } from './domain';
import { formatWeight, own, setTargets, tryParseScheme } from './domain';

export const weekOf = (n: number, sessionsPerWeek: number): number => Math.floor(n / sessionsPerWeek) + 1;

/** "Week 3", or "Cycle 2 · Week 1" for 5/3/1 (its week is a pass through the days, not sessionsPerWeek). */
export function weekLabel(program: Pick<ActiveProgram, 'days' | 'sessionsPerWeek' | 'position'>): string {
  const n = Math.max(0, program.position);
  if (!program.days.some((d) => d.slots.some((slot) => slot.progression === '531')))
    return `Week ${weekOf(n, program.sessionsPerWeek)}`;
  const week = Math.floor(n / program.days.length);
  return `Cycle ${Math.floor(week / 3) + 1} · Week ${(week % 3) + 1}`;
}

/**
 * The program position a history entry was at, or null when it belongs to another program. Entries from before
 * several programs could run at once carry no program id: they count for the program moved from that time
 * (which kept its `startN`) at `n - startN`.
 */
export function logPosition(log: SessionLog, program: Pick<ActiveProgram, 'id' | 'startN'>): number | null {
  if (log.programId !== undefined) return log.programId === program.id ? (log.position ?? null) : null;
  if (program.startN === undefined || log.n < program.startN) return null;
  return log.n - program.startN;
}

/** Whether a workout belongs to a program: by its program id, or for old history by the program's start. */
export const belongsTo = (log: SessionLog, program: Pick<ActiveProgram, 'id' | 'startN'>): boolean =>
  log.programId !== undefined ? log.programId === program.id : logPosition(log, program) !== null;

/** Exercise name that survives a deleted custom exercise (history keeps the id). */
export const nameOf = (exercises: Record<string, Exercise>, id: string, short = false): string => {
  const e = own(exercises, id);
  return e ? (short ? e.shortName : e.name) : id;
};

export function liftLabel(key: string, exercises: Record<string, Exercise>): string {
  const [id, suffix] = key.split('@');
  return `${nameOf(exercises, id)}${suffix ? ` (${suffix})` : ''}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Squat 62.5 kg × 8" style summary of a finished session. */
export function summarize(log: SessionLog, exercises: Record<string, Exercise>, unit: Unit): string {
  if (log.skipped) return 'Skipped';
  return log.order
    .map((id) => {
      const r = own(log.results, id);
      if (!r) return null;
      const last = r.sets[r.sets.length - 1];
      const seconds = r.timed ? ' s' : '';
      return `${nameOf(exercises, id, true)}${weightLabel(r.weightKg, own(exercises, id), unit)} × ${last?.reps ?? 0}${seconds}`;
    })
    .filter((s): s is string => s !== null)
    .join(' · ');
}

/**
 * " 62.5 kg" for a weight, " +10 kg" for a bodyweight exercise's added load, "" for bodyweight alone (leading
 * space included, so it follows a name directly).
 */
export function weightLabel(kg: number, exercise: Exercise | undefined, unit: Unit): string {
  if (exercise?.kind !== 'bodyweight') return ` ${formatWeight(kg, unit)}`;
  return kg > 0 ? ` +${formatWeight(kg, unit)}` : '';
}

/** "2x5+", for a rep range the current target: "2×9 (8–12)"; holds in seconds: "3×30 s", "3×15 s (10–30 s)". */
export function schemeLabel(scheme: Scheme, liftReps?: number): string {
  const parsed = tryParseScheme(scheme);
  if (!parsed || parsed.reps === null) return scheme;
  const s = parsed.timed ? ' s' : '';
  if (parsed.repsMax === null) return parsed.timed ? `${parsed.sets}×${parsed.reps}${s}` : scheme;
  const [target] = setTargets(scheme, liftReps);
  return `${parsed.sets}×${target}${s} (${parsed.reps}–${parsed.repsMax}${s})`;
}

/** "Light day · 80 %" for reduced-intensity days, else null. */
export const intensityLabel = (dayName: string, intensity: number): string | null =>
  intensity < 1 ? `${dayName} day · ${Math.round(intensity * 100)} %` : null;
