import type { ResolvedSession } from './program';
import type { Day, GroupKind, Slot } from './types';

const KINDS: GroupKind[] = ['superset', 'circuit', 'emom', 'interval'];
const MAX_SECONDS = 600;
const isWhole = (n: number | undefined): n is number => n !== undefined && Number.isInteger(n) && n >= 1;

/**
 * Problems with a day's grouped sets. `setCounts` gives every set count a slot can have (one per ladder step),
 * so a group that would leave a set out of its rounds or minutes is rejected here rather than dropped later.
 */
export function groupErrors(day: Day, setCounts: (slot: Slot) => number[]): string[] {
  const errors: string[] = [];
  const add = (message: string) => errors.push(`${day.name}: ${message}`);
  const groups = day.groups ?? [];
  const ids = new Set<string>();
  for (const g of groups) {
    if (ids.has(g.id)) add(`group ${g.id} appears twice.`);
    ids.add(g.id);
  }
  for (const slot of day.slots)
    if (slot.group !== undefined && !ids.has(slot.group)) add(`unknown group ${slot.group}.`);

  for (const g of groups) {
    if (!KINDS.includes(g.kind)) {
      add(`unknown group kind ${g.kind}.`);
      continue;
    }
    const at = day.slots.flatMap((s, i) => (s.group === g.id ? [i] : []));
    const slots = at.map((i) => day.slots[i]);
    if (at.length > 0 && at[at.length - 1] - at[0] + 1 !== at.length)
      add(`the exercises of group ${g.id} must be next to each other.`);
    const min = g.kind === 'superset' || g.kind === 'circuit' ? 2 : 1;
    if (slots.length < min) add(`a ${g.kind} needs at least ${min} ${min === 1 ? 'exercise' : 'exercises'}.`);
    if (g.restS !== undefined && !(g.restS >= 0 && g.restS <= MAX_SECONDS))
      add(`group ${g.id}: rest must be 0 to ${MAX_SECONDS} seconds.`);
    if (g.workS !== undefined && !(g.workS >= 0 && g.workS <= MAX_SECONDS))
      add(`group ${g.id}: work must be 0 to ${MAX_SECONDS} seconds.`);
    const needSets = (sets: number, per: string) => {
      if (slots.some((s) => setCounts(s).some((n) => n !== sets)))
        add(`group ${g.id}: every exercise needs ${sets} sets for ${per}.`);
    };
    if (g.kind === 'circuit' || g.kind === 'interval') {
      if (!isWhole(g.rounds)) add(`group ${g.id}: set the number of rounds.`);
      else needSets(g.rounds, `${g.rounds} rounds`);
    }
    if (g.kind === 'interval' && !(g.workS !== undefined && g.workS >= 1))
      add(`group ${g.id}: set the work time.`);
    if (g.kind === 'emom' && slots.length > 0) {
      if (!isWhole(g.minutes)) add(`group ${g.id}: set the number of minutes.`);
      else if (g.minutes % slots.length !== 0)
        add(`group ${g.id}: ${slots.length} exercises must divide ${g.minutes} minutes evenly.`);
      else needSets(g.minutes / slots.length, `${g.minutes} minutes`);
    }
  }
  return errors;
}

export interface SetStep {
  exercise: string;
  /** Index into the exercise's sets. */
  set: number;
  group?: string;
  /** Rest after this set before the next one (end of a superset or circuit round, after an interval). */
  restAfterS?: number;
  /** Start time from the beginning of the group (EMOM minute, interval round). */
  atS?: number;
}

/**
 * The order a session is walked in. Ungrouped exercises go set by set; supersets and circuits do one set of
 * each exercise per round and rest after the round; an EMOM does exercise k mod n in minute k; an interval
 * works `workS` then rests `restS` after every set, the last one included, so a timer runs plain work/rest pairs.
 * `sets` is the number of sets per exercise id.
 */
export function setOrder(session: ResolvedSession, sets: Record<string, number>): SetStep[] {
  const out: SetStep[] = [];
  const count = (exercise: string) => sets[exercise] ?? 0;
  const walked = new Set<string>();
  for (const slot of session.slots) {
    const group = slot.group === undefined ? undefined : session.groups?.find((g) => g.id === slot.group);
    if (!group) {
      for (let set = 0; set < count(slot.exercise); set++) out.push({ exercise: slot.exercise, set });
      continue;
    }
    if (walked.has(group.id)) continue;
    walked.add(group.id);
    const members = session.slots.filter((s) => s.group === group.id).map((s) => s.exercise);
    const rounds = Math.max(0, ...members.map(count));
    const rest = group.restS === undefined ? {} : { restAfterS: group.restS };
    if (group.kind === 'emom') {
      for (let k = 0; k < rounds * members.length; k++) {
        const exercise = members[k % members.length];
        const set = Math.floor(k / members.length);
        if (set < count(exercise)) out.push({ exercise, set, group: group.id, atS: 60 * k });
      }
    } else if (group.kind === 'interval') {
      const period = (group.workS ?? 0) + (group.restS ?? 0);
      let k = 0;
      for (let set = 0; set < rounds; set++)
        for (const exercise of members)
          if (set < count(exercise)) out.push({ exercise, set, group: group.id, atS: period * k++, ...rest });
    } else {
      for (let set = 0; set < rounds; set++) {
        const round: SetStep[] = members
          .filter((exercise) => set < count(exercise))
          .map((exercise) => ({ exercise, set, group: group.id }));
        Object.assign(round[round.length - 1], rest);
        out.push(...round);
      }
    }
  }
  return out;
}
