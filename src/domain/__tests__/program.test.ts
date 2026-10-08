import { builtInExercises } from '../../catalog';
import { PLUGINS, parseScheme, sessionFor, setTargets, TEMPLATES, validateProgram } from '../program';
import type { Program } from '../types';

const ex = builtInExercises();
const ids = (p: Program, n: number) => sessionFor(p, n).slots.map((s) => s.exercise);
const short = (p: Program, n: number) => ids(p, n).map((id) => ex[id].shortName);

test('base template: press/bench alternate, squat sessions 0 and 2, deadlift once in 3', () => {
  expect([0, 1, 2, 3, 4, 5].map((n) => short(TEMPLATES.base, n))).toEqual([
    ['Press', 'Squat'], ['Bench', 'Deadlift'], ['Press', 'Squat'],
    ['Bench', 'Squat'], ['Press', 'Deadlift'], ['Bench', 'Squat'],
  ]);
  const deadlifts = Array.from({ length: 30 }, (_, n) => ids(TEMPLATES.base, n).includes('DEADLIFT'));
  expect(deadlifts.filter(Boolean)).toHaveLength(10);
});

test('phrak template: A B A B…, deadlift only on B', () => {
  const days = [0, 1, 2, 3, 4, 5].map((n) => sessionFor(TEMPLATES.phrak, n).dayName);
  expect(days).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
  const dl = [0, 1, 2, 3, 4, 5].filter((n) => ids(TEMPLATES.phrak, n).includes('DEADLIFT'));
  expect(dl).toEqual([1, 3, 5]);
  expect(ids(TEMPLATES.phrak, 0)).toEqual(['CHINUPS', 'MILITARY_PRESS', 'BARBELL_SQUAT']);
});

test('sessionFor is O(1)-correct for large n and works with a single day', () => {
  const one: Program = { ...TEMPLATES.base, days: [{ name: 'Only', slots: [{ exercise: ['A', 'B'], scheme: '2x5+' }] }] };
  expect(ids(one, 0)).toEqual(['A']);
  expect(ids(one, 1)).toEqual(['B']);
  expect(ids(one, 100001)).toEqual(['B']);
  expect(ids(TEMPLATES.base, 3000).includes('SQUAT')).toBe(false);
});

test('parseScheme and setTargets', () => {
  expect(parseScheme('2x5+')).toEqual({ sets: 2, reps: 5, amrap: true });
  expect(parseScheme('2xAMRAP')).toEqual({ sets: 2, reps: null, amrap: true });
  expect(parseScheme('3x8')).toEqual({ sets: 3, reps: 8, amrap: false });
  expect(setTargets('2x5+')).toEqual([5, null]);
  expect(setTargets('1x5+')).toEqual([null]);
  expect(setTargets('2xAMRAP')).toEqual([null, null]);
  expect(setTargets('3x8')).toEqual([8, 8, 8]);
});

describe('validateProgram', () => {
  test('templates are valid against the catalog', () => {
    expect(validateProgram(TEMPLATES.base, ex)).toEqual([]);
    expect(validateProgram(TEMPLATES.phrak, ex)).toEqual([]);
  });
  test('catches a reversed tuple', () => {
    const p: Program = JSON.parse(JSON.stringify(TEMPLATES.base));
    p.days[1].slots[0].exercise = ['BENCH_PRESS', 'MILITARY_PRESS'];
    expect(validateProgram(p, ex).join()).toMatch(/same order/);
  });
  test('catches unknown ids, empty days, no days and duplicates', () => {
    const p: Program = JSON.parse(JSON.stringify(TEMPLATES.base));
    p.days[0].slots.push({ exercise: 'NOPE', scheme: '2x5+' });
    expect(validateProgram(p, ex).join()).toMatch(/unknown exercise NOPE/);
    p.days[1].slots = [];
    expect(validateProgram(p, ex).join()).toMatch(/Day 2 has no exercises/);
    expect(validateProgram({ ...p, days: [] })).toContain('Add at least one day.');
    const dup: Program = JSON.parse(JSON.stringify(TEMPLATES.base));
    dup.days[0].slots.push({ exercise: 'BARBELL_SQUAT', scheme: '2x5+' });
    expect(validateProgram(dup, ex).join()).toMatch(/appears twice/);
  });
});

describe('plugins', () => {
  test.each(Object.entries(PLUGINS))('%s is idempotent and does not mutate its input', (_id, plugin) => {
    const base = plugin.templates[0];
    const before = JSON.stringify(TEMPLATES[base]);
    const once = plugin.apply(TEMPLATES[base]);
    expect(JSON.stringify(TEMPLATES[base])).toBe(before);
    expect(plugin.apply(once)).toEqual(once);
    expect(validateProgram(once, ex)).toEqual([]);
  });
  test('curls append to every day; chins on base; rows swap on phrak', () => {
    const curls = PLUGINS.curls.apply(TEMPLATES.base);
    expect(curls.days.every((d) => d.slots[d.slots.length - 1].exercise === 'CURLS')).toBe(true);
    expect(curls.days[0].slots.at(-1)?.scheme).toBe('2xAMRAP');
    const rows = PLUGINS.rows_instead_of_chins.apply(TEMPLATES.phrak);
    expect(rows.days[0].slots[0].exercise).toBe('BENT_OVER_ROW');
    expect(rows.days[1].slots[0].exercise).toBe('CHINUPS');
  });
});
