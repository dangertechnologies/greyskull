import type { Exercise, PlateInventory, Unit } from './types';
import { toKg, toUnit, trim } from './units';

export interface Loadable {
  totals: number[]; // ascending, in display unit
  perSide: Map<number, number[]>; // total → plates on one side, largest first
}

/** Tolerance (display unit) for float noise after kg ↔ lb round trips. */
const EPS = 1e-6;
/**
 * Plate lookups match a total within what the display rounds away (pounds show 1 decimal), so v1's
 * 2-decimal kilograms (185 lb stored as 83.91 kg = 184.99 lb) still get their plates. Loadable totals are
 * at least 0.5 apart in either unit, so this never picks the wrong one.
 */
const DISPLAY_EPS = 0.05;

const q = (v: number): number => Math.round(v * 4);

const cache = new Map<string, Loadable>();

function barOf(inv: PlateInventory, unit: Unit): number {
  return unit === 'kg' ? inv.barKg : inv.barLb;
}

function platesOf(inv: PlateInventory, unit: Unit): number[] {
  return [...(unit === 'kg' ? inv.platesKg : inv.platesLb)].sort((a, b) => b - a);
}

/** True if candidate (sorted desc) has fewer plates, or the same count and a larger leading plate. */
function better(candidate: number[], current: number[] | null): boolean {
  if (current === null) return true;
  if (candidate.length !== current.length) return candidate.length < current.length;
  for (let i = 0; i < candidate.length; i++) {
    if (candidate[i] !== current[i]) return candidate[i] > current[i];
  }
  return false;
}

export function loadable(inv: PlateInventory, unit: Unit, maxTotal = 1000): Loadable {
  const key = JSON.stringify([inv, unit, maxTotal]);
  const hit = cache.get(key);
  if (hit) return hit;

  const bar = barOf(inv, unit);
  const plates = platesOf(inv, unit).filter((p) => p > 0);
  const maxSide = Math.max(0, q((maxTotal - bar) / 2));
  const best: (number[] | null)[] = new Array<number[] | null>(maxSide + 1).fill(null);
  best[0] = [];
  for (let s = 1; s <= maxSide; s++) {
    for (const p of plates) {
      const qp = q(p);
      const prev = qp <= s ? best[s - qp] : null;
      if (!prev) continue;
      const candidate = [...prev, p].sort((a, b) => b - a);
      if (better(candidate, best[s])) best[s] = candidate;
    }
  }

  const totals: number[] = [];
  const perSide = new Map<number, number[]>();
  best.forEach((sidePlates, s) => {
    if (!sidePlates) return;
    const total = bar + (2 * s) / 4;
    totals.push(total);
    perSide.set(total, sidePlates);
  });
  const result: Loadable = { totals, perSide };
  cache.set(key, result);
  return result;
}

