import type { Exercise, Ladder, LiftState, Scheme } from '../domain';
import { getLadder, stepIn, tryParseScheme } from '../domain';
import { nameOf } from '../format';

/** A ladder lift key resolved to its ladder, the current step (made whole) and that step's exercise. */
export function ladderAt(
  key: string,
  lift: Pick<LiftState, 'step'> | undefined,
  exercises: Record<string, Exercise>,
): { ladder: Ladder; step: number; exercise: Exercise | undefined } | undefined {
  const ladder = getLadder(key);
  if (!ladder) return undefined;
  const step = stepIn(ladder, lift?.step);
  return { ladder, step, exercise: exercises[ladder.steps[step].exercise] };
}

/** The scheme a step is trained at: its own, else the slot's. */
export const stepScheme = (ladder: Ladder, step: number, slotScheme?: Scheme): Scheme | undefined =>
  ladder.steps[step]?.scheme ?? slotScheme;

/** "3×8", "3×30 s": every set at the top of the scheme, which is what it takes to leave the step. */
export function topOf(scheme: Scheme | undefined): string | undefined {
  const parsed = scheme ? tryParseScheme(scheme) : null;
  if (!parsed || parsed.reps === null) return undefined;
  return `${parsed.sets}×${parsed.repsMax ?? parsed.reps}${parsed.timed ? ' s' : ''}`;
}

/** What moves the lift on from `step`: "3×8 to move on", "3×8 with the lightest band", or the added-load rule. */
export function unlockRule(ladder: Ladder, step: number, slotScheme?: Scheme): string | undefined {
  const top = topOf(stepScheme(ladder, step, slotScheme));
  if (!top) return undefined;
  if (ladder.steps[step]?.band) return `${top} with the lightest band to move on`;
  if (step < ladder.steps.length - 1) return `${top} to move on`;
  return ladder.after === 'weighted' ? `${top}, then add load` : `${top} · top of the ladder`;
}

export function easeSummary(
  eased: { gapDays: number; lifts: Record<string, LiftState> },
  stored: Record<string, LiftState>,
): string {
  const changes = Object.entries(eased.lifts).map(([key, e]) => ({ e, s: stored[key] }));
  // Each lift eases by its own gap and rounds to loadable weights: show the real drops, the largest as "up to".
  const drops = [
    ...new Set(
      changes.flatMap(({ e, s }) =>
        s && s.weightKg > 0 && e.weightKg < s.weightKg
          ? [Math.round((1 - e.weightKg / s.weightKg) * 100)]
          : [],
      ),
    ),
  ];
  const parts = [
    drops.length > 0 ? `weights eased back ${drops.length > 1 ? 'up to ' : ''}${Math.max(...drops)} %` : null,
    changes.some(({ e, s }) => s && (e.step ?? 0) < (s.step ?? 0)) ? 'ladders one step back' : null,
  ].filter(Boolean);
  const days = `${eased.gapDays} ${eased.gapDays === 1 ? 'day' : 'days'} since you last trained`;
  return [days, ...(parts.length > 0 ? parts : ['rep targets back to the bottom of the range'])].join(' · ');
}

/** A band change after a session: lighter or heavier by the band order (heaviest first), or a first band. */
export interface BandMove {
  label: string;
  change: 'lighter' | 'heavier' | 'start';
}

/**
 * What a ladder lift's outcome changed, for the celebration: the name of the step it moved up to, or the band it
 * moved to and in which direction. Nothing when neither changed.
 */
export function ladderMove(
  from: LiftState | undefined,
  next: LiftState,
  ladder: Ladder,
  bands: readonly { id: string; label: string }[],
  exercises: Record<string, Exercise>,
): { step?: string; band?: BandMove } {
  if (!from) return {};
  const step = stepIn(ladder, next.step);
  if (step > stepIn(ladder, from.step)) return { step: nameOf(exercises, ladder.steps[step].exercise) };
  if (!next.bandId || next.bandId === from.bandId) return {};
  const to = bands.findIndex((b) => b.id === next.bandId);
  const was = bands.findIndex((b) => b.id === from.bandId);
  const label = bands[to]?.label ?? '';
  return { band: { label, change: was < 0 || to < 0 ? 'start' : to > was ? 'lighter' : 'heavier' } };
}
