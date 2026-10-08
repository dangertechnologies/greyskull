import { nearestLoadableKg } from '../plates';
import { DEFAULT_INVENTORY } from '../types';
import { formatWeight, KG_PER_LB, toKg, toUnit, trim } from '../units';

test('constants and formatting', () => {
  expect(KG_PER_LB).toBe(0.45359237);
  expect(trim(62.5)).toBe('62.5');
  expect(trim(60)).toBe('60');
  expect(trim(61.25)).toBe('61.25');
  expect(trim(20.4999999)).toBe('20.5');
  expect(formatWeight(62.5, 'kg')).toBe('62.5 kg');
  expect(formatWeight(toKg(135, 'lb'), 'lb')).toBe('135 lb');
});

test('135 lb → kg → lb → nearest loadable is 135', () => {
  const kg = toKg(135, 'lb');
  expect(toUnit(nearestLoadableKg(kg, DEFAULT_INVENTORY, 'lb'), 'lb')).toBeCloseTo(135, 9);
});

test('1000 round trips keep the value', () => {
  let kg = 61.23496995;
  for (let i = 0; i < 1000; i++) kg = toKg(toUnit(kg, 'lb'), 'lb');
  expect(Math.abs(kg - 61.23496995)).toBeLessThan(1e-9);
});
