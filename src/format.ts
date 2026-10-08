import type { Exercise, SessionLog } from './domain';
import { formatWeight } from './domain';
import type { Unit } from './domain';

export const weekOf = (n: number, sessionsPerWeek: number): number => Math.floor(n / sessionsPerWeek) + 1;

/** Exercise name that survives a deleted custom exercise (history keeps the id). */
export const nameOf = (exercises: Record<string, Exercise>, id: string, short = false): string => {
  const e = exercises[id];
  return e ? (short ? e.shortName : e.name) : id;
};

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Squat 62.5 kg × 8" style summary of a finished session. */
export function summarize(log: SessionLog, exercises: Record<string, Exercise>, unit: Unit): string {
  if (log.skipped) return 'Skipped';
  return log.order
    .map((id) => {
      const r = log.results[id];
      if (!r) return null;
      const last = r.sets[r.sets.length - 1];
      const weight = exercises[id]?.kind === 'bodyweight' ? '' : ` ${formatWeight(r.weightKg, unit)}`;
      return `${nameOf(exercises, id, true)}${weight} × ${last?.reps ?? 0}`;
    })
    .filter((s): s is string => s !== null)
    .join(' · ');
}
