import type { Exercise, SessionLog } from './domain';
import { formatWeight, setTargets, toUnit, trim, tryParseScheme } from './domain';
import type { Outcome, Scheme, Unit } from './domain';

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

/** "Overhead press 20 → 22.5 kg ↑", "Squat 100 → 100 kg (1 fail)"; null for lifts that do not change. */
export function outcomeLine(name: string, fromKg: number, outcome: Outcome, unit: Unit): string | null {
  if (outcome.change === 'none') return null;
  const from = trim(toUnit(fromKg, unit));
  const to = trim(toUnit(outcome.next.weightKg, unit));
  const head = `${name} ${from} → ${to} ${unit}`;
  switch (outcome.change) {
    case 'up':
      return `${head} ↑`;
    case 'double':
      return `${head} ↑↑`;
    case 'deload':
      return `${head} ↓ (deload)`;
    case 'reps':
      return `${name} ${from} ${unit}: one more rep next time (${outcome.next.reps})`;
    case 'same':
      return `${head} (${outcome.next.fails} ${outcome.next.fails === 1 ? 'fail' : 'fails'})`;
  }
}

/** "2x5+", or for a rep range the current target: "2×9 (8–12)". */
export function schemeLabel(scheme: Scheme, liftReps?: number): string {
  const parsed = tryParseScheme(scheme);
  if (!parsed || parsed.repsMax === null || parsed.reps === null) return scheme;
  const [target] = setTargets(scheme, liftReps);
  return `${parsed.sets}×${target} (${parsed.reps}–${parsed.repsMax})`;
}

/** "Light day · 80 %" for reduced-intensity days, else null. */
export const intensityLabel = (dayName: string, intensity: number): string | null =>
  intensity < 1 ? `${dayName} day · ${Math.round(intensity * 100)} %` : null;
