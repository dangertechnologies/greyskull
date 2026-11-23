import { active } from '../../__fixtures__/oneProgram';
import { builtInExercises } from '../../catalog';
import { setOrder } from '../groups';
import { sessionFor, validateProgram } from '../program';
import { DEFAULT_RULES, type Group, type Program, type Scheme, type Slot } from '../types';

const ex = builtInExercises();
const day = (slots: Slot[], groups: Group[]): Program => ({
  template: 'custom',
  sessionsPerWeek: 3,
  rules: DEFAULT_RULES,
  days: [{ name: 'A', slots, groups }],
});
const s = (exercise: string, scheme: Scheme, group?: string): Slot => ({
  exercise,
  scheme,
  ...(group ? { group } : {}),
});
const order = (p: Program, sets: Record<string, number>) => setOrder(sessionFor(active(p)), sets);

describe('setOrder', () => {
  test('ungrouped slots go set by set, one exercise after the other', () => {
    const p = day([s('BARBELL_SQUAT', '2x5'), s('BENCH_PRESS', '1x5')], []);
    expect(order(p, { BARBELL_SQUAT: 2, BENCH_PRESS: 1 })).toEqual([
      { exercise: 'BARBELL_SQUAT', set: 0 },
      { exercise: 'BARBELL_SQUAT', set: 1 },
      { exercise: 'BENCH_PRESS', set: 0 },
    ]);
  });

  test('a superset alternates its exercises and rests after each round', () => {
    const p = day(
      [s('CHINUPS', '2x5', 'a'), s('DIPS', '2x5', 'a'), s('BARBELL_SQUAT', '1x5')],
      [{ id: 'a', kind: 'superset', restS: 90 }],
    );
    expect(order(p, { CHINUPS: 2, DIPS: 2, BARBELL_SQUAT: 1 })).toEqual([
      { exercise: 'CHINUPS', set: 0, group: 'a' },
      { exercise: 'DIPS', set: 0, group: 'a', restAfterS: 90 },
      { exercise: 'CHINUPS', set: 1, group: 'a' },
      { exercise: 'DIPS', set: 1, group: 'a', restAfterS: 90 },
      { exercise: 'BARBELL_SQUAT', set: 0 },
    ]);
  });

  test('a superset with uneven set counts keeps every set', () => {
    const p = day([s('CHINUPS', '3x5', 'a'), s('DIPS', '2x5', 'a')], [{ id: 'a', kind: 'superset' }]);
    expect(order(p, { CHINUPS: 3, DIPS: 2 }).map((e) => `${e.exercise}${e.set}`)).toEqual([
      'CHINUPS0',
      'DIPS0',
      'CHINUPS1',
      'DIPS1',
      'CHINUPS2',
    ]);
  });

  test('a circuit does one set of each slot per round', () => {
    const p = day(
      [s('BARBELL_SQUAT', '1x5'), s('CHINUPS', '3x5', 'c'), s('DIPS', '3x5', 'c'), s('CRUNCHES', '3x5', 'c')],
      [{ id: 'c', kind: 'circuit', rounds: 3, restS: 60 }],
    );
    const walk = order(p, { BARBELL_SQUAT: 1, CHINUPS: 3, DIPS: 3, CRUNCHES: 3 });
    expect(walk[0]).toEqual({ exercise: 'BARBELL_SQUAT', set: 0 });
    expect(walk.slice(1, 4)).toEqual([
      { exercise: 'CHINUPS', set: 0, group: 'c' },
      { exercise: 'DIPS', set: 0, group: 'c' },
      { exercise: 'CRUNCHES', set: 0, group: 'c', restAfterS: 60 },
    ]);
    expect(walk).toHaveLength(10);
    expect(walk.at(-1)).toEqual({ exercise: 'CRUNCHES', set: 2, group: 'c', restAfterS: 60 });
  });

  test('an EMOM does slot k mod n in minute k', () => {
    const p = day([s('CHINUPS', '3x5', 'e'), s('DIPS', '3x5', 'e')], [{ id: 'e', kind: 'emom', minutes: 6 }]);
    expect(order(p, { CHINUPS: 3, DIPS: 3 })).toEqual([
      { exercise: 'CHINUPS', set: 0, group: 'e', atS: 0 },
      { exercise: 'DIPS', set: 0, group: 'e', atS: 60 },
      { exercise: 'CHINUPS', set: 1, group: 'e', atS: 120 },
      { exercise: 'DIPS', set: 1, group: 'e', atS: 180 },
      { exercise: 'CHINUPS', set: 2, group: 'e', atS: 240 },
      { exercise: 'DIPS', set: 2, group: 'e', atS: 300 },
    ]);
  });

  test('an interval works then rests each round', () => {
    const p = day(
      [s('CAL_PLANK', '4x20s', 'i')],
      [{ id: 'i', kind: 'interval', rounds: 4, workS: 20, restS: 10 }],
    );
    expect(order(p, { CAL_PLANK: 4 })).toEqual([
      { exercise: 'CAL_PLANK', set: 0, group: 'i', atS: 0, restAfterS: 10 },
      { exercise: 'CAL_PLANK', set: 1, group: 'i', atS: 30, restAfterS: 10 },
      { exercise: 'CAL_PLANK', set: 2, group: 'i', atS: 60, restAfterS: 10 },
      { exercise: 'CAL_PLANK', set: 3, group: 'i', atS: 90, restAfterS: 10 },
    ]);
  });

  test('sessionFor copies the day groups', () => {
    const groups: Group[] = [{ id: 'a', kind: 'superset' }];
    const p = day([s('CHINUPS', '2x5', 'a'), s('DIPS', '2x5', 'a')], groups);
    expect(sessionFor(active(p)).groups).toEqual(groups);
  });
});

