import type { Equipment, Exercise, Muscle, Pattern } from './domain';

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  'ez-bar': 'EZ bar',
  'trap-bar': 'Trap bar',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  cable: 'Cable',
  machine: 'Machine',
  bench: 'Bench',
  'pull-up-bar': 'Pull-up bar',
  'dip-bars': 'Dip bars',
  rings: 'Rings',
  parallettes: 'Parallettes',
  bands: 'Bands',
  box: 'Box',
  'medicine-ball': 'Medicine ball',
  'exercise-ball': 'Exercise ball',
  'foam-roll': 'Foam roller',
  none: 'Bodyweight',
};

export const MUSCLE_LABELS: Record<Muscle, string> = {
  abdominals: 'Abs',
  abductors: 'Abductors',
  adductors: 'Adductors',
  biceps: 'Biceps',
  calves: 'Calves',
  chest: 'Chest',
  forearms: 'Forearms',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
  lats: 'Lats',
  'lower-back': 'Lower back',
  'middle-back': 'Upper back',
  neck: 'Neck',
  quadriceps: 'Quads',
  shoulders: 'Shoulders',
  traps: 'Traps',
  triceps: 'Triceps',
};

export const PATTERN_LABELS: Record<Pattern, string> = {
  push: 'Push',
  pull: 'Pull',
  squat: 'Squat',
  hinge: 'Hinge',
  core: 'Core',
  carry: 'Carry',
  skill: 'Skill',
  mobility: 'Mobility',
};

export const LEVEL_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' } as const;

export interface ExerciseFilters {
  query: string;
  /** An exercise matches when it uses any of these. */
  equipment: Equipment[];
  /** An exercise matches when it trains any of these as a main muscle. */
  muscles: Muscle[];
  patterns: Pattern[];
  timed: boolean;
  /** The gym's equipment; only exercises that need nothing else match. `undefined` = no such filter. */
  onlyMine?: Equipment[];
}

export const EMPTY_FILTERS: ExerciseFilters = {
  query: '',
  equipment: [],
  muscles: [],
  patterns: [],
  timed: false,
};

export const filterCount = (f: ExerciseFilters): number =>
  f.equipment.length + f.muscles.length + f.patterns.length + (f.timed ? 1 : 0) + (f.onlyMine ? 1 : 0);

const words = (text: string): string[] =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const haystacks = new WeakMap<Exercise, string>();
const haystack = (e: Exercise): string => {
  let text = haystacks.get(e);
  if (text === undefined) {
    text = ` ${words(`${e.name} ${e.shortName}`).join(' ')} `;
    haystacks.set(e, text);
  }
  return text;
};

/**
 * Whether the gym has what the exercise needs. An empty list means the user never said what they own, so
 * nothing is ruled out; bodyweight work (`none`) needs nothing.
 */
export function canDoWith(exercise: Exercise, owned: Equipment[]): boolean {
  if (owned.length === 0) return true;
  return (exercise.equipment ?? []).every((q) => q === 'none' || owned.includes(q));
}

/** Search words must each start a word of the name (so "pu up" finds "Push-up"); filters combine with AND. */
export function filterExercises(list: Exercise[], f: ExerciseFilters): Exercise[] {
  const terms = words(f.query);
  return list.filter((e) => {
    if (terms.some((w) => !haystack(e).includes(` ${w}`))) return false;
    if (f.timed && !e.timed) return false;
    if (f.equipment.length > 0 && !(e.equipment ?? []).some((q) => f.equipment.includes(q))) return false;
    if (f.muscles.length > 0 && !(e.muscles ?? []).some((m) => f.muscles.includes(m))) return false;
    if (f.patterns.length > 0 && !(e.pattern && f.patterns.includes(e.pattern))) return false;
    return !f.onlyMine || canDoWith(e, f.onlyMine);
  });
}

const lowerFirst = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

/** "Chest, triceps · bodyweight": main muscles, then the equipment. Empty for an exercise with neither. */
export function subtitleOf(e: Exercise): string {
  const muscles = (e.muscles ?? []).map((m, i) =>
    i === 0 ? MUSCLE_LABELS[m] : lowerFirst(MUSCLE_LABELS[m]),
  );
  const equipment = (e.equipment ?? []).map((q) => lowerFirst(EQUIPMENT_LABELS[q]));
  return [muscles.join(', '), equipment.join(', ')].filter(Boolean).join(' · ');
}
