import { builtInExercises } from '../../catalog';
import {
  ceilLoadableKg,
  floorLoadableKg,
  formatPlates,
  inventoryFor,
  inventoryProblem,
  loadable,
  nearestLoadableKg,
  platesPerSide,
  roundAddedLoad,
  roundForExercise,
  smallestStep,
} from '../plates';
import { DEFAULT_INVENTORY, type PlateInventory, type Unit } from '../types';
import { toKg, toUnit } from '../units';

const inv = DEFAULT_INVENTORY;
const withPlates = (patch: Partial<PlateInventory>): PlateInventory => ({ ...inv, ...patch });
const half = withPlates({ platesKg: [...inv.platesKg, 0.5] });
const lbSmall = withPlates({ platesLb: [...inv.platesLb, 1.25] });
const two = withPlates({ platesKg: [20, 15] });
const none = withPlates({ platesKg: [] });

type Row = [string, PlateInventory, Unit, number, number, number, number, number[]];
const rows: Row[] = [
  ['default kg 61', inv, 'kg', 61, 60, 62.5, 60, [20, 1.25]],
  ['default + 0.5 kg 61', half, 'kg', 61, 61, 61, 61, [20, 0.5]],
  ['default kg 20', inv, 'kg', 20, 20, 20, 20, []],
  ['default kg 10', inv, 'kg', 10, 20, 20, 20, []],
  ['default lb 137', inv, 'lb', 137, 135, 140, 135, [45, 2.5]],
  ['default + 1.25 lb 137', lbSmall, 'lb', 137, 137.5, 137.5, 135, [45, 1.25]],
  ['20/15 kg 50', two, 'kg', 50, 50, 50, 50, [15]],
  ['20/15 kg 52', two, 'kg', 52, 50, 60, 50, [20]],
  ['no plates kg 100', none, 'kg', 100, 20, 20, 20, []],
];

describe('loadable weights (display unit in, kg out)', () => {
  test.each(rows)('%s', (_n, i, unit, input, nearest, ceil, floor, side) => {
    const kg = toKg(input, unit);
    expect(toUnit(nearestLoadableKg(kg, i, unit), unit)).toBeCloseTo(nearest, 9);
    expect(toUnit(ceilLoadableKg(kg, i, unit), unit)).toBeCloseTo(ceil, 9);
    expect(toUnit(floorLoadableKg(kg, i, unit), unit)).toBeCloseTo(floor, 9);
    expect(platesPerSide(ceilLoadableKg(kg, i, unit), i, unit)).toEqual(side);
  });
});

test('smallest step', () => {
  expect(smallestStep(inv, 'kg')).toBe(2.5);
  expect(smallestStep(inv, 'lb')).toBe(5);
  expect(smallestStep(none, 'kg')).toBe(0);
});

test('every 2.5 kg step from 20 to 200 is loadable and plates sum back', () => {
  for (let total = 20; total <= 200; total += 2.5) {
    expect(nearestLoadableKg(total, inv, 'kg')).toBe(total);
    const side = platesPerSide(total, inv, 'kg');
    expect(20 + 2 * side.reduce((a, b) => a + b, 0)).toBe(total);
  }
});

test('plate reconstruction uses the fewest plates, largest first', () => {
  expect(platesPerSide(100, inv, 'kg')).toEqual([25, 15]);
  expect(platesPerSide(60, inv, 'kg')).toEqual([20]);
  expect(formatPlates(82.5, inv, 'kg')).toBe('per side: 25 + 5 + 1.25');
  expect(formatPlates(20, inv, 'kg')).toBe('bar only');
  expect(platesPerSide(61, inv, 'kg')).toEqual([]);
  expect(formatPlates(61, inv, 'kg')).toBe('not loadable with your plates');
});

test('float noise from lb round trips does not break lookups', () => {
  const kg = toKg(135, 'lb');
  expect(platesPerSide(kg, inv, 'lb')).toEqual([45]);
  // v1 stored 185 lb as 83.91 kg (184.99 lb): it still gets its plates, not "bar only".
  expect(platesPerSide(83.91, inv, 'lb')).toEqual(platesPerSide(toKg(185, 'lb'), inv, 'lb'));
  expect(platesPerSide(83.91, inv, 'lb').length).toBeGreaterThan(0);
  expect(toUnit(ceilLoadableKg(kg + 1e-12, lbSmall, 'lb'), 'lb')).toBeCloseTo(135, 9);
});

