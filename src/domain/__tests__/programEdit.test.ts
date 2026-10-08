import { builtInExercises } from '../../catalog';
import { PLUGINS, sessionFor, TEMPLATES, tryParseScheme, validateProgram } from '../program';
import {
  addAlternatingSlot,
  addDay,
  addSlot,
  buildProgram,
  moveSlot,
  nextScheme,
  removeDay,
  removeSlot,
  renameDay,
  SCHEMES,
  setSlotScheme,
} from '../programEdit';
import { DEFAULT_RULES } from '../types';

const ex = builtInExercises();
const base = TEMPLATES.base;

test('buildProgram applies plugins for the template only, then options', () => {
  const p = buildProgram(base, ['curls', 'rows_instead_of_chins'], {
    sessionsPerWeek: 2,
    rules: { ...DEFAULT_RULES, doubleAt: 8 },
  });
  expect(p.days.every((d) => d.slots.at(-1)?.exercise === 'CURLS')).toBe(true);
  expect(JSON.stringify(p)).not.toContain('BENT_OVER_ROW');
  expect(p.sessionsPerWeek).toBe(2);
  expect(p.rules.doubleAt).toBe(8);
  expect(JSON.stringify(base)).not.toContain('CURLS');
  expect(validateProgram(p, ex)).toEqual([]);
});

test('edits are immutable and keep the program valid', () => {
  const dips = addSlot(base, 1, 'DIPS', '2xAMRAP');
  expect(dips.days[1].slots.at(-1)).toEqual({ exercise: 'DIPS', scheme: '2xAMRAP' });
  expect(base.days[1].slots).toHaveLength(2);
  expect(sessionFor(dips, 1).slots.map((s) => s.exercise)).toEqual(['BENCH_PRESS', 'DEADLIFT', 'DIPS']);
  expect(sessionFor(dips, 0).slots).toHaveLength(2); // other days unchanged
  const moved = moveSlot(dips, 1, 2, -1);
  expect(moved.days[1].slots.map((s) => s.exercise)).toEqual([
    ['MILITARY_PRESS', 'BENCH_PRESS'],
    'DIPS',
    'DEADLIFT',
  ]);
  expect(moveSlot(dips, 1, 0, -1)).toEqual(dips);
  expect(removeSlot(moved, 1, 1).days[1].slots).toHaveLength(2);
  expect(setSlotScheme(base, 0, 1, '3x5+').days[0].slots[1].scheme).toBe('3x5+');
  expect(renameDay(base, 0, 'Push').days[0].name).toBe('Push');
});

test('days can be added and removed; an empty day is a validation error', () => {
  const more = addDay(base);
  expect(more.days.at(-1)).toEqual({ name: 'Day 4', slots: [] });
  expect(validateProgram(more, ex).join()).toMatch(/Day 4 has no exercises/);
  expect(removeDay(more, 3).days).toHaveLength(3);
});

test('an alternating pair keeps the order already used elsewhere', () => {
  const custom = {
    ...base,
    days: [
      {
        name: 'A',
        slots: [{ exercise: ['BENCH_PRESS', 'MILITARY_PRESS'] as [string, string], scheme: '2x5+' as const }],
      },
      { name: 'B', slots: [] },
    ],
  };
  const added = addAlternatingSlot(custom, 1, 'MILITARY_PRESS', 'BENCH_PRESS');
  expect(added.days[1].slots[0].exercise).toEqual(['BENCH_PRESS', 'MILITARY_PRESS']);
  expect(validateProgram(added, ex)).toEqual([]);
  const fresh = addAlternatingSlot(custom, 1, 'DIPS', 'CURLS');
  expect(fresh.days[1].slots[0].exercise).toEqual(['DIPS', 'CURLS']);
});

test('scheme chip cycles through every scheme', () => {
  let s = '2x5+' as ReturnType<typeof nextScheme>;
  const seen = new Set<string>();
  for (let i = 0; i < SCHEMES.length; i++) {
    seen.add(s);
    s = nextScheme(s);
  }
  expect(seen.size).toBe(SCHEMES.length);
  expect(SCHEMES.every((x) => tryParseScheme(x) !== null)).toBe(true);
  expect(nextScheme('7x3')).toBe(SCHEMES[0]);
  expect(s).toBe('2x5+');
  expect(PLUGINS.chins.apply(base).days[0].slots.at(-1)?.scheme).toBe('2xAMRAP');
});
