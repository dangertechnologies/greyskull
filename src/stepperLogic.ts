const EPS = 1e-6;
const clean = (v: number): number => Math.round(v * 1e6) / 1e6;

export interface StepConfig {
  step?: number;
  /** Ascending list of allowed values; stepping moves to the neighbouring entry. */
  values?: number[];
  min?: number;
  max?: number;
}

/** The value one step up (dir = 1) or down (dir = -1) from `value`; stays put at the ends. */
export function stepValue(value: number, dir: 1 | -1, { step = 1, values, min, max }: StepConfig): number {
  let next = value;
  if (values && values.length > 0) {
    if (dir === 1) next = values.find((v) => v > value + EPS) ?? values[values.length - 1];
    else next = [...values].reverse().find((v) => v < value - EPS) ?? values[0];
    if (dir === 1) next = Math.max(next, value);
    else next = Math.min(next, value);
  } else {
    next = clean(value + dir * step);
  }
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}
