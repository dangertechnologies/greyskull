import { builtInExercises } from '../../catalog';
import { easeBack, gapDays, lastTrained } from '../breakDeload';
import { DEFAULT_INVENTORY, type LiftState, type SessionLog } from '../types';

const ex = builtInExercises();
const inv = DEFAULT_INVENTORY;
const DAY = 86_400_000;
const NOW = Date.parse('2026-06-30T12:00:00.000Z');
const BANDS = [
  { id: 'heavy', label: 'Heavy band' },
  { id: 'light', label: 'Light band' },
];
const lift = (patch: Partial<LiftState> = {}): LiftState => ({
  weightKg: 100,
  startKg: 20,
  fails: 1,
  ...patch,
});

let n = 0;
function log(daysAgo: number, results: SessionLog['results'], patch: Partial<SessionLog> = {}): SessionLog {
  const at = new Date(NOW - daysAgo * DAY).toISOString();
  return {
    n: n++,
    dayName: 'A',
    startedAt: at,
    finishedAt: at,
    results,
    order: Object.keys(results),
    ...patch,
  };
}
const done = (reps: number, extra: Partial<SessionLog['results'][string]> = {}) => ({
  weightKg: 50,
  sets: [{ target: 5, reps }],
  ...extra,
});

describe('lastTrained', () => {
  test('newest log with a logged set; light days count; all-zero and skipped sessions do not', () => {
    const sessions = [
      log(40, { BENCH_PRESS: done(5) }),
      log(20, { BENCH_PRESS: done(5) }, { intensity: 0.8 }),
      log(10, { BENCH_PRESS: done(0) }),
      log(5, {}, { skipped: true }),
    ];
    expect(lastTrained(sessions, 'BENCH_PRESS')).toBe(sessions[1].finishedAt);
    expect(lastTrained(sessions, 'DEADLIFT')).toBeNull();
  });

  test('a tier key shares recency with its exercise, across programs', () => {
    const sessions = [
      log(30, { BENCH_PRESS: done(5) }, { programId: 'gslp' }),
      log(3, { BENCH_PRESS: done(8, { lift: 'BENCH_PRESS@T2' }) }, { programId: 'gzclp' }),
    ];
    expect(lastTrained(sessions, 'BENCH_PRESS')).toBe(sessions[1].finishedAt);
    expect(lastTrained(sessions, 'BENCH_PRESS@T2')).toBe(sessions[1].finishedAt);
  });

  test('a ladder id matches results through their lift key, whatever the step exercise', () => {
    const sessions = [
      log(9, { CAL_PULLUP: done(5, { lift: 'rr_pullup' }) }),
      log(2, { CAL_PULLUP: done(5) }),
    ];
    expect(lastTrained(sessions, 'rr_pullup')).toBe(sessions[0].finishedAt);
  });

  test('gapDays counts whole days', () => {
    expect(gapDays(new Date(NOW - 14 * DAY + 1).toISOString(), NOW)).toBe(13);
    expect(gapDays(new Date(NOW - 14 * DAY).toISOString(), NOW)).toBe(14);
  });
});

describe('easeBack', () => {
  const squat = { exercise: ex.BARBELL_SQUAT, inv, unit: 'kg' as const, scheme: '2x5+' as const };
  test.each([
    [13, null],
    [14, 90],
    [27, 90],
    [28, 80],
    [55, 80],
    [56, 70],
  ])('weighted lift after %i days → %p kg', (gap, kg) => {
    const out = easeBack(lift(), gap, squat);
    expect(out === null ? null : out.weightKg).toBe(kg);
    if (out) expect(out.fails).toBe(0);
  });

  test('weights round down to loadable values (lb too) and keep the GZCLP stage', () => {
    expect(easeBack(lift({ weightKg: 62.5, stage: 2 }), 14, squat)).toMatchObject({ weightKg: 55, stage: 2 });
    const lb = easeBack(lift({ weightKg: 45.359237 * 3 }), 14, { ...squat, unit: 'lb' });
    expect((lb?.weightKg ?? 0) / 0.45359237).toBeCloseTo(270, 6);
  });

  test('a 5/3/1 training max eases like a working weight', () => {
    expect(easeBack(lift(), 28, { ...squat, progression: '531' })?.weightKg).toBe(80);
  });

  test('a rep range drops to the bottom of the range', () => {
    const curl = {
      exercise: ex.CURLS,
      inv,
      unit: 'kg' as const,
      scheme: '3x8-12' as const,
      progression: 'double' as const,
    };
    expect(easeBack(lift({ weightKg: 20, reps: 11 }), 14, curl)?.reps).toBeUndefined();
  });

  test.each([
    ['13 days: nothing', 13, 3, null],
    ['14 days: target to the bottom, same step', 14, 3, 3],
    ['28 days: one step down', 28, 3, 2],
    ['56 days: one step down', 56, 3, 2],
    ['never below the first step', 56, 0, 0],
  ])('ladder, %s', (_name, gap, step, after) => {
    const out = easeBack(lift({ weightKg: 0, fails: 0, step, reps: 7 }), gap, {
      exercise: ex.CAL_PULLUP,
      inv,
      unit: 'kg',
      scheme: '3x5-8',
      progression: 'ladder',
      ladder: 'rr_pullup',
      bands: BANDS,
    });
    if (after === null) return expect(out).toBeNull();
    expect(out?.step).toBe(after);
    expect(out?.reps).toBeUndefined();
  });

  test('stepping down onto a banded step takes the heaviest band; off one drops the band', () => {
    const ctx = {
      exercise: ex.CAL_PULLUP,
      inv,
      unit: 'kg' as const,
      scheme: '3x5-8' as const,
      progression: 'ladder' as const,
      ladder: 'rr_pullup',
      bands: BANDS,
    };
    expect(easeBack(lift({ weightKg: 0, step: 4 }), 28, ctx)).toMatchObject({ step: 3, bandId: 'heavy' });
    expect(easeBack(lift({ weightKg: 0, step: 3, bandId: 'light' }), 28, ctx)?.bandId).toBeUndefined();
  });

  test('a weighted ladder past its last step eases the added load and keeps the step', () => {
    const out = easeBack(lift({ weightKg: 10, step: 5 }), 28, {
      exercise: ex.CAL_LSIT_PULLUP,
      inv,
      unit: 'kg',
      scheme: '3x5-8',
      progression: 'ladder',
      ladder: 'rr_pullup',
    });
    expect(out).toMatchObject({ weightKg: 7.5, step: 5 });
  });

  test('nothing to ease returns null', () => {
    expect(
      easeBack(lift({ weightKg: 0, fails: 0 }), 30, {
        exercise: ex.CHINUPS,
        inv,
        unit: 'kg',
        scheme: '2xAMRAP',
      }),
    ).toBeNull();
  });
});