/** Index of the first total ≥ value − EPS (totals.length if none). */
function lowerIndex(totals: number[], value: number): number {
  let lo = 0;
  let hi = totals.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (totals[mid] < value - EPS) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function pick(kg: number, inv: PlateInventory, unit: Unit, mode: 'nearest' | 'ceil' | 'floor'): number {
  const { totals } = loadable(inv, unit);
  const value = toUnit(kg, unit);
  const i = lowerIndex(totals, value); // smallest total ≥ value
  const up = totals[Math.min(i, totals.length - 1)];
  // Largest total ≤ value (+ tolerance): step back unless the hit is within tolerance.
  const exact = i < totals.length && Math.abs(totals[i] - value) <= EPS;
  const down = exact ? totals[i] : totals[Math.max(i - 1, 0)];
  let chosen: number;
  if (mode === 'ceil') chosen = up;
  else if (mode === 'floor') chosen = down;
  else chosen = value - down <= up - value ? down : up; // ties → lower
  return toKg(chosen, unit);
}

export const nearestLoadableKg = (kg: number, inv: PlateInventory, unit: Unit): number =>
  pick(kg, inv, unit, 'nearest');
export const ceilLoadableKg = (kg: number, inv: PlateInventory, unit: Unit): number =>
  pick(kg, inv, unit, 'ceil');
export const floorLoadableKg = (kg: number, inv: PlateInventory, unit: Unit): number =>
  pick(kg, inv, unit, 'floor');

/** Plates on one side for a total; [] when the total is the bar, null when it is not loadable. */
function match(kg: number, inv: PlateInventory, unit: Unit): number[] | null {
  const { totals, perSide } = loadable(inv, unit);
  const value = toUnit(kg, unit);
  const i = lowerIndex(totals, value - DISPLAY_EPS);
  if (i >= totals.length || Math.abs(totals[i] - value) > DISPLAY_EPS) return null;
  return perSide.get(totals[i]) ?? [];
}

/** Plates on one side for a total; [] when the total is the bar or not loadable. */
export const platesPerSide = (kg: number, inv: PlateInventory, unit: Unit): number[] =>
  match(kg, inv, unit) ?? [];

export function formatPlates(kg: number, inv: PlateInventory, unit: Unit): string {
  const side = match(kg, inv, unit);
  if (side === null) return 'not loadable with your plates';
  return side.length === 0 ? 'bar only' : `per side: ${side.map((p) => trim(p)).join(' + ')}`;
}

export function isLoadable(kg: number, inv: PlateInventory, unit: Unit): boolean {
  const { totals } = loadable(inv, unit);
  const i = lowerIndex(totals, toUnit(kg, unit));
  return i < totals.length && Math.abs(totals[i] - toUnit(kg, unit)) <= EPS;
}

/** Smallest jump the bar can make: two of the smallest plates, 0 if there are none. */
export function smallestStep(inv: PlateInventory, unit: Unit): number {
  const plates = platesOf(inv, unit).filter((p) => p > 0);
  return plates.length === 0 ? 0 : 2 * plates[plates.length - 1];
}

export const DEFAULT_STEP = { kg: 2, lb: 5 };

/** The inventory with the exercise's own bar (an EZ bar) in place of the gym bar. */
export function inventoryFor(exercise: Exercise, inv: PlateInventory): PlateInventory {
  return exercise.barKg ? { ...inv, barKg: exercise.barKg.kg, barLb: exercise.barKg.lb } : inv;
}

type Mode = 'nearest' | 'ceil' | 'floor';

/** Whole number of `step`s for `value`; a value within float noise of a multiple keeps it. */
function stepsOf(value: number, step: number, mode: Mode): number {
  const ratio = value / step;
  const snapped = Math.round(ratio);
  if (Math.abs(ratio - snapped) <= 1e-9) return snapped;
  return mode === 'ceil' ? Math.ceil(ratio) : mode === 'floor' ? Math.floor(ratio) : snapped;
}

/**
 * Added load for a bodyweight exercise (dip belt, vest): a multiple of the smallest single plate, never below 0.
 * Without plates there is nothing to round to, so the load is left as it is.
 */
export function roundAddedLoad(kg: number, inv: PlateInventory, unit: Unit, mode: Mode = 'nearest'): number {
  const plates = platesOf(inv, unit).filter((p) => p > 0);
  const smallest = plates[plates.length - 1];
  if (smallest === undefined) return kg;
  return toKg(Math.max(0, stepsOf(toUnit(kg, unit), smallest, mode)) * smallest, unit);
}

/** The owned kettlebell for a weight; ties go to the lighter bell. Undefined when none are owned. */
function pickKettlebell(kg: number, inv: PlateInventory, unit: Unit, mode: Mode): number | undefined {
  const sizes = [...(unit === 'kg' ? inv.kettlebellsKg : inv.kettlebellsLb)].sort((a, b) => a - b);
  if (sizes.length === 0) return undefined;
  const value = toUnit(kg, unit);
  const up = sizes.find((s) => s >= value - EPS) ?? sizes[sizes.length - 1];
  const down = [...sizes].reverse().find((s) => s <= value + EPS) ?? sizes[0];
  const chosen = mode === 'ceil' ? up : mode === 'floor' ? down : value - down <= up - value ? down : up;
  return toKg(chosen, unit);
}

/** Round a weight the way the exercise's equipment allows. */
export function roundForExercise(
  kg: number,
  exercise: Exercise,
  mode: Mode,
  inv: PlateInventory,
  unit: Unit,
): number {
  switch (exercise.kind) {
    case 'bodyweight':
      return roundAddedLoad(kg, inv, unit, mode);
    case 'barbell':
      return pick(kg, inventoryFor(exercise, inv), unit, mode);
    case 'kettlebell': {
      const bell = pickKettlebell(kg, inv, unit, mode);
      if (bell !== undefined) return bell;
      // No owned sizes: round to the exercise's step like a dumbbell.
      return stepRound(kg, exercise, mode, unit);
    }
    case 'dumbbell':
    case 'machine':
      return stepRound(kg, exercise, mode, unit);
  }
}

function stepRound(kg: number, exercise: Exercise, mode: Mode, unit: Unit): number {
  const step = (exercise.step ?? DEFAULT_STEP)[unit];
  return toKg(Math.max(stepsOf(toUnit(kg, unit), step, mode), 1) * step, unit);
}
