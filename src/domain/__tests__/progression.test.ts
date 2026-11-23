import { builtInExercises } from '../../catalog';
import { ceilLoadableKg, floorLoadableKg, isLoadable } from '../plates';
import { setTargets } from '../program';
import { nextLift, sessionWeightKg, warmups } from '../progression';
import {
  DEFAULT_INVENTORY,
  DEFAULT_RULES,
  type Exercise,
  type LiftState,
  type PlateInventory,
  type ProgressionModel,
  type Scheme,
  type Unit,
} from '../types';
import { toKg, toUnit } from '../units';

const ex = builtInExercises();
const inv = DEFAULT_INVENTORY;
const lb125: PlateInventory = { ...inv, platesLb: [...inv.platesLb, 1.25] };
const inc = (kg: number, lb: number): Exercise => ({ ...ex.BENCH_PRESS, increment: { kg, lb } });

const run = (e: Exercise, unit: Unit, curDisplay: number, reps: number, failsBefore: number, i = inv) => {
  const weightKg = toKg(curDisplay, unit);
  const lift: LiftState = { weightKg, startKg: weightKg, fails: failsBefore };
  return nextLift(
    lift,
    {
      weightKg,
      sets: [
        { target: 5, reps: 5 },
        { target: null, reps },
      ],
    },
    DEFAULT_RULES,
    e,
    i,
    unit,
  );
};

// unit, inc, cur, reps, failsBefore, expected weight (display), failsAfter, change
type Row = [Unit, number, number, number, number, number, number, string, PlateInventory?];
const rows: Row[] = [
  ['kg', 1.25, 60, 7, 0, 62.5, 0, 'up', undefined],
  ['kg', 1.25, 60, 12, 0, 62.5, 0, 'double', undefined],
  ['kg', 2.5, 100, 6, 0, 102.5, 0, 'up', undefined],
  ['kg', 2.5, 100, 11, 0, 105, 0, 'double', undefined],
  ['kg', 2.5, 100, 4, 0, 100, 1, 'same', undefined],
  ['kg', 2.5, 100, 4, 1, 90, 0, 'deload', undefined],
  ['kg', 2.5, 62.5, 3, 1, 55, 0, 'deload', undefined],
  ['lb', 2.5, 135, 5, 0, 140, 0, 'up', undefined],
  ['lb', 2.5, 135, 5, 0, 137.5, 0, 'up', lb125],
];

test.each(rows)(
  '%s inc %s cur %s reps %s fails %s → %s (fails %s, %s)',
  (unit, i, cur, reps, f0, want, f1, change, custom) => {
    const o = run(inc(i, i), unit, cur, reps, f0, custom);
    expect(toUnit(o.next.weightKg, unit)).toBeCloseTo(want, 9);
    expect(o.next.fails).toBe(f1);
    expect(o.change).toBe(change);
  },
);

