import type { Group } from '../domain';

/**
 * Where an EMOM or interval timer is, worked out from timestamps only: when it started, when it was paused and
 * resumed, how far Skip jumped ahead and when it was ended. Nothing counts ticks, so a relaunch or a suspended
 * app lands on the same minute. Every function takes the time as an argument (milliseconds since the epoch).
 */
export interface TimerAnchor {
  startedAt: number;
  pauses: { from: number; to?: number }[];
  /** Milliseconds Skip jumped ahead. */
  skipMs: number;
  endedAt?: number;
}

/** `steps` sets, each `workS` of work then `restS` of rest (an EMOM: 60 s of work, no rest). */
export interface TimerPlan {
  steps: number;
  workS: number;
  restS: number;
}

export interface TimerPosition {
  /** Index of the current set among the group's sets (the minute of an EMOM, the round of an interval). */
  step: number;
  phase: 'work' | 'rest';
  /** Whole seconds to the next boundary (rounded up). */
  remainingS: number;
  /** Length of the current phase. */
  phaseS: number;
  done: boolean;
}

export const planOf = (group: Group, steps: number): TimerPlan =>
  group.kind === 'emom'
    ? { steps, workS: 60, restS: 0 }
    : { steps, workS: group.workS ?? 0, restS: group.restS ?? 0 };

const periodS = (p: TimerPlan) => p.workS + p.restS;
export const totalS = (p: TimerPlan): number => p.steps * periodS(p);

export const start = (now: number): TimerAnchor => ({ startedAt: now, pauses: [], skipMs: 0 });

export const isPaused = (a: TimerAnchor): boolean => a.pauses.at(-1)?.to === undefined && a.pauses.length > 0;

/** Time on the clock: wall time since the start, minus pauses, plus skips, stopped at the end. */
export function elapsedMs(a: TimerAnchor, now: number): number {
  const until = a.endedAt ?? now;
  const paused = a.pauses.reduce((sum, p) => sum + Math.max(0, Math.min(p.to ?? until, until) - p.from), 0);
  return Math.max(0, until - a.startedAt - paused + a.skipMs);
}

export function positionAt(plan: TimerPlan, a: TimerAnchor, now: number): TimerPosition {
  const period = periodS(plan) * 1000;
  const elapsed = elapsedMs(a, now);
  const done = a.endedAt !== undefined || period <= 0 || elapsed >= plan.steps * period;
  const step = period <= 0 ? 0 : Math.min(plan.steps - 1, Math.max(0, Math.floor(elapsed / period)));
  const into = elapsed - step * period;
  const working = into < plan.workS * 1000 || plan.restS === 0;
  const phaseEnd = (working ? plan.workS : periodS(plan)) * 1000;
  return {
    step,
    phase: working ? 'work' : 'rest',
    remainingS: done ? 0 : Math.ceil((phaseEnd - into) / 1000),
    phaseS: working ? plan.workS : plan.restS,
    done,
  };
}

export function pause(a: TimerAnchor, now: number): TimerAnchor {
  return isPaused(a) || a.endedAt !== undefined ? a : { ...a, pauses: [...a.pauses, { from: now }] };
}

export function resume(a: TimerAnchor, now: number): TimerAnchor {
  if (!isPaused(a)) return a;
  return { ...a, pauses: a.pauses.map((p, i) => (i === a.pauses.length - 1 ? { ...p, to: now } : p)) };
}

/** Jump to the start of the next set (past the end after the last one). */
export function skip(plan: TimerPlan, a: TimerAnchor, now: number): TimerAnchor {
  if (a.endedAt !== undefined) return a;
  const period = periodS(plan) * 1000;
  const elapsed = elapsedMs(a, now);
  const next = (Math.floor(elapsed / period) + 1) * period;
  return { ...a, skipMs: a.skipMs + next - elapsed };
}

export const end = (a: TimerAnchor, now: number): TimerAnchor =>
  a.endedAt !== undefined ? a : { ...resume(a, now), endedAt: now };

export interface Boundary {
  /** Seconds from now. */
  inS: number;
  /** The set that starts (`work`), the set whose rest starts (`rest`), or `steps` when the timer ends. */
  step: number;
  phase: 'work' | 'rest' | 'done';
}

/** Every boundary still ahead of a running timer (none while paused or after the end). */
export function boundaries(plan: TimerPlan, a: TimerAnchor, now: number): Boundary[] {
  if (isPaused(a) || a.endedAt !== undefined) return [];
  const elapsedS = elapsedMs(a, now) / 1000;
  const out: Boundary[] = [];
  for (let step = 0; step < plan.steps; step++) {
    const at = step * periodS(plan);
    if (step > 0) out.push({ inS: at - elapsedS, step, phase: 'work' });
    if (plan.restS > 0) out.push({ inS: at + plan.workS - elapsedS, step, phase: 'rest' });
  }
  out.push({ inS: totalS(plan) - elapsedS, step: plan.steps, phase: 'done' });
  return out.filter((b) => b.inS > 0);
}

/** Whether moving from `before` to `after` crossed a boundary: buzz once. The first look (`null`) never does. */
export function buzzes(before: TimerPosition | null, after: TimerPosition): boolean {
  if (!before || before.done) return false;
  return after.done || after.step !== before.step || after.phase !== before.phase;
}
