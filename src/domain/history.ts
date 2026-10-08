import type { SessionLog } from './types';

export interface LastResult {
  n: number;
  date: string;
  weightKg: number;
  /** Reps of every set, in order. */
  reps: number[];
}

/** Light/medium days and skipped sessions are not comparable with working-weight sessions. */
const comparable = (log: SessionLog): boolean => !log.skipped && (log.intensity ?? 1) >= 1;

/** The most recent earlier working-weight result for a lift (before session `beforeN` when given). */
export function lastResult(sessions: SessionLog[], exerciseId: string, beforeN?: number): LastResult | null {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const log = sessions[i];
    const result = log.results[exerciseId];
    if (!comparable(log) || !result || (beforeN !== undefined && log.n >= beforeN)) continue;
    return {
      n: log.n,
      date: log.finishedAt ?? log.startedAt,
      weightKg: result.weightKg,
      reps: result.sets.map((s) => s.reps),
    };
  }
  return null;
}

/**
 * A personal record: more weight than ever before, or the same weight for more last-set reps. The very first
 * session of a lift is never a PR (there is nothing to beat). Weights compare with a 1 g tolerance.
 */
export function isPersonalRecord(
  sessions: SessionLog[],
  exerciseId: string,
  weightKg: number,
  lastSetReps: number,
): boolean {
  let seen = false;
  let heaviest = 0;
  let bestRepsAtWeight = 0;
  for (const log of sessions) {
    const result = log.results[exerciseId];
    if (!comparable(log) || !result) continue;
    seen = true;
    heaviest = Math.max(heaviest, result.weightKg);
  }
  if (!seen) return false;
  for (const log of sessions) {
    const result = log.results[exerciseId];
    if (!comparable(log) || !result || Math.abs(result.weightKg - weightKg) > 1e-3) continue;
    bestRepsAtWeight = Math.max(bestRepsAtWeight, result.sets.at(-1)?.reps ?? 0);
  }
  if (weightKg > heaviest + 1e-3) return true;
  return Math.abs(weightKg - heaviest) <= 1e-3 && lastSetReps > bestRepsAtWeight;
}
