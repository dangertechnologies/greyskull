import type { Unit } from './types';

export const KG_PER_LB = 0.45359237;

export const toUnit = (kg: number, unit: Unit): number => (unit === 'kg' ? kg : kg / KG_PER_LB);
export const toKg = (value: number, unit: Unit): number => (unit === 'kg' ? value : value * KG_PER_LB);

/** Up to 2 decimals, trailing zeros dropped: 62.5 → "62.5", 60 → "60", 61.25 → "61.25". */
export function trim(value: number): string {
  return String(Number(value.toFixed(2)));
}

export const formatWeight = (kg: number, unit: Unit): string => `${trim(toUnit(kg, unit))} ${unit}`;
