import type { Exercise } from './types';

/**
 * Fields of a built-in exercise the user may change. Everything else comes from the shipped catalog, so only
 * these are stored for an edited built-in, restored on launch and carried in backups.
 */
export const USER_FIELDS = [
  'name',
  'shortName',
  'abbr',
  'kind',
  'increment',
  'step',
  'barKg',
  'equipment',
  'muscles',
  'secondary',
  'timed',
] as const satisfies readonly (keyof Exercise)[];

export type UserField = (typeof USER_FIELDS)[number];

/** User fields a built-in may lack (or have switched off), so a stored `null` for them is valid. */
export const NULLABLE_USER_FIELDS = [
  'abbr',
  'step',
  'barKg',
  'equipment',
  'muscles',
  'secondary',
  'timed',
] as const satisfies readonly UserField[];

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Whether the user changed any user field of a built-in (against what the bundle ships). */
export const isEdited = (e: Exercise, shipped: Exercise): boolean =>
  USER_FIELDS.some((f) => !sameValue(e[f], shipped[f]));

/**
 * What is stored of an edited built-in: its id and every user field. A field the user turned off or cleared
 * is stored as `null`, because leaving it out would let the bundle's value come back on the next launch.
 */
export function userFieldsOf(e: Exercise, shipped: Exercise): Exercise {
  const out: Record<string, unknown> = { id: e.id };
  for (const f of USER_FIELDS) {
    if (e[f] !== undefined) out[f] = e[f];
    else if (shipped[f] !== undefined) out[f] = null;
  }
  return out as unknown as Exercise;
}

/**
 * The shipped exercise with the stored user fields on top: a stored value replaces it, a stored `null` removes
 * it, a field not stored keeps the shipped value. An old entry that holds the whole exercise (content fields
 * too) may carry a zero increment on a bodyweight lift from before such lifts could take added weight: that
 * is not the user's choice, so the shipped increment stays.
 */
export function withUserFields(shipped: Exercise, stored: Record<string, unknown>): Exercise {
  const whole = Object.keys(stored).some(
    (k) => k !== 'id' && !(USER_FIELDS as readonly string[]).includes(k),
  );
  const out: Record<string, unknown> = { ...shipped };
  for (const f of USER_FIELDS) {
    if (!Object.hasOwn(stored, f) || stored[f] === undefined) continue;
    const value = stored[f];
    if (value === null) delete out[f];
    else if (f === 'increment' && whole && shipped.kind === 'bodyweight' && isZeroIncrement(value)) continue;
    else out[f] = value;
  }
  return out as unknown as Exercise;
}

const isZeroIncrement = (v: unknown): boolean =>
  typeof v === 'object' && v !== null && (v as { kg?: unknown }).kg === 0 && (v as { lb?: unknown }).lb === 0;
