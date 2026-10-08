import { builtInExercises } from './catalog';
import type { SessionLog } from './domain';
import { toKg } from './domain';
import { seriesFor } from './series';

const ex = builtInExercises();
const log = (n: number, results: SessionLog['results'], skipped = false): SessionLog => ({
  n, dayName: '', startedAt: '', finishedAt: '', results, order: Object.keys(results), skipped,
});

const sessions = [
  log(0, { BARBELL_SQUAT: { weightKg: 20, sets: [{ target: null, reps: 8 }] }, CHINUPS: { weightKg: 0, sets: [{ target: null, reps: 6 }] } }),
  log(1, {}, true),
  log(2, { BARBELL_SQUAT: { weightKg: 22.5, sets: [{ target: null, reps: 5 }] } }),
  log(3, { CHINUPS: { weightKg: 0, sets: [{ target: 5, reps: 5 }, { target: null, reps: 9 }] } }),
];

test('weights per finished session in the chosen unit; skipped sessions are ignored', () => {
  expect(seriesFor(sessions, ex.BARBELL_SQUAT, 'kg')).toEqual([20, 22.5]);
  const lb = seriesFor(sessions, ex.BARBELL_SQUAT, 'lb');
  expect(lb[0]).toBeCloseTo(44.0925, 3);
  expect(toKg(lb[1], 'lb')).toBeCloseTo(22.5, 9);
});

test('bodyweight lifts chart last-set reps', () => {
  expect(seriesFor(sessions, ex.CHINUPS, 'kg')).toEqual([6, 9]);
});