describe('bodyweight: only a rep range under double progression (or a ladder) adds load', () => {
  const chin = ex.CHINUPS;
  const go = (
    weight: number,
    reps: number[],
    progression: ProgressionModel,
    scheme: Scheme,
    patch: Partial<LiftState> = {},
    unit: Unit = 'kg',
    e: Exercise = chin,
  ) => {
    const weightKg = toKg(weight, unit);
    const lift: LiftState = { weightKg, startKg: 0, fails: 0, ...patch };
    const targets = setTargets(scheme, lift.reps);
    const sets = reps.map((r, i) => ({ target: targets[i] ?? null, reps: r }));
    const context = { progression, scheme, week: 2, lastInWeek: true, stages: [scheme, scheme] };
    const o = nextLift(lift, { weightKg, sets }, DEFAULT_RULES, e, inv, unit, context);
    return { ...o, lift, shown: toUnit(o.next.weightKg, unit) };
  };

  // Every model and scheme the built-in plans use for bodyweight extras stays exactly as before: no change.
  type Unchanged = [string, ReturnType<typeof go>];
  const unchanged: Unchanged[] = [
    ['AMRAP (GSLP chin-ups)', go(0, [5, 15], 'amrap', '2xAMRAP')],
    ['AMRAP with a minimum', go(0, [5, 15], 'amrap', '2x5+')],
    ['AMRAP miss', go(0, [5, 2], 'amrap', '2x5+', { fails: 1 })],
    ['linear (StrongLifts dips)', go(0, [12, 12], 'linear', '2xAMRAP')],
    ['linear fixed reps', go(0, [5, 5, 5], 'linear', '3x5')],
    ['double without a range (5/3/1 dips)', go(0, [20, 20, 20, 20, 20], 'double', '5xAMRAP')],
    ['double with fixed reps', go(0, [5, 5, 5], 'double', '3x5')],
    ['5/3/1', go(0, [5, 3, 1], '531', '3x5+')],
    ['stages', go(0, [1, 1, 1], 'stages', '3x5')],
    ['added load kept as it is', go(10, [5, 15], 'amrap', '2xAMRAP')],
  ];
  test.each(unchanged)('%s: none', (_name, o) => {
    expect(o.change).toBe('none');
    expect(o.next).toBe(o.lift);
  });

  type Row = [string, ReturnType<typeof go>, number, string, Partial<LiftState>];
  const rows: Row[] = [
    [
      'double adds a rep inside the range',
      go(0, [6, 6, 6], 'double', '3x5-8', { reps: 6 }),
      0,
      'reps',
      { reps: 7 },
    ],
    ['double at the top adds load', go(0, [8, 8, 8], 'double', '3x5-8', { reps: 8 }), 2.5, 'up', { reps: 5 }],
    ['double adds load in pounds', go(0, [8, 8], 'double', '2x5-8', { reps: 8 }, 'lb'), 5, 'up', { reps: 5 }],
    ['double miss counts a fail', go(0, [4, 4], 'double', '2x5-8'), 0, 'same', { fails: 1 }],
    [
      'double second miss with load deloads',
      go(10, [4, 4], 'double', '2x5-8', { fails: 1 }),
      8.75,
      'deload',
      { reps: 5 },
    ],
    [
      'double second miss without load has nothing to take off',
      go(0, [4, 4], 'double', '2x5-8', { fails: 1, reps: 7 }),
      0,
      'same',
      { fails: 0, reps: 5 },
    ],
  ];
  test.each(rows)('%s', (_name, o, weight, change, patch) => {
    expect(o.shown).toBeCloseTo(weight, 9);
    expect(o.change).toBe(change);
    expect(o.next).toMatchObject(patch);
  });

  describe('timed sets are judged by their target seconds only', () => {
    const plank = ex.CAL_PLANK;
    const carry: Exercise = { ...ex.CURLS, kind: 'dumbbell', timed: true, step: { kg: 2, lb: 5 } };
    const short = [30, 30, 12];
    test.each(['amrap', 'linear', 'double'] as const)(
      'a bodyweight plank under %s stays as it is',
      (model) => {
        expect(go(0, short, model, '3x30s', {}, 'kg', plank).change).toBe('none');
      },
    );
    test('a plank on a ladder misses with a short hold', () => {
      const o = nextLift(
        { weightKg: 0, startKg: 0, fails: 0 },
        { weightKg: 0, sets: short.map((reps) => ({ target: 30, reps })) },
        DEFAULT_RULES,
        plank,
        inv,
        'kg',
        { progression: 'ladder', ladder: 'rr_antiextension', step: 0, scheme: '3x30s' },
      );
      expect(o.change).toBe('same');
      expect(o.next.fails).toBe(1);
    });
    test.each(['amrap', 'linear', 'double'] as const)(
      'a loaded hold under %s misses with a short hold',
      (model) => {
        const o = go(10, short, model, '3x30s', {}, 'kg', carry);
        expect(o.change).toBe('same');
        expect(o.next).toMatchObject({ weightKg: 10, fails: 1 });
      },
    );
    test('a long hold under AMRAP adds one increment, never the double jump', () => {
      const o = go(10, [60, 60, 60], 'amrap', '3x30s', {}, 'kg', carry);
      expect(o.change).toBe('up');
      expect(o.shown).toBe(12);
    });
  });
});

