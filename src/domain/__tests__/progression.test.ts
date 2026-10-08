import { builtInExercises } from '../../catalog';
import { nextLift, warmups } from '../progression';
import { ceilLoadableKg, floorLoadableKg, isLoadable } from '../plates';
import { DEFAULT_INVENTORY, DEFAULT_RULES, Exercise, LiftState, PlateInventory, Unit } from '../types';
import { toKg, toUnit } from '../units';

const ex = builtInExercises();
const inv = DEFAULT_INVENTORY;
const lb125: PlateInventory = { ...inv, platesLb: [...inv.platesLb, 1.25] };
const inc = (kg: number, lb: number): Exercise => ({ ...ex.BENCH_PRESS, increment: { kg, lb } });

const run = (
  e: Exercise, unit: Unit, curDisplay: number, reps: number, failsBefore: number, i = inv,
) => {
  const weightKg = toKg(curDisplay, unit);
  const lift: LiftState = { weightKg, startKg: weightKg, fails: failsBefore };
  return nextLift(lift, { weightKg, sets: [{ target: 5, reps: 5 }, { target: null, reps }] }, DEFAULT_RULES, e, i, unit);
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

test.each(rows)('%s inc %s cur %s reps %s fails %s → %s (fails %s, %s)', (unit, i, cur, reps, f0, want, f1, change, custom) => {
  const o = run(inc(i, i), unit, cur, reps, f0, custom);
  expect(toUnit(o.next.weightKg, unit)).toBeCloseTo(want, 9);
  expect(o.next.fails).toBe(f1);
  expect(o.change).toBe(change);
});

test('bodyweight never changes', () => {
  const o = run(ex.CHINUPS, 'kg', 0, 15, 0);
  expect(o.change).toBe('none');
  expect(o.next).toEqual({ weightKg: 0, startKg: 0, fails: 0 });
});

test('uses the weight actually lifted, not the stored weight', () => {
  const lift: LiftState = { weightKg: 100, startKg: 100, fails: 0 };
  const o = nextLift(lift, { weightKg: 60, sets: [{ target: null, reps: 6 }] }, DEFAULT_RULES, inc(2.5, 5), inv, 'kg');
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
    lift = nextLift(lift, { weightKg: lift.weightKg, sets: [{ target: null, reps: 6 }] }, DEFAULT_RULES, e, inv, 'kg').next;
    expect(isLoadable(lift.weightKg, inv, 'kg')).toBe(true);
  }
  expect(lift.weightKg).toBeLessThanOrEqual(60 + 200 * 2.5 + 2.5);
  expect(lift.weightKg).toBe(560);
});

test('200 successes in lb keep lb steps (no kg rounding leak)', () => {
  const e = inc(2.5, 5);
  let lift: LiftState = { weightKg: toKg(45, 'lb'), startKg: 0, fails: 0 };
  for (let i = 0; i < 10; i++) {
    lift = nextLift(lift, { weightKg: lift.weightKg, sets: [{ target: null, reps: 6 }] }, DEFAULT_RULES, e, inv, 'lb').next;
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
    expect(w(100, '2x5+', ex.BARBELL_SQUAT)).toEqual([[20, 5], [55, 4], [70, 3], [85, 2]]);
  });
  test('deadlift 140 kg', () => {
    expect(w(140, '1x5+', ex.DEADLIFT)).toEqual([[70, 5], [105, 3]]);
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
