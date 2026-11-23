import { builtInExercises } from './catalog';
import type { Exercise } from './domain';
import {
  canDoWith,
  EMPTY_FILTERS,
  EQUIPMENT_LABELS,
  type ExerciseFilters,
  filterExercises,
  MUSCLE_LABELS,
  PATTERN_LABELS,
  subtitleOf,
} from './exerciseFilter';

const catalog = builtInExercises();
const all = Object.values(catalog);
const ids = (list: Exercise[]) => list.map((e) => e.id);
const run = (f: Partial<ExerciseFilters>) => filterExercises(all, { ...EMPTY_FILTERS, ...f });
const plain: Exercise = { id: 'c', name: 'c', shortName: 'c', kind: 'barbell', increment: { kg: 1, lb: 1 } };

test('no filters keeps everything', () => {
  expect(run({})).toHaveLength(all.length);
});

test('search needs every word, ignores case, accents and hyphens', () => {
  const hits = run({ query: '  PUSH up ' });
  expect(hits.length).toBeGreaterThan(5);
  expect(hits.map((e) => e.name.toLowerCase().replace(/-/g, ' '))).toContain('push up');
  expect(ids(run({ query: 'zzzz' }))).toEqual([]);
  expect(filterExercises([{ ...plain, name: 'Écarté' }], { ...EMPTY_FILTERS, query: 'ecarte' })).toHaveLength(
    1,
  );
  expect(
    filterExercises([{ ...plain, name: 'Pull-up' }], { ...EMPTY_FILTERS, query: 'pull up' }),
  ).toHaveLength(1);
});

test('values inside one filter are alternatives; different filters all have to match', () => {
  const bar = run({ equipment: ['pull-up-bar'] });
  const none = run({ equipment: ['none'] });
  const both = run({ equipment: ['none', 'pull-up-bar'] });
  expect(both.length).toBeGreaterThan(bar.length);
  expect(both.length).toBeGreaterThan(none.length);
  expect(bar.every((e) => e.equipment?.includes('pull-up-bar'))).toBe(true);
  const lats = run({ equipment: ['pull-up-bar'], muscles: ['lats'], patterns: ['pull'] });
  expect(lats.length).toBeGreaterThan(0);
  expect(lats.length).toBeLessThan(bar.length);
  expect(lats.every((e) => e.muscles?.includes('lats') && e.pattern === 'pull')).toBe(true);
});

test('the timed filter keeps only holds', () => {
  const timed = run({ timed: true });
  expect(timed.length).toBeGreaterThan(5);
  expect(timed.every((e) => e.timed)).toBe(true);
});

test('canDoWith: unknown equipment shows everything; otherwise every piece must be owned', () => {
  const bench = catalog.BENCH_PRESS; // barbell + bench
  expect(canDoWith(bench, [])).toBe(true);
  expect(canDoWith(bench, ['barbell'])).toBe(false);
  expect(canDoWith(bench, ['barbell', 'bench'])).toBe(true);
  expect(canDoWith(catalog.CAL_PUSHUP, ['bands'])).toBe(true); // bodyweight needs nothing
  const mine = run({ onlyMine: ['barbell', 'bench'] });
  expect(mine.length).toBeGreaterThan(0);
  expect(mine.length).toBeLessThan(all.length);
  expect(mine.every((e) => canDoWith(e, ['barbell', 'bench']))).toBe(true);
});

test('every label map covers every value the catalog uses', () => {
  for (const e of all) {
    for (const q of e.equipment ?? []) expect(EQUIPMENT_LABELS[q]).toBeDefined();
    for (const m of [...(e.muscles ?? []), ...(e.secondary ?? [])]) expect(MUSCLE_LABELS[m]).toBeDefined();
    if (e.pattern) expect(PATTERN_LABELS[e.pattern]).toBeDefined();
  }
});

test('subtitle: muscles, then the equipment in lower case', () => {
  expect(subtitleOf({ ...plain, muscles: ['chest', 'triceps'], equipment: ['none'] })).toBe(
    'Chest, triceps · bodyweight',
  );
  expect(subtitleOf({ ...plain, muscles: ['lats'], equipment: ['pull-up-bar'] })).toBe('Lats · pull-up bar');
  expect(subtitleOf({ ...plain, muscles: ['lower-back'], equipment: ['barbell', 'bench'] })).toBe(
    'Lower back · barbell, bench',
  );
  expect(subtitleOf(plain)).toBe('');
});

test('search works for any script and keeps letters like ø inside one word', () => {
  const named = (name: string): Exercise => ({ ...plain, name, shortName: name });
  const hit = (name: string, query: string) =>
    filterExercises([named(name)], { ...EMPTY_FILTERS, query }).length === 1;
  expect(hit('Жим лёжа', 'жим')).toBe(true);
  expect(hit('Жим лёжа', 'лежа')).toBe(true); // ё loses its mark like an accent
  expect(hit('腕立て伏せ', '腕立て')).toBe(true);
  expect(hit('Bøg press', 'bøg')).toBe(true);
  expect(hit('Bøg press', 'g')).toBe(false); // ø is a letter: "bøg" is one word, not "b" and "g"
  expect(hit('Écarté', 'ecarte')).toBe(true);
  expect(hit('ﬁsh curl', 'fish')).toBe(true); // compatibility forms fold too
  expect(hit('Curl 21s', '21')).toBe(true);
});
