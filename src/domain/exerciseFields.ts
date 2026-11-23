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