test('loadable() memoises and lists bar first', () => {
  const a = loadable(inv, 'kg');
  expect(loadable(inv, 'kg')).toBe(a);
  expect(a.totals[0]).toBe(20);
  expect(loadable(none, 'kg').totals).toEqual([20]);
});

describe('roundForExercise', () => {
  const ex = builtInExercises();
  const dumbbell = { ...ex.CURLS, kind: 'dumbbell' as const };
  test('barbell uses plates; bodyweight added load uses single plates', () => {
    expect(roundForExercise(61, ex.BENCH_PRESS, 'ceil', inv, 'kg')).toBe(62.5);
    expect(roundForExercise(61, ex.CHINUPS, 'ceil', inv, 'kg')).toBe(61.25);
    expect(roundForExercise(0, ex.CHINUPS, 'nearest', inv, 'kg')).toBe(0);
  });

  const bell = { ...ex.CURLS, kind: 'kettlebell' as const };
  type Bell = [string, Unit, number, 'nearest' | 'ceil' | 'floor', number, PlateInventory?];
  const bells: Bell[] = [
    ['nearest owned size', 'kg', 17, 'nearest', 16],
    ['ties go to the lighter bell', 'kg', 18, 'nearest', 16],
    ['ceil', 'kg', 17, 'ceil', 20],
    ['floor', 'kg', 19, 'floor', 16],
    ['an owned size stays', 'kg', 24, 'ceil', 24],
    ['above the heaviest bell', 'kg', 40, 'ceil', 32],
    ['below the lightest bell', 'kg', 5, 'floor', 8],
    ['pounds nearest', 'lb', 30, 'nearest', 26],
    ['pounds ceil', 'lb', 30, 'ceil', 35],
    ['pounds floor', 'lb', 50, 'floor', 44],
    ['only the bells you own', 'kg', 20, 'nearest', 24, withPlates({ kettlebellsKg: [12, 24] })],
  ];
  test.each(bells)('kettlebell: %s', (_name, unit, input, mode, want, i = inv) => {
    expect(toUnit(roundForExercise(toKg(input, unit), bell, mode, i, unit), unit)).toBeCloseTo(want, 9);
  });
  test('kettlebell without owned sizes falls back to its rounding step', () => {
    const noBells = withPlates({ kettlebellsKg: [], kettlebellsLb: [] });
    expect(roundForExercise(17, bell, 'nearest', noBells, 'kg')).toBe(18);
  });

  test('an exercise bar (EZ bar 10 kg / 25 lb) replaces the gym bar', () => {
    const ez = { ...ex.BENCH_PRESS, barKg: { kg: 10, lb: 25 } };
    expect(roundForExercise(5, ez, 'nearest', inv, 'kg')).toBe(10);
    expect(roundForExercise(13, ez, 'nearest', inv, 'kg')).toBe(12.5);
    expect(roundForExercise(13, ex.BENCH_PRESS, 'nearest', inv, 'kg')).toBe(20);
    expect(toUnit(roundForExercise(toKg(31, 'lb'), ez, 'nearest', inv, 'lb'), 'lb')).toBeCloseTo(30, 9);
    expect(inventoryFor(ez, inv)).toMatchObject({ barKg: 10, barLb: 25 });
    expect(inventoryFor(ex.BENCH_PRESS, inv)).toBe(inv);
  });
  test('dumbbell rounds to step in display unit', () => {
    expect(roundForExercise(11, dumbbell, 'ceil', inv, 'kg')).toBe(12);
    expect(roundForExercise(11, dumbbell, 'floor', inv, 'kg')).toBe(10);
    expect(roundForExercise(12, dumbbell, 'ceil', inv, 'kg')).toBe(12);
    expect(toUnit(roundForExercise(toKg(22, 'lb'), dumbbell, 'ceil', inv, 'lb'), 'lb')).toBeCloseTo(25, 9);
  });
});