describe('an increase that cannot change the weight is not an increase', () => {
  test('increment 0', () => {
    const o = run(inc(0, 0), 'kg', 60, 8, 0);
    expect(o.change).toBe('same');
    expect(o.next).toEqual({ weightKg: 60, startKg: 60, fails: 0 });
  });
  test('a kettlebell already at the heaviest owned size', () => {
    const bell: Exercise = { ...ex.CURLS, kind: 'kettlebell' };
    const lift: LiftState = { weightKg: 32, startKg: 16, fails: 0 };
    const sets = [5, 5, 5].map((reps) => ({ target: 5, reps }));
    const o = nextLift(lift, { weightKg: 32, sets }, DEFAULT_RULES, bell, inv, 'kg', {
      progression: 'linear',
    });
    expect(o.change).toBe('same');
    expect(o.next).toEqual(lift);
  });
});

test('uses the weight actually lifted, not the stored weight', () => {
  const lift: LiftState = { weightKg: 100, startKg: 100, fails: 0 };
  const o = nextLift(
    lift,
    { weightKg: 60, sets: [{ target: null, reps: 6 }] },
    DEFAULT_RULES,
    inc(2.5, 5),
    inv,
    'kg',
  );
  expect(o.next.weightKg).toBe(62.5);
});

test('increment override wins; doubleAt and failsBeforeDeload are respected', () => {
  const lift: LiftState = { weightKg: 60, startKg: 60, fails: 0, incrementOverride: { kg: 5, lb: 10 } };
  const r = { weightKg: 60, sets: [{ target: null, reps: 6 }] };
  expect(nextLift(lift, r, DEFAULT_RULES, inc(1.25, 2.5), inv, 'kg').next.weightKg).toBe(65);
  const strict = { ...DEFAULT_RULES, failsBeforeDeload: 0 };
  const fail = { weightKg: 60, sets: [{ target: null, reps: 2 }] };
  expect(nextLift(lift, fail, strict, inc(1.25, 2.5), inv, 'kg').change).toBe('deload');
  const lenient = { ...DEFAULT_RULES, doubleAt: 6 };
  expect(nextLift(lift, r, lenient, inc(1.25, 2.5), inv, 'kg').change).toBe('double');
});

test('deload never drops below the bar and is loadable', () => {
  const o = run(inc(2.5, 5), 'kg', 20, 1, 1);
  expect(o.next.weightKg).toBe(20);
});

test('200 successes stay loadable and bounded', () => {
  const e = inc(2.5, 5);
  let lift: LiftState = { weightKg: 60, startKg: 60, fails: 0 };
  for (let i = 0; i < 200; i++) {
    lift = nextLift(
      lift,
      { weightKg: lift.weightKg, sets: [{ target: null, reps: 6 }] },
      DEFAULT_RULES,
      e,
      inv,
      'kg',
    ).next;
    expect(isLoadable(lift.weightKg, inv, 'kg')).toBe(true);
  }
  expect(lift.weightKg).toBeLessThanOrEqual(60 + 200 * 2.5 + 2.5);
  expect(lift.weightKg).toBe(560);
});

test('200 successes in lb keep lb steps (no kg rounding leak)', () => {
  const e = inc(2.5, 5);
  let lift: LiftState = { weightKg: toKg(45, 'lb'), startKg: 0, fails: 0 };
  for (let i = 0; i < 10; i++) {
    lift = nextLift(
      lift,
      { weightKg: lift.weightKg, sets: [{ target: null, reps: 6 }] },
      DEFAULT_RULES,
      e,
      inv,
      'lb',
    ).next;
  }
  expect(toUnit(lift.weightKg, 'lb')).toBeCloseTo(45 + 10 * 5, 6);
});

