/**
 * A read from a plain object keyed by an id that may come from a file, a deep link or a model. Only the
 * object's own entries count: "constructor" or "toString" on a plain object would otherwise return a member of
 * `Object.prototype` and pass a not-found check.
 */
export function own<T>(map: Record<string, T> | undefined, key: string | undefined): T | undefined {
  return map !== undefined && key !== undefined && Object.hasOwn(map, key) ? map[key] : undefined;
}

/** Names every plain object already has ("constructor", "toString", "__proto__"): never valid as an id or key. */
export const RESERVED_KEYS: ReadonlySet<string> = new Set(Object.getOwnPropertyNames(Object.prototype));

export const isReservedKey = (key: string): boolean => RESERVED_KEYS.has(key);