describe('roundAddedLoad (single plates on a dip belt)', () => {
  type Row = [string, Unit, number, 'nearest' | 'ceil' | 'floor' | undefined, number, PlateInventory?];
  const rows: Row[] = [
    ['nearest multiple of the smallest plate', 'kg', 3, undefined, 2.5],
    ['rounds up past the half', 'kg', 3.2, undefined, 3.75],
    ['ceil', 'kg', 2.6, 'ceil', 3.75],
    ['floor', 'kg', 3.7, 'floor', 2.5],
    ['zero stays zero', 'kg', 0, undefined, 0],
    ['never negative', 'kg', -3, 'floor', 0],
    ['pounds', 'lb', 7, undefined, 7.5],
    ['with 0.5 kg plates', 'kg', 3.2, undefined, 3, half],
  ];
  test.each(rows)('%s', (_name, unit, input, mode, want, i = inv) => {
    expect(toUnit(roundAddedLoad(toKg(input, unit), i, unit, mode), unit)).toBeCloseTo(want, 9);
  });
  test('no plates leaves the load as it is', () => {
    expect(roundAddedLoad(3.3, none, 'kg')).toBe(3.3);
  });
});

describe('a damaged or hostile inventory', () => {
  test('a bar that is negative, zero, huge or not a number loads nothing, without a huge search', () => {
    for (const barKg of [-1e9, -20, 0, 51, 1e9, Number.NaN, Number.POSITIVE_INFINITY]) {
      const started = Date.now();
      expect(loadable(withPlates({ barKg }), 'kg').totals).toEqual([]);
      expect(Date.now() - started).toBeLessThan(500);
    }
    expect(loadable(withPlates({ barLb: 111 }), 'lb').totals).toEqual([]);
    expect(loadable(withPlates({ barLb: 110 }), 'lb').totals.length).toBeGreaterThan(0);
  });

  test('plates out of range are left out and a long list is cut short', () => {
    const junk = withPlates({ platesKg: [20, 0.001, -5, 1e9, Number.NaN, Number.POSITIVE_INFINITY] });
    expect(loadable(junk, 'kg').totals).toEqual(loadable(withPlates({ platesKg: [20] }), 'kg').totals);
    expect(smallestStep(junk, 'kg')).toBe(40);
    const many = withPlates({ platesKg: Array.from({ length: 5000 }, (_, i) => 1 + i / 1000) });
    const started = Date.now();
    loadable(many, 'kg');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  test("an exercise's own bar only counts when it is in range in both units", () => {
    const ez = { ...builtInExercises().BARBELL_SQUAT };
    for (const barKg of [
      { kg: -10, lb: 25 },
      { kg: 10, lb: -25 },
      { kg: 1e9, lb: 25 },
      { kg: 10, lb: 111 },
      { kg: Number.NaN, lb: 25 },
    ])
      expect(inventoryFor({ ...ez, barKg }, inv)).toBe(inv);
    expect(inventoryFor({ ...ez, barKg: { kg: 10, lb: 25 } }, inv)).toEqual({ ...inv, barKg: 10, barLb: 25 });
  });

  test('inventoryProblem accepts the defaults and names what is out of range', () => {
    expect(inventoryProblem(inv)).toBeNull();
    expect(inventoryProblem(withPlates({ platesKg: [...inv.platesKg, 0.5, 0.25] }))).toBeNull();
    // Missing fields are filled from the defaults on load.
    expect(inventoryProblem({ barKg: 20 })).toBeNull();
    for (const bad of [
      null,
      [],
      'inventory',
      withPlates({ barKg: 0 }),
      withPlates({ barKg: -20 }),
      withPlates({ barKg: 51 }),
      withPlates({ barLb: 111 }),
      withPlates({ barKg: Number.NaN }),
      withPlates({ platesKg: [20, -5] }),
      withPlates({ platesKg: [20, 0.1] }),
      withPlates({ platesLb: [45, 1e9] }),
      withPlates({ platesKg: Array.from({ length: 21 }, (_, i) => i + 1) }),
      withPlates({ platesKg: 'x' as never }),
      withPlates({ kettlebellsKg: [16, 1000] }),
      withPlates({ kettlebellsLb: [Number.POSITIVE_INFINITY] }),
      withPlates({ kettlebellsKg: Array.from({ length: 41 }, () => 16) }),
      withPlates({ kettlebellsLb: null as never }),
    ])
      expect([bad, inventoryProblem(bad)]).toEqual([bad, expect.any(String)]);
  });
});