test('deterministic', () => {
  expect(run(inc(2.5, 5), 'kg', 100, 9, 0)).toEqual(run(inc(2.5, 5), 'kg', 100, 9, 0));
});

test('rounding helpers agree with progression', () => {
  expect(ceilLoadableKg(61.25, inv, 'kg')).toBe(62.5);
  expect(floorLoadableKg(56.25, inv, 'kg')).toBe(55);
});

describe('warmups', () => {
  const w = (kg: number, scheme: Parameters<typeof warmups>[1], e: Exercise, unit: Unit = 'kg') =>
    warmups(kg, scheme, e, inv, unit).map((x) => [x.kg, x.reps]);
  test('squat 100 kg', () => {
    expect(w(100, '2x5+', ex.BARBELL_SQUAT)).toEqual([
      [20, 5],
      [55, 4],
      [70, 3],
      [85, 2],
    ]);
  });
  test('deadlift 140 kg', () => {
    expect(w(140, '1x5+', ex.DEADLIFT)).toEqual([
      [70, 5],
      [105, 3],
    ]);
  });
  test('bench 22.5 kg collapses to the empty bar', () => {
    expect(w(22.5, '2x5+', ex.BENCH_PRESS)).toEqual([[20, 5]]);
  });
  test('press at the bar keeps a single empty-bar set', () => {
    expect(w(20, '2x5+', ex.MILITARY_PRESS)).toEqual([[20, 5]]);
  });
  test('bodyweight and AMRAP accessories have none', () => {
    expect(w(0, '2x5+', ex.CHINUPS)).toEqual([]);
    expect(w(30, '2xAMRAP', ex.CURLS)).toEqual([]);
  });
  test('lb uses the lb bar', () => {
    const sets = warmups(toKg(225, 'lb'), '2x5+', ex.BARBELL_SQUAT, inv, 'lb');
    expect(toUnit(sets[0].kg, 'lb')).toBeCloseTo(45, 9);
    expect(sets.every((s) => isLoadable(s.kg, inv, 'lb'))).toBe(true);
  });
});

describe('linear progression (StrongLifts / Starting Strength)', () => {
  const linear = { ...DEFAULT_RULES, progression: 'linear' as const, failsBeforeDeload: 2 };
  const lift: LiftState = { weightKg: 60, startKg: 60, fails: 0 };
  const sets = (...reps: number[]) => reps.map((r) => ({ target: 5, reps: r }));

  test('all five sets of five adds one increment (never doubles)', () => {
    const o = nextLift(
      lift,
      { weightKg: 60, sets: sets(5, 5, 5, 5, 12) },
      linear,
      ex.BARBELL_SQUAT,
      inv,
      'kg',
    );
    expect(o).toMatchObject({ change: 'up', next: { weightKg: 62.5, fails: 0 } });
  });

  test('one missed rep is a failed session; the third miss in a row deloads', () => {
    const miss = { weightKg: 60, sets: sets(5, 5, 5, 5, 4) };
    let l = lift;
    l = nextLift(l, miss, linear, ex.BARBELL_SQUAT, inv, 'kg').next;
    l = nextLift(l, miss, linear, ex.BARBELL_SQUAT, inv, 'kg').next;
    expect(l).toMatchObject({ weightKg: 60, fails: 2 });
    const third = nextLift(l, miss, linear, ex.BARBELL_SQUAT, inv, 'kg');
    expect(third).toMatchObject({ change: 'deload', next: { weightKg: 52.5, fails: 0 } });
  });

  test('plan increments override the catalog, the user override beats both', () => {
    const rules = { ...linear, increments: { DEADLIFT: { kg: 5, lb: 10 } } };
    const r = { weightKg: 100, sets: [{ target: 5, reps: 5 }] };
    expect(
      nextLift({ weightKg: 100, startKg: 100, fails: 0 }, r, rules, ex.DEADLIFT, inv, 'kg').next.weightKg,
    ).toBe(105);
    const own = { weightKg: 100, startKg: 100, fails: 0, incrementOverride: { kg: 2.5, lb: 5 } };
    expect(nextLift(own, r, rules, ex.DEADLIFT, inv, 'kg').next.weightKg).toBe(102.5);
  });
});

