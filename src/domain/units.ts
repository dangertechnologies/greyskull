import type { Unit } from './types';

export const KG_PER_LB = 0.45359237;

export const toUnit = (kg: number, unit: Unit): number => (unit === 'kg' ? kg : kg / KG_PER_LB);
export const toKg = (value: number, unit: Unit): number => (unit === 'kg' ? value : value * KG_PER_LB);

/** Up to 2 decimals, trailing zeros dropped: 62.5 → "62.5", 60 → "60", 61.25 → "61.25". */
export function trim(value: number, decimals = 2): string {
  return String(Number(value.toFixed(decimals)));
}

/** Finest display step per unit: a real bar never lands between these, and converted history should not look like it does. */
const DISPLAY_STEP: Record<Unit, number> = { kg: 0.25, lb: 0.5 };

/**
 * Weights for display, to the nearest 0.25 kg or 0.5 lb. Every loadable weight is already on that grid, so
 * only converted history moves: a 130 lb session reads "59 kg", not "58.97 kg", and a v1 import's 2-decimal
 * kilograms come back as "185 lb", not "184.99 lb".
 */
export const formatWeight = (kg: number, unit: Unit): string => {
  const step = DISPLAY_STEP[unit];
  return `${trim(Math.round(toUnit(kg, unit) / step) * step)} ${unit}`;
};
