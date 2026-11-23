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

/** The heaviest bar (the gym's or an exercise's own) the app accepts, per unit. */
export const BAR_MAX = { kg: 50, lb: 110 } as const;
/** Plate sizes the app accepts, per unit, and the most different sizes an inventory may list. */
export const PLATE_RANGE = { kg: [0.25, 50], lb: [0.25, 110] } as const;
export const MAX_PLATE_SIZES = 20;
/** Kettlebell sizes the gym editor offers, per unit, and the most an inventory may list. */
export const KETTLEBELL_RANGE = { kg: [2, 80], lb: [5, 180] } as const;
export const MAX_KETTLEBELLS = 40;

const within = (v: unknown, [min, max]: readonly [number, number]): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const validBar = (v: unknown, unit: Unit): v is number => within(v, [Number.MIN_VALUE, BAR_MAX[unit]]);

function barOf(inv: PlateInventory, unit: Unit): number {
  return unit === 'kg' ? inv.barKg : inv.barLb;
}

/**
 * Plates of one unit, largest first. Sizes out of range and anything past the first `MAX_PLATE_SIZES` are left
 * out, so a damaged or hostile inventory cannot make `loadable` search with a plate that rounds to nothing.
 */
function platesOf(inv: PlateInventory, unit: Unit): number[] {
  const list = unit === 'kg' ? inv.platesKg : inv.platesLb;
  return (Array.isArray(list) ? list : [])
    .slice(0, MAX_PLATE_SIZES)
    .filter((p) => within(p, PLATE_RANGE[unit]))
    .sort((a, b) => b - a);
}

/**
 * Why an inventory from a file or storage cannot be used, or null when every value is in range. A missing field is
 * fine: stored inventories are merged over the defaults on load.
 */
export function inventoryProblem(v: unknown): string | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return 'the equipment is not an inventory';
  const inv = v as Record<string, unknown>;
  const list = (x: unknown, max: number, range: readonly [number, number]) =>
    x === undefined || (Array.isArray(x) && x.length <= max && x.every((n) => within(n, range)));
  for (const unit of ['kg', 'lb'] as const) {
    const bar = unit === 'kg' ? inv.barKg : inv.barLb;
    if (bar !== undefined && !validBar(bar, unit))
      return `the bar must be over 0 and at most ${BAR_MAX[unit]} ${unit}`;
    const [pMin, pMax] = PLATE_RANGE[unit];
    if (!list(unit === 'kg' ? inv.platesKg : inv.platesLb, MAX_PLATE_SIZES, PLATE_RANGE[unit]))
      return `plates must be at most ${MAX_PLATE_SIZES} sizes of ${pMin} to ${pMax} ${unit}`;
    const [kMin, kMax] = KETTLEBELL_RANGE[unit];
    if (!list(unit === 'kg' ? inv.kettlebellsKg : inv.kettlebellsLb, MAX_KETTLEBELLS, KETTLEBELL_RANGE[unit]))
      return `kettlebells must be at most ${MAX_KETTLEBELLS} sizes of ${kMin} to ${kMax} ${unit}`;
  }
  return null;
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
  // A bar that is not a number (a half-filled inventory), negative or absurdly heavy loads nothing, rather than
  // an array of NaN or millions of entries.
  if (!validBar(bar, unit) || !(maxTotal > 0 && maxTotal <= 1000)) return { totals: [], perSide: new Map() };
  const plates = platesOf(inv, unit);
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
  const plates = platesOf(inv, unit);
  return plates.length === 0 ? 0 : 2 * plates[plates.length - 1];
}

export const DEFAULT_STEP = { kg: 2, lb: 5 };

/** Weight a new lift starts at: the exercise's own bar, the smallest step, or no added load. */
export function startingWeightKg(exercise: Exercise, inv: PlateInventory, unit: Unit): number {
  if (exercise.kind === 'bodyweight') return 0;
  if (exercise.kind === 'barbell') {
    const own = inventoryFor(exercise, inv);
    return toKg(unit === 'kg' ? own.barKg : own.barLb, unit);
  }
  return toKg((exercise.step ?? DEFAULT_STEP)[unit], unit);
}

/** The inventory with the exercise's own bar (an EZ bar) in place of the gym bar. */
export function inventoryFor(exercise: Exercise, inv: PlateInventory): PlateInventory {
  const own = exercise.barKg;
  // Only a bar given in both units, each in range, replaces the gym's; anything else (an import with one unit, a
  // negative or huge bar from a damaged file) keeps the gym bar.
  return own && validBar(own.kg, 'kg') && validBar(own.lb, 'lb')
    ? { ...inv, barKg: own.kg, barLb: own.lb }
    : inv;
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
 * Without plates there is nothing to round to, so the load is left as it is: rounding to nothing would zero
 * a load the user typed (a weight vest, say) on the next unit switch or weight edit.
 */
export function roundAddedLoad(kg: number, inv: PlateInventory, unit: Unit, mode: Mode = 'nearest'): number {
  const plates = platesOf(inv, unit);
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