describe('double progression (AllPro)', () => {
  const dbl = { ...DEFAULT_RULES, progression: 'double' as const };
  const ctx = { scheme: '2x8-12' as const };
  const at = (reps: number | undefined, done: number[]) =>
    nextLift(
      { weightKg: 60, startKg: 60, fails: 0, reps },
      { weightKg: 60, sets: done.map((r) => ({ target: reps ?? 8, reps: r })) },
      dbl,
      ex.BARBELL_SQUAT,
      inv,
      'kg',
      ctx,
    );

  test('hitting the target adds a rep, keeps the weight', () => {
    expect(at(undefined, [8, 8])).toMatchObject({ change: 'reps', next: { weightKg: 60, reps: 9 } });
    expect(at(11, [11, 11])).toMatchObject({ change: 'reps', next: { weightKg: 60, reps: 12 } });
  });

  test('at the top of the range the weight goes up and reps reset', () => {
    expect(at(12, [12, 12])).toMatchObject({ change: 'up', next: { weightKg: 62.5, reps: 8 } });
  });

  test('a miss repeats, a second miss deloads and resets the reps', () => {
    const first = at(10, [10, 9]);
    expect(first).toMatchObject({ change: 'same', next: { weightKg: 60, reps: 10, fails: 1 } });
    const second = nextLift(
      first.next,
      {
        weightKg: 60,
        sets: [
          { target: 10, reps: 7 },
          { target: 10, reps: 7 },
        ],
      },
      dbl,
      ex.BARBELL_SQUAT,
      inv,
      'kg',
      ctx,
    );
    expect(second).toMatchObject({ change: 'deload', next: { weightKg: 52.5, reps: 8, fails: 0 } });
  });

  test('light and medium days never change the lift', () => {
    const o = nextLift(
      { weightKg: 60, startKg: 60, fails: 0 },
      { weightKg: 47.5, sets: [{ target: 8, reps: 8 }] },
      dbl,
      ex.BARBELL_SQUAT,
      inv,
      'kg',
      { ...ctx, intensity: 0.8 },
    );
    expect(o.change).toBe('none');
  });
});

test('session weight on a light day is re-rounded to a loadable weight', () => {
  expect(sessionWeightKg(100, 0.8, ex.BARBELL_SQUAT, inv, 'kg')).toBe(80);
  expect(sessionWeightKg(62.5, 0.9, ex.BARBELL_SQUAT, inv, 'kg')).toBe(55); // 56.25: ties round down
  expect(sessionWeightKg(62.5, 1, ex.BARBELL_SQUAT, inv, 'kg')).toBe(62.5);
  // Bodyweight: the added load, scaled and rounded to single plates; 0 means no added load.
  expect(sessionWeightKg(10, 1, ex.CHINUPS, inv, 'kg')).toBe(10);
  expect(sessionWeightKg(10, 0.8, ex.CHINUPS, inv, 'kg')).toBe(7.5);
  expect(sessionWeightKg(0, 0.8, ex.CHINUPS, inv, 'kg')).toBe(0);
});

test('warm-ups: single-set schemes get two jumps, 5x5 ramps from the bar, rep-range work too', () => {
  const w = (kg: number, scheme: Parameters<typeof warmups>[1], e: Exercise) =>
    warmups(kg, scheme, e, inv, 'kg').map((x) => x.kg);
  expect(w(140, '1x5', ex.DEADLIFT)).toEqual([70, 105]);
  expect(w(100, '5x5', ex.BARBELL_SQUAT)).toEqual([20, 55, 70, 85]);
  expect(w(100, '2x8-12', ex.BARBELL_SQUAT)).toEqual([20, 55, 70, 85]);
  // An EZ bar (10 kg) starts from its own bar.
  expect(w(30, '3x8', { ...ex.BARBELL_SQUAT, barKg: { kg: 10, lb: 25 } })[0]).toBe(10);
});