describe('validateProgram with groups', () => {
  test('valid groups of every kind', () => {
    const p = day(
      [
        s('CHINUPS', '3x5', 'a'),
        s('DIPS', '3x5', 'a'),
        s('CRUNCHES', '3x8-12', 'c'),
        { ...s('CAL_PLANK', '3x10-30s', 'c'), progression: 'double' },
        s('BARBELL_SQUAT', '3x5', 'e'),
        s('BENCH_PRESS', '3x5', 'e'),
        { ...s('CAL_SUPPORT_HOLD', '4x20s', 'i'), progression: 'linear' },
      ],
      [
        { id: 'a', kind: 'superset', restS: 90 },
        { id: 'c', kind: 'circuit', rounds: 3, restS: 60 },
        { id: 'e', kind: 'emom', minutes: 6 },
        { id: 'i', kind: 'interval', rounds: 4, workS: 20, restS: 10 },
      ],
    );
    expect(validateProgram(p, ex)).toEqual([]);
  });

  test('a ladder in a circuit is checked against every step scheme', () => {
    const ladder = (scheme: Scheme): Slot => ({
      exercise: 'CAL_PLANK',
      scheme,
      ladder: 'rr_antiextension',
      group: 'c',
    });
    const circuit = (scheme: Scheme) =>
      day([ladder(scheme), s('CHINUPS', '3x5', 'c')], [{ id: 'c', kind: 'circuit', rounds: 3 }]);
    expect(validateProgram(circuit('3x8-12'), ex)).toEqual([]);
    // The first step brings its own 3-set hold scheme, so a 4-set slot scheme disagrees on the later steps.
    expect(validateProgram(circuit('4x8-12'), ex).join()).toMatch(/3 rounds/);
  });

  type Row = [string, Slot[], Group[], RegExp];
  const two = (group: string, scheme: Scheme = '3x5') => [
    s('CHINUPS', scheme, group),
    s('DIPS', scheme, group),
  ];
  const rows: Row[] = [
    ['unknown group', [s('CHINUPS', '3x5', 'x')], [], /unknown group x/],
    [
      'duplicate group id',
      two('a'),
      [
        { id: 'a', kind: 'superset' },
        { id: 'a', kind: 'circuit' },
      ],
      /twice/,
    ],
    ['unknown kind', two('a'), [{ id: 'a', kind: 'tabata' as never }], /unknown group kind/],
    [
      'slots not next to each other',
      [s('CHINUPS', '3x5', 'a'), s('BARBELL_SQUAT', '3x5'), s('DIPS', '3x5', 'a')],
      [{ id: 'a', kind: 'superset' }],
      /next to each other/,
    ],
    ['a superset of one', [s('CHINUPS', '3x5', 'a')], [{ id: 'a', kind: 'superset' }], /at least 2/],
    ['a circuit of one', [s('CHINUPS', '3x5', 'c')], [{ id: 'c', kind: 'circuit', rounds: 3 }], /at least 2/],
    ['an empty EMOM', [s('CHINUPS', '3x5')], [{ id: 'e', kind: 'emom', minutes: 3 }], /at least 1/],
    ['a circuit without rounds', two('c'), [{ id: 'c', kind: 'circuit' }], /rounds/],
    ['circuit sets differ from rounds', two('c'), [{ id: 'c', kind: 'circuit', rounds: 4 }], /4 rounds/],
    [
      'interval sets differ from rounds',
      [s('CAL_PLANK', '3x20s', 'i')],
      [{ id: 'i', kind: 'interval', rounds: 4, workS: 20 }],
      /4 rounds/,
    ],
    [
      'an interval without work time',
      [s('CAL_PLANK', '4x20s', 'i')],
      [{ id: 'i', kind: 'interval', rounds: 4 }],
      /work/,
    ],
    ['EMOM minutes not divisible', two('e'), [{ id: 'e', kind: 'emom', minutes: 7 }], /divide/],
    ['EMOM sets differ from minutes', two('e'), [{ id: 'e', kind: 'emom', minutes: 8 }], /4 sets/],
    ['rest above 600 s', two('a'), [{ id: 'a', kind: 'superset', restS: 601 }], /rest/],
    ['negative rest', two('a'), [{ id: 'a', kind: 'superset', restS: -1 }], /rest/],
    [
      'work above 600 s',
      [s('CAL_PLANK', '4x20s', 'i')],
      [{ id: 'i', kind: 'interval', rounds: 4, workS: 601 }],
      /work/,
    ],
  ];
  test.each(rows)('%s', (_name, slots, groups, error) => {
    expect(validateProgram(day(slots, groups), ex).join('\n')).toMatch(error);
  });
});

describe('group limits', () => {
  const circuit = (rounds: number) =>
    day(
      [s('BARBELL_SQUAT', '3x5', 'g1'), s('BENCH_PRESS', '3x5', 'g1')],
      [{ id: 'g1', kind: 'circuit', rounds }],
    );
  const emom = (minutes: number) =>
    day([s('BARBELL_SQUAT', '3x5', 'g1')], [{ id: 'g1', kind: 'emom', minutes }]);

  test('rounds and minutes stay within what the group editor offers', () => {
    for (const bad of [0, 21, 1e9, Number.NaN, Number.POSITIVE_INFINITY, -3, 2.5])
      expect(validateProgram(circuit(bad), ex).join(' ')).toMatch(/set 1 to 20 rounds/);
    for (const bad of [0, 61, 1e9, Number.NaN, Number.POSITIVE_INFINITY])
      expect(validateProgram(emom(bad), ex).join(' ')).toMatch(/set 1 to 60 minutes/);
    expect(validateProgram(emom(3), ex)).toEqual([]);
  });
});
