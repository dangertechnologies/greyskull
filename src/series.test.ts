import { builtInExercises } from './catalog';
import type { Scheme, SessionLog } from './domain';
import { toKg } from './domain';
import { resultFor, seriesFor } from './series';

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

test('GZCLP T1 and T2 of the same exercise get separate series', () => {
  const at = '2026-01-01T00:00:00.000Z';
  const log = (n: number, weightKg: number, lift?: string): SessionLog => ({
    n,
    dayName: '',
    startedAt: at,
    finishedAt: at,
    order: ['BARBELL_SQUAT'],
    results: { BARBELL_SQUAT: { weightKg, sets: [{ target: 3, reps: 3 }], ...(lift ? { lift } : {}) } },
  });
  const logs = [log(0, 100), log(1, 60, 'BARBELL_SQUAT@T2'), log(2, 105)];
  const squat = builtInExercises().BARBELL_SQUAT;
  expect(seriesFor(logs, squat, 'kg')).toEqual([100, 105]);
  expect(seriesFor(logs, squat, 'kg', 'BARBELL_SQUAT@T2')).toEqual([60]);
});

test('a 5/3/1 lift charts its training max, not the heaviest set', () => {
  const at = '2026-01-01T00:00:00.000Z';
  const logs: SessionLog[] = [
    {
      n: 0,
      dayName: '',
      startedAt: at,
      finishedAt: at,
      order: ['BARBELL_SQUAT'],
      results: { BARBELL_SQUAT: { weightKg: 85, tmKg: 100, sets: [{ target: null, reps: 6 }] } },
    },
  ];
  expect(seriesFor(logs, builtInExercises().BARBELL_SQUAT, 'kg')).toEqual([100]);
});

describe('ladders and timed results', () => {
  const at = '2026-01-01T00:00:00.000Z';
  const ladderLog = (
    n: number,
    exercise: string,
    step: number,
    scheme: Scheme,
    reps: number[],
  ): SessionLog => ({
    n,
    dayName: '',
    startedAt: at,
    finishedAt: at,
    order: [exercise],
    results: {
      [exercise]: {
        weightKg: 0,
        lift: 'rr_pullup',
        step,
        scheme,
        sets: reps.map((r) => ({ target: null, reps: r })),
        ...(scheme.endsWith('s') ? { timed: true as const } : {}),
      },
    },
  });
  const all = builtInExercises();
  const logs = [
    ladderLog(0, 'CAL_SCAPULAR_PULL', 0, '3x5-8', [5, 5, 4]),
    ladderLog(1, 'CAL_SCAPULAR_PULL', 0, '3x5-8', [8, 8, 8]),
    ladderLog(2, 'CAL_ARCH_HANG', 1, '3x10-30s', [20, 18, 15]),
    ladderLog(3, 'CAL_PULLUP_NEGATIVE', 2, '3x5-8', [6, 5, 5]),
    ladderLog(4, 'CAL_PULLUP_NEGATIVE', 2, '3x5-8', [3, 2, 2]),
  ];

  test('resultFor finds a result by its ladder id', () => {
    expect(resultFor(logs[2], 'rr_pullup')).toBe(logs[2].results.CAL_ARCH_HANG);
    expect(resultFor(logs[2], 'rr_squat')).toBeUndefined();
    expect(resultFor(logs[2], 'CAL_ARCH_HANG')).toBeUndefined();
  });

  test('the value is the step plus how far up its range the best set got', () => {
    const points = seriesPoints(logs, all.CAL_PULLUP, 'kg', 'rr_pullup', all);
    expect(points.map((p) => p.value)).toEqual([0, 1, 1.5, 2 + 1 / 3, 2]);
    expect(points.map((p) => p.label)).toEqual([
      'Scapular pull · 5 reps',
      'Scapular pull · 8 reps',
      'Arch hang · 20 s',
      'Pull-up negative · 6 reps',
      'Pull-up negative · 3 reps',
    ]);
    expect(points.map((p) => p.pr)).toEqual([true, true, true, true, false]);
  });

  test('a fixed ladder scheme counts as done once the target is met', () => {
    const fixed = [
      ladderLog(0, 'CAL_SCAPULAR_PULL', 0, '3x5', [5, 5, 5]),
      ladderLog(1, 'CAL_SCAPULAR_PULL', 0, '3x5', [4, 4, 4]),
    ];
    expect(seriesFor(fixed, all.CAL_PULLUP, 'kg', 'rr_pullup')).toEqual([1, 0]);
  });

  test('timed results are labelled in seconds', () => {
    const plank: SessionLog = {
      n: 0,
      dayName: '',
      startedAt: at,
      finishedAt: at,
      order: ['CAL_PLANK'],
      results: { CAL_PLANK: { weightKg: 0, timed: true, sets: [{ target: 30, reps: 45 }] } },
    };
    expect(seriesPoints([plank], all.CAL_PLANK, 'kg')).toMatchObject([{ value: 45, label: '45 s' }]);
  });
});
