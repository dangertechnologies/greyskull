import type { Group } from '../domain';
import type { ItemGroup, SessionItem } from '../hooks/useSession';

const KIND: Record<Group['kind'], string> = {
  superset: 'Superset',
  circuit: 'Circuit',
  emom: 'EMOM',
  interval: 'Interval',
};

/** "Minute 4 of 10" (an EMOM counts minutes), "Round 2 of 4" (every other kind counts rounds). */
export const timerStepLabel = (g: ItemGroup): string =>
  g.kind === 'emom' ? `Minute ${g.step + 1} of ${g.steps}` : `Round ${g.round} of ${g.rounds}`;

/** "Superset · Round 2 of 3", "EMOM · Minute 4 of 10". */
export const roundLabel = (g: ItemGroup): string => `${KIND[g.kind]} · ${timerStepLabel(g)}`;

/** The header above a group's exercises: "Superset A · rest 90 s after each round". */
export function groupTitle(group: Group, letter: string, steps: number): string {
  const name = `${KIND[group.kind]} ${letter}`;
  const rest = group.restS ? `rest ${group.restS} s` : 'no rest';
  if (group.kind === 'superset') return `${name} · ${rest} after each round`;
  if (group.kind === 'circuit') return `${name} · ${group.rounds ?? 0} rounds · ${rest} after each round`;
  if (group.kind === 'emom') return `${name} · ${steps} minutes, one set each minute`;
  return `${name} · ${group.rounds ?? 0} rounds · ${group.workS ?? 0} s work, ${group.restS ?? 0} s rest`;
}

/** "12 reps", "30 s", "max reps". */
export const targetText = (item: SessionItem): string =>
  item.targetReps === null
    ? 'max reps'
    : item.timed
      ? `${item.targetReps} s`
      : `${item.targetReps} ${item.targetReps === 1 ? 'rep' : 'reps'}`;
