import { active } from '../../__fixtures__/oneProgram';
import { builtInExercises } from '../../catalog';
import { PLANS } from '../../config/plans';
import {
  PLUGINS,
  parseProgram,
  parseScheme,
  sessionFor,
  setTargets,
  TEMPLATES,
  tryParseScheme,
  validateProgram,
} from '../program';
import { DEFAULT_RULES, type Program, type Slot } from '../types';

const ex = builtInExercises();
const ids = (p: Program, n: number) => sessionFor(active(p, n)).slots.map((s) => s.exercise);
const short = (p: Program, n: number) => ids(p, n).map((id) => ex[id].shortName);

test('base template: press/bench alternate, squat sessions 0 and 2, deadlift once in 3', () => {
  expect([0, 1, 2, 3, 4, 5].map((n) => short(TEMPLATES.base, n))).toEqual([
    ['Press', 'Squat'],
    ['Bench', 'Deadlift'],
    ['Press', 'Squat'],
    ['Bench', 'Squat'],
    ['Press', 'Deadlift'],
    ['Bench', 'Squat'],
  ]);
  const deadlifts = Array.from({ length: 30 }, (_, n) => ids(TEMPLATES.base, n).includes('DEADLIFT'));
  expect(deadlifts.filter(Boolean)).toHaveLength(10);
});

test('phrak template: A B A B…, deadlift only on B', () => {
  const days = [0, 1, 2, 3, 4, 5].map((n) => sessionFor(active(TEMPLATES.phrak, n)).dayName);
  expect(days).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
  const dl = [0, 1, 2, 3, 4, 5].filter((n) => ids(TEMPLATES.phrak, n).includes('DEADLIFT'));
  expect(dl).toEqual([1, 3, 5]);
  expect(ids(TEMPLATES.phrak, 0)).toEqual(['CHINUPS', 'MILITARY_PRESS', 'BARBELL_SQUAT']);
});

test('sessionFor is O(1)-correct for large n and works with a single day', () => {
  const one: Program = {
    ...TEMPLATES.base,
    days: [{ name: 'Only', slots: [{ exercise: ['A', 'B'], scheme: '2x5+' }] }],
  };
  expect(ids(one, 0)).toEqual(['A']);
  expect(ids(one, 1)).toEqual(['B']);
  expect(ids(one, 100001)).toEqual(['B']);
  expect(ids(TEMPLATES.base, 3000).includes('SQUAT')).toBe(false);
});

