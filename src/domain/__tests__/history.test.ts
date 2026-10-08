import { isPersonalRecord, lastResult } from '../history';
import type { SessionLog } from '../types';

const log = (n: number, kg: number, reps: number[], extra: Partial<SessionLog> = {}): SessionLog => ({
  n,
  dayName: '',
  startedAt: `2026-01-0${n + 1}T10:00:00.000Z`,
  finishedAt: `2026-01-0${n + 1}T11:00:00.000Z`,
  results: { SQ: { weightKg: kg, sets: reps.map((r) => ({ target: null, reps: r })) } },
  order: ['SQ'],
  ...extra,
});

const sessions = [
  log(0, 60, [5, 8]),
  log(1, 0, [], { skipped: true, results: {}, order: [] }),
  log(2, 62.5, [5, 6]),
  log(3, 50, [8, 9], { intensity: 0.8 }),
];

describe('lastResult', () => {
  test('skips skipped and light days', () => {
    expect(lastResult(sessions, 'SQ')).toMatchObject({ n: 2, weightKg: 62.5, reps: [5, 6] });
  });
  test('can look before a given session', () => {
    expect(lastResult(sessions, 'SQ', 2)).toMatchObject({ n: 0, weightKg: 60 });
    expect(lastResult(sessions, 'SQ', 0)).toBeNull();
  });
  test('null for a lift never done', () => {
    expect(lastResult(sessions, 'DL')).toBeNull();
  });
});

describe('isPersonalRecord', () => {
  test('heavier than ever is a PR; the first session of a lift is not', () => {
    expect(isPersonalRecord(sessions, 'SQ', 65, 5)).toBe(true);
    expect(isPersonalRecord([], 'SQ', 65, 5)).toBe(false);
    expect(isPersonalRecord(sessions, 'DL', 100, 5)).toBe(false);
  });
  test('same weight needs more last-set reps than before', () => {
    expect(isPersonalRecord(sessions, 'SQ', 62.5, 7)).toBe(true);
    expect(isPersonalRecord(sessions, 'SQ', 62.5, 6)).toBe(false);
  });
  test('lighter than the heaviest is never a PR', () => {
    expect(isPersonalRecord(sessions, 'SQ', 60, 20)).toBe(false);
  });
});
