import { builtInExercises } from './catalog';
import type { SessionLog } from './domain';
import { schemeLabel, summarize } from './format';

test.each([
  ['2x5+', undefined, '2x5+'],
  ['2x8-12', 9, '2×9 (8–12)'],
  ['3x30s', undefined, '3×30 s'],
  ['3x10-30s', undefined, '3×10 s (10–30 s)'],
  ['3x10-30s', 15, '3×15 s (10–30 s)'],
] as const)('schemeLabel(%s, %p) → %s', (scheme, reps, label) => {
  expect(schemeLabel(scheme, reps)).toBe(label);
});

test('summarize shows bodyweight added load and timed holds in seconds', () => {
  const log: SessionLog = {
    n: 0,
    dayName: 'A',
    startedAt: '',
    order: ['BARBELL_SQUAT', 'CHINUPS', 'DIPS', 'CAL_PLANK'],
    results: {
      BARBELL_SQUAT: { weightKg: 60, sets: [{ target: 5, reps: 5 }] },
      CHINUPS: { weightKg: 0, sets: [{ target: null, reps: 8 }] },
      DIPS: { weightKg: 10, sets: [{ target: null, reps: 6 }] },
      CAL_PLANK: { weightKg: 0, sets: [{ target: 30, reps: 30 }], timed: true },
    },
  };
  expect(summarize(log, builtInExercises(), 'kg')).toBe(
    'Squat 60 kg × 5 · Chin × 8 · Dips +10 kg × 6 · Plank × 30 s',
  );
});
