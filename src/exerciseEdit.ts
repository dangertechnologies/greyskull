import type { Equipment, Exercise, Kind, Muscle } from './domain';
import { USER_FIELDS } from './domain/exerciseFields';

/** What the exercise editor holds while the user types: strings for text, plain values for the rest. */
export interface ExerciseForm {
  name: string;
  shortName: string;
  abbr: string;
  kind: Kind;
  equipment: Equipment[];
  muscles: Muscle[];
  secondary: Muscle[];
  timed: boolean;
  incKg: number;
  incLb: number;
  stepKg: number;
  stepLb: number;
  ownBar: boolean;
  barKg: number;
  barLb: number;
  description: string;
  /** One tip per line. */
  good: string;
  bad: string;
  url: string;
  video: string;
}

const DEFAULT_EQUIPMENT: Record<Kind, Equipment[]> = {
  barbell: ['barbell'],
  dumbbell: ['dumbbell'],
  kettlebell: ['kettlebell'],
  machine: ['machine'],
  bodyweight: ['none'],
};

const lines = (text: string): string[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** An empty list the user did not touch stays as stored (missing or `[]`), so saving never counts as an edit. */
const unlessBothEmpty = <T>(list: T[], stored: T[] | undefined): T[] | undefined =>
  list.length === 0 && (stored ?? []).length === 0 ? stored : list;

/** The editor's starting values: an exercise's own, or the defaults for a new barbell exercise. */
export function formFrom(e: Exercise | undefined): ExerciseForm {
  return {
    name: e?.name ?? '',
    shortName: e?.shortName ?? '',
    abbr: e?.abbr ?? '',
    kind: e?.kind ?? 'barbell',
    equipment: e?.equipment ?? [],
    muscles: e?.muscles ?? [],
    secondary: e?.secondary ?? [],
    timed: e?.timed ?? false,
    incKg: e?.increment.kg ?? 2.5,
    incLb: e?.increment.lb ?? 5,
    stepKg: e?.step?.kg ?? 2,
    stepLb: e?.step?.lb ?? 5,
    ownBar: !!e?.barKg,
    barKg: e?.barKg?.kg ?? 10,
    barLb: e?.barKg?.lb ?? 25,
    description: e?.description ?? '',
    good: (e?.goodForm ?? []).join('\n'),
    bad: (e?.badForm ?? []).join('\n'),
    url: e?.url ?? '',
    video: e?.video ?? '',
  };
}

/**
 * The exercise to store from the form. A custom exercise takes every field. A built-in keeps its shipped
 * content (description, tips, links) and takes only the fields in `USER_FIELDS`, which is what the store keeps
 * for it across launches.
 */
export function exerciseFromForm(
  form: ExerciseForm,
  existing: Exercise | undefined,
  newId: (name: string) => string,
): Exercise {
  const name = form.name.trim();
  const weighted = form.kind === 'dumbbell' || form.kind === 'machine' || form.kind === 'kettlebell';
  const edited: Partial<Exercise> = {
    name,
    shortName: form.shortName.trim() || name.split(/\s+/)[0],
    abbr: form.abbr.trim().slice(0, 3).toUpperCase() || undefined,
    kind: form.kind,
    increment: { kg: form.incKg, lb: form.incLb },
    step: weighted ? { kg: form.stepKg, lb: form.stepLb } : undefined,
    barKg: form.kind === 'barbell' && form.ownBar ? { kg: form.barKg, lb: form.barLb } : undefined,
    equipment: form.equipment.length > 0 ? form.equipment : DEFAULT_EQUIPMENT[form.kind],
    muscles: unlessBothEmpty(form.muscles, existing?.muscles),
    secondary: unlessBothEmpty(form.secondary, existing?.secondary),
    timed: form.timed || undefined,
  };
  if (existing && !existing.custom) {
    const out: Exercise = { ...existing };
    for (const f of USER_FIELDS) {
      if (edited[f] === undefined) delete out[f];
      else Object.assign(out, { [f]: edited[f] });
    }
    return out;
  }
  return {
    ...existing,
    ...edited,
    id: existing?.id ?? newId(name),
    name,
    shortName: edited.shortName as string,
    kind: form.kind,
    increment: { kg: form.incKg, lb: form.incLb },
    description: form.description.trim() || undefined,
    goodForm: lines(form.good),
    badForm: lines(form.bad),
    url: form.url.trim() || undefined,
    video: form.video.trim() || undefined,
    custom: true,
  };
}
