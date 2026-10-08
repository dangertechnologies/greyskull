import { builtInExercises } from '../../catalog';
import {
  ceilLoadableKg,
  floorLoadableKg,
  formatPlates,
  loadable,
  nearestLoadableKg,
  platesPerSide,
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
});

test('float noise from lb round trips does not break lookups', () => {
  const kg = toKg(135, 'lb');
  expect(platesPerSide(kg, inv, 'lb')).toEqual([45]);
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
  test('barbell uses plates; bodyweight is untouched', () => {
    expect(roundForExercise(61, ex.BENCH_PRESS, 'ceil', inv, 'kg')).toBe(62.5);
    expect(roundForExercise(61, ex.CHINUPS, 'ceil', inv, 'kg')).toBe(61);
  });
  test('dumbbell rounds to step in display unit', () => {
    expect(roundForExercise(11, dumbbell, 'ceil', inv, 'kg')).toBe(12);
    expect(roundForExercise(11, dumbbell, 'floor', inv, 'kg')).toBe(10);
    expect(roundForExercise(12, dumbbell, 'ceil', inv, 'kg')).toBe(12);
    expect(toUnit(roundForExercise(toKg(22, 'lb'), dumbbell, 'ceil', inv, 'lb'), 'lb')).toBeCloseTo(25, 9);
  });
});
