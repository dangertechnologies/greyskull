import type { Unit } from './types';

export const KG_PER_LB = 0.45359237;

export const toUnit = (kg: number, unit: Unit): number => (unit === 'kg' ? kg : kg / KG_PER_LB);
export const toKg = (value: number, unit: Unit): number => (unit === 'kg' ? value : value * KG_PER_LB);

/** Up to 2 decimals, trailing zeros dropped: 62.5 → "62.5", 60 → "60", 61.25 → "61.25". */
export function trim(value: number, decimals = 2): string {
  return String(Number(value.toFixed(decimals)));
}

/**
 * Pounds get 1 decimal: every loadable lb weight is a multiple of 0.5, and v1 stored
 * pounds as 2-decimal kilograms, which would otherwise come back as "184.99 lb".
 */
export const formatWeight = (kg: number, unit: Unit): string =>
  `${trim(toUnit(kg, unit), unit === 'lb' ? 1 : 2)} ${unit}`;