test('parseScheme and setTargets', () => {
  expect(parseScheme('2x5+')).toEqual({ sets: 2, reps: 5, repsMax: null, amrap: true, timed: false });
  expect(parseScheme('2xAMRAP')).toEqual({ sets: 2, reps: null, repsMax: null, amrap: true, timed: false });
  expect(parseScheme('3x8')).toEqual({ sets: 3, reps: 8, repsMax: null, amrap: false, timed: false });
  expect(parseScheme('5x5')).toEqual({ sets: 5, reps: 5, repsMax: null, amrap: false, timed: false });
  expect(parseScheme('2x8-12')).toEqual({ sets: 2, reps: 8, repsMax: 12, amrap: false, timed: false });
  expect(parseScheme('3x30s')).toEqual({ sets: 3, reps: 30, repsMax: null, amrap: false, timed: true });
  expect(parseScheme('3x10-30s')).toEqual({ sets: 3, reps: 10, repsMax: 30, amrap: false, timed: true });
  for (const bad of ['3x5+s', '3xAMRAPs', '3x0s', '3x30-10s', '3x10s-30s', '3x30S'])
    expect(tryParseScheme(bad)).toBeNull();
  expect(setTargets('3x10-30s', 15)).toEqual([15, 15, 15]);
  expect(setTargets('2x30s')).toEqual([30, 30]);
  expect(tryParseScheme('2x12-8')).toBeNull();
  expect(tryParseScheme('0x5')).toBeNull();
  expect(tryParseScheme('banana')).toBeNull();
  expect(setTargets('2x8-12')).toEqual([8, 8]);
  expect(setTargets('2x8-12', 10)).toEqual([10, 10]);
  expect(setTargets('2x8-12', 99)).toEqual([12, 12]);
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
  const offered = PLANS.flatMap((plan) =>
    plan.plugins.map((id) => [`${plan.id}/${id}`, plan.id, id] as const),
  );
  test.each(offered)('%s is idempotent and does not mutate its input', (_name, planId, id) => {
    const plugin = PLUGINS[id];
    const before = JSON.stringify(TEMPLATES[planId]);
    const once = plugin.apply(TEMPLATES[planId]);
    expect(JSON.stringify(TEMPLATES[planId])).toBe(before);
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

describe('parseProgram', () => {
  const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  test.each(PLANS.map((p) => [p.id, p.program] as const))('%s passes through unchanged', (_id, program) => {
    expect(parseProgram(copy(program))).toEqual({ ok: true, program });
  });

  test('keeps ladders and groups, drops unknown fields', () => {
    const input = {
      template: 'custom',
      sessionsPerWeek: 3,
      rules: { ...DEFAULT_RULES, extra: 1 },
      days: [
        {
          name: 'A',
          note: 'dropped',
          groups: [{ id: 'a', kind: 'superset', restS: 90, colour: 'red' }],
          slots: [
            { exercise: 'CAL_SCAPULAR_PULL', scheme: '3x5-8', ladder: 'rr_pullup', group: 'a', x: 1 },
            { exercise: 'DIPS', scheme: '3x5', group: 'a' },
          ],
        },
      ],
    };
    const parsed = parseProgram(input);
    expect(parsed).toEqual({
      ok: true,
      program: {
        template: 'custom',
        sessionsPerWeek: 3,
        rules: DEFAULT_RULES,
        days: [
          {
            name: 'A',
            groups: [{ id: 'a', kind: 'superset', restS: 90 }],
            slots: [
              { exercise: 'CAL_SCAPULAR_PULL', scheme: '3x5-8', ladder: 'rr_pullup', group: 'a' },
              { exercise: 'DIPS', scheme: '3x5', group: 'a' },
            ],
          },
        ],
      },
    });
  });

  const valid = () =>
    copy(TEMPLATES.base) as unknown as Record<string, unknown> & { days: Record<string, unknown>[] };
  const slotOf = (p: ReturnType<typeof valid>) => (p.days[0].slots as Record<string, unknown>[])[0];
  type Valid = ReturnType<typeof valid>;
  const day = (patch: Record<string, unknown>) => (p: Valid) => {
    Object.assign(p.days[0], patch);
    return p;
  };
  const slot = (patch: Record<string, unknown>) => (p: Valid) => {
    Object.assign(slotOf(p), patch);
    return p;
  };
  type Row = [string, (p: Valid) => unknown];
  const rows: Row[] = [
    ['not an object', () => 'banana'],
    ['null', () => null],
    ['an array', () => []],
    ['no days', (p) => ({ ...p, days: undefined })],
    ['days is not a list', (p) => ({ ...p, days: {} })],
    ['no days at all', (p) => ({ ...p, days: [] })],
    ['15 days', (p) => ({ ...p, days: Array.from({ length: 15 }, () => p.days[0]) })],
    [
      '21 slots in a day',
      (p) => {
        p.days[0].slots = Array.from({ length: 21 }, () => slotOf(p));
        return p;
      },
    ],
    ['a day without a name', day({ name: 7 })],
    ['an exercise that is a number', slot({ exercise: 5 })],
    ['a pair of three', slot({ exercise: ['A', 'B', 'C'] })],
    ['a scheme that is not text', slot({ scheme: 5 })],
    ['stages that are not a list', slot({ stages: '3x5' })],
    ['a group of an unknown kind', day({ groups: [{ id: 'a', kind: 'tabata' }] })],
    ['a group rest that is text', day({ groups: [{ id: 'a', kind: 'superset', restS: '90' }] })],
    ['no rules', (p) => ({ ...p, rules: undefined })],
    ['rules with text numbers', (p) => ({ ...p, rules: { ...DEFAULT_RULES, doubleAt: '10' } })],
    [
      'an increment without pounds',
      (p) => ({ ...p, rules: { ...DEFAULT_RULES, increments: { X: { kg: 1 } } } }),
    ],
    ['sessions per week that is text', (p) => ({ ...p, sessionsPerWeek: '3' })],
    ['a very long name', day({ name: 'x'.repeat(1000) })],
    ['an intensity that is text', day({ intensity: '0.8' })],
  ];
  test.each(rows)('rejects %s', (_name, mutate) => {
    const parsed = parseProgram(mutate(valid()));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toEqual(expect.any(String));
  });
});

describe('validateProgram: rule ranges and timed schemes', () => {
  const withRules = (patch: Partial<Program['rules']>): Program => ({
    ...TEMPLATES.base,
    rules: { ...TEMPLATES.base.rules, ...patch },
  });
  type Row = [string, Partial<Program['rules']>, RegExp | null];
  const rows: Row[] = [
    ['doubleAt 1', { doubleAt: 1 }, null],
    ['doubleAt 50', { doubleAt: 50 }, null],
    ['doubleAt 0', { doubleAt: 0 }, /double-jump reps/i],
    ['doubleAt 51', { doubleAt: 51 }, /double-jump reps/i],
    ['doubleAt 7.5', { doubleAt: 7.5 }, /double-jump reps/i],
    ['deloadPct 0', { deloadPct: 0 }, null],
    ['deloadPct 0.5', { deloadPct: 0.5 }, null],
    ['deloadPct -0.1', { deloadPct: -0.1 }, /deload/],
    ['deloadPct 0.6', { deloadPct: 0.6 }, /deload/],
    ['deloadPct NaN', { deloadPct: Number.NaN }, /deload/],
    ['failsBeforeDeload 0', { failsBeforeDeload: 0 }, null],
    ['failsBeforeDeload 10', { failsBeforeDeload: 10 }, null],
    ['failsBeforeDeload 11', { failsBeforeDeload: 11 }, /misses/i],
    ['failsBeforeDeload 1.5', { failsBeforeDeload: 1.5 }, /misses/i],
    ['failsBeforeDeload -1', { failsBeforeDeload: -1 }, /misses/i],
    ['increment 0 and 100', { increments: { BENCH_PRESS: { kg: 0, lb: 100 } } }, null],
    ['increment above 100', { increments: { BENCH_PRESS: { kg: 101, lb: 5 } } }, /increment/],
    ['negative increment', { increments: { BENCH_PRESS: { kg: 2.5, lb: -5 } } }, /increment/],
    [
      'infinite increment',
      { increments: { BENCH_PRESS: { kg: Number.POSITIVE_INFINITY, lb: 5 } } },
      /increment/,
    ],
  ];
  test.each(rows)('%s', (_name, patch, error) => {
    const errors = validateProgram(withRules(patch), ex).join('\n');
    if (error) expect(errors).toMatch(error);
    else expect(errors).toBe('');
  });

  const plank = (
    progression?: Program['rules']['progression'],
    scheme: Program['days'][0]['slots'][0]['scheme'] = '3x30s',
  ) =>
    ({
      template: 'custom',
      sessionsPerWeek: 3,
      rules: DEFAULT_RULES,
      days: [
        { name: 'A', slots: [{ exercise: 'CAL_PLANK', scheme, ...(progression ? { progression } : {}) }] },
      ],
    }) as Program;
  test('a timed scheme is rejected under AMRAP, 5/3/1 and stages', () => {
    expect(validateProgram(plank(), ex).join()).toMatch(/timed scheme 3x30s cannot use amrap/);
    expect(validateProgram(plank('amrap'), ex).join()).toMatch(/cannot use amrap/);
    expect(validateProgram(plank('531'), ex).join()).toMatch(/cannot use 531/);
    expect(
      validateProgram({ ...plank(), rules: { ...DEFAULT_RULES, progression: 'amrap' } }, ex).join(),
    ).toMatch(/cannot use amrap/);
  });
  test('a timed scheme is allowed under linear (fixed hold), double (range) and ladders', () => {
    expect(validateProgram(plank('linear'), ex)).toEqual([]);
    expect(validateProgram(plank('double', '3x10-30s'), ex)).toEqual([]);
    expect(
      validateProgram(
        {
          ...plank(),
          days: [
            { name: 'A', slots: [{ exercise: 'CAL_PLANK', scheme: '3x5-8', ladder: 'rr_antiextension' }] },
          ],
        },
        ex,
      ),
    ).toEqual([]);
  });
});

test('parseProgram keeps only known rule and increment fields', () => {
  const junk = 'x'.repeat(100_000);
  const input = {
    ...JSON.parse(JSON.stringify(TEMPLATES.base)),
    junk,
    rules: { ...DEFAULT_RULES, junk, increments: { BENCH_PRESS: { kg: 2.5, lb: 5, junk } } },
  };
  const parsed = parseProgram(input);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(JSON.stringify(parsed.program)).not.toContain('xxxx');
  expect(parsed.program.rules).toEqual({ ...DEFAULT_RULES, increments: { BENCH_PRESS: { kg: 2.5, lb: 5 } } });
});

describe('validateProgram: names every object has are not exercises, ladders or lift keys', () => {
  const catalog = builtInExercises();
  const one = (slot: Slot): Program => ({
    template: 'custom',
    sessionsPerWeek: 3,
    rules: { ...DEFAULT_RULES },
    days: [{ name: 'A', slots: [slot] }],
  });
  test.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])('%s', (id) => {
    expect(validateProgram(one({ exercise: id, scheme: '3x5' }), catalog).join()).toMatch(/unknown exercise/);
    expect(validateProgram(one({ exercise: ['BENCH_PRESS', id], scheme: '3x5' }), catalog).join()).toMatch(
      /unknown exercise/,
    );
    expect(
      validateProgram(one({ exercise: 'BENCH_PRESS', scheme: '3x5', ladder: id }), catalog).join(),
    ).toMatch(/unknown ladder/);
    expect(
      validateProgram(one({ exercise: 'BENCH_PRESS', scheme: '3x5', lift: id }), catalog).join(),
    ).toMatch(/lift .* must start with the exercise id BENCH_PRESS/);
    expect(
      validateProgram(one({ exercise: 'BENCH_PRESS', scheme: '3x5', lift: 'BENCH_PRESS@T2' }), catalog),
    ).toEqual([]);
  });
});
