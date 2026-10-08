import { builtInExercises } from './catalog';
import type { SessionLog } from './domain';
import { toKg } from './domain';
import { seriesFor } from './series';

const ex = builtInExercises();
const log = (n: number, results: SessionLog['results'], skipped = false): SessionLog => ({
  n,
  dayName: '',
  startedAt: '',
  finishedAt: '',
  results,
  order: Object.keys(results),
  skipped,
});

const sessions = [
  log(0, {
    BARBELL_SQUAT: { weightKg: 20, sets: [{ target: null, reps: 8 }] },
    CHINUPS: { weightKg: 0, sets: [{ target: null, reps: 6 }] },
  }),
  log(1, {}, true),
  log(2, { BARBELL_SQUAT: { weightKg: 22.5, sets: [{ target: null, reps: 5 }] } }),
  log(3, {
    CHINUPS: {
      weightKg: 0,
      sets: [
        { target: 5, reps: 5 },
        { target: null, reps: 9 },
      ],
    },
  }),
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

import { inRange, seriesPoints } from './series';

test('light days and skips are left out; PRs are strict improvements', () => {
  const log = (n: number, kg: number, intensity?: number): SessionLog => ({
    n,
    dayName: '',
    startedAt: `2026-0${n + 1}-01T10:00:00.000Z`,
    finishedAt: `2026-0${n + 1}-01T11:00:00.000Z`,
    results: { BARBELL_SQUAT: { weightKg: kg, sets: [{ target: null, reps: 5 }] } },
    order: ['BARBELL_SQUAT'],
    ...(intensity ? { intensity } : {}),
  });
  const points = seriesPoints(
    [log(0, 60), log(1, 48, 0.8), log(2, 60), log(3, 62.5)],
    ex.BARBELL_SQUAT,
    'kg',
  );
  expect(points.map((p) => [p.n, p.value, p.pr])).toEqual([
    [0, 60, true],
    [2, 60, false],
    [3, 62.5, true],
  ]);
});

test('range filters keep the points inside the window', () => {
  const pts = [
    { date: '2026-01-01T00:00:00Z' },
    { date: '2026-07-01T00:00:00Z' },
    { date: '2026-10-01T00:00:00Z' },
  ];
  const now = new Date('2026-10-08T00:00:00Z');
  expect(inRange(pts, '3M', now)).toHaveLength(1);
  expect(inRange(pts, '6M', now)).toHaveLength(2);
  expect(inRange(pts, '1Y', now)).toHaveLength(3);
  expect(inRange(pts, 'All', now)).toHaveLength(3);
});
