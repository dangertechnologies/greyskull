import type { Group } from '../domain';
import type { ItemGroup, SessionItem } from '../hooks/useSession';

const KIND: Record<Group['kind'], string> = {
  superset: 'Superset',
  circuit: 'Circuit',
  emom: 'EMOM',
  interval: 'Interval',
};

/** "Superset · Round 2 of 3", "EMOM · Minute 4 of 10". */
export const roundLabel = (g: ItemGroup): string =>
  g.kind === 'emom'
    ? `EMOM · Minute ${g.step + 1} of ${g.steps}`
    : `${KIND[g.kind]} · Round ${g.kind === 'interval' ? g.step + 1 : g.round} of ${g.kind === 'interval' ? g.steps : g.rounds}`;

/** The header above a group's exercises: "Superset A · rest 90 s after each round". */
export function groupTitle(group: Group, letter: string, steps: number): string {
  const name = `${KIND[group.kind]} ${letter}`;
  const rest = group.restS ? `rest ${group.restS} s` : 'no rest';
  if (group.kind === 'superset') return `${name} · ${rest} after each round`;
  if (group.kind === 'circuit') return `${name} · ${group.rounds ?? 0} rounds · ${rest} after each round`;
  if (group.kind === 'emom') return `${name} · ${steps} minutes, one set each minute`;
  return `${name} · ${steps} rounds · ${group.workS ?? 0} s work, ${group.restS ?? 0} s rest`;
}

/** "12 reps", "30 s", "max reps". */
export const targetText = (item: SessionItem): string =>
  item.targetReps === null
    ? 'max reps'
    : item.timed
      ? `${item.targetReps} s`
      : `${item.targetReps} ${item.targetReps === 1 ? 'rep' : 'reps'}`;
