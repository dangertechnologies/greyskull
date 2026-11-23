import { builtInExercises } from '../../catalog';
import fixture from '../../dev/v1-imperial.json';
import { migrateV1 } from '../migrateV1';
import { PLUGINS, TEMPLATES } from '../program';

const raw = JSON.stringify(fixture);
const catalog = builtInExercises();

test('migrates the imperial fixture', () => {
  const m = migrateV1(raw, catalog);
  expect(m).not.toBeNull();
  const { patch, suspects } = m!;
  expect(patch.unit).toBe('lb');
  expect(suspects).toEqual(['BENT_OVER_ROW']);
  expect(patch.needsWeightConfirmSuspects).toEqual(['BENT_OVER_ROW']);
  expect(patch.lifts.BENT_OVER_ROW.weightKg).toBe(20.41);
  expect(patch.lifts.BARBELL_SQUAT).toEqual({ weightKg: 68.04, startKg: 61.23, fails: 0 });
  expect(patch.sessions).toHaveLength(2);
  expect(patch.sessions[0].results.BENT_OVER_ROW.weightKg).toBe(20.41);
  expect(patch.sessions[1].results.BENT_OVER_ROW).toBeUndefined();
  expect(patch.sessions[1].order).toEqual(['DEADLIFT']);
  expect(patch.sessions[0].results.BARBELL_SQUAT.sets).toEqual([{ target: null, reps: 8 }]);
  expect(patch.sessions[0].finishedAt).toBe(new Date(1556000000000).toISOString());
  expect(patch.nextSession).toBe(2);
  expect(patch.needsWeightConfirm).toBe(true);
});

test('program is base + curls + chins + a row slot on every day', () => {
  const { program } = migrateV1(raw, catalog)!.patch;
  const expected = PLUGINS.chins.apply(PLUGINS.curls.apply(TEMPLATES.base));
  expected.days.forEach((d) => {
    d.slots.push({ exercise: 'BENT_OVER_ROW', scheme: '2x5+' });
  });
  expect(program).toEqual(expected);
});

test('every barbell lift of the migrated program has a weight', () => {
  const { lifts, program } = migrateV1(raw, catalog)!.patch;
  expect(program).not.toBeNull();
  for (const id of ['BARBELL_SQUAT', 'DEADLIFT', 'BENCH_PRESS', 'MILITARY_PRESS', 'CURLS', 'BENT_OVER_ROW']) {
    expect(lifts[id].weightKg).toBeGreaterThan(0);
  }
});

test('optional dips and crunches switch on when INCLUDED', () => {
  const v = JSON.parse(raw);
  v.configuration.exercises.DIPS.include = 'INCLUDED';
  v.configuration.exercises.CRUNCHES.include = 'INCLUDED';
  const { program } = migrateV1(JSON.stringify(v), catalog)!.patch;
  const ids = program!.days[0].slots.map((s) => s.exercise);
  expect(ids).toContain('DIPS');
  expect(ids).toContain('CRUNCHES');
});

test('absurd weights without a start weight fall back to the bar', () => {
  const v = JSON.parse(raw);
  v.configuration.weights.BENT_OVER_ROW = { initial: 0, current: 999 };
  const m = migrateV1(JSON.stringify(v), catalog)!;
  expect(m.patch.lifts.BENT_OVER_ROW.weightKg).toBe(20);
});

test('returns null for garbage, other shapes and unfinished setups', () => {
  expect(migrateV1('not json', catalog)).toBeNull();
  expect(migrateV1('{}', catalog)).toBeNull();
  expect(migrateV1('null', catalog)).toBeNull();
  const v = JSON.parse(raw);
  v.configuration.initialSetupComplete = false;
  expect(migrateV1(JSON.stringify(v), catalog)).toBeNull();
});

test('bodyweight lifts migrate without added load, whatever v1 stored', () => {
  const v = JSON.parse(raw);
  v.configuration.weights.CHINUPS = { initial: 0, current: 999 };
  v.configuration.weights.DIPS = { initial: 10, current: 12.5 };
  const m = migrateV1(JSON.stringify(v), catalog)!;
  expect(m.patch.lifts.CHINUPS).toEqual({ weightKg: 0, startKg: 0, fails: 0 });
  expect(m.patch.lifts.DIPS).toEqual({ weightKg: 0, startKg: 0, fails: 0 });
  expect(m.suspects).not.toContain('CHINUPS');
});

test('new workouts continue after the highest v1 id, not after the number of workouts', () => {
  const v = JSON.parse(raw);
  v.workoutPlan[0].id = 4;
  v.workoutPlan[1].id = 9;
  const { patch } = migrateV1(JSON.stringify(v), catalog)!;
  expect(patch.sessions.map((s) => s.n)).toEqual([4, 9]);
  expect(patch.nextSession).toBe(10);
});

test('missing, broken and repeated v1 ids get new unique ids after the highest; every workout is kept', () => {
  const v = JSON.parse(raw);
  const done = v.workoutPlan[0];
  v.workoutPlan = [
    { ...done, id: 3 },
    { ...done, id: 3 },
    { ...done, id: 'x' },
    { ...done, id: 1.5 },
    { ...done, id: -1 },
    { ...done, id: null },
  ];
  const { patch } = migrateV1(JSON.stringify(v), catalog)!;
  expect(patch.sessions.map((s) => s.n)).toEqual([3, 4, 5, 6, 7, 8]);
  expect(patch.nextSession).toBe(9);
});

test('garbage values in v1 workouts and weights are skipped or zeroed, never NaN', () => {
  const v = JSON.parse(raw);
  const done = v.workoutPlan[0];
  v.configuration.weights.DEADLIFT = { initial: 'a', current: 'b' };
  v.configuration.weights.BENCH_PRESS = null;
  v.workoutPlan = [
    null,
    { ...done, id: 1, completed: 'yesterday' },
    // Past the last date JavaScript can hold: skipped, not a thrown RangeError on every launch.
    { ...done, id: 7, completed: 9e15 },
    { ...done, id: 2, exercises: 'none' },
    {
      ...done,
      id: 3,
      exercises: [null, { definition: 'BARBELL_SQUAT', completed: 1, weight: 'x', amrap: 'y' }],
    },
  ];
  const { patch } = migrateV1(JSON.stringify(v), catalog)!;
  expect(patch.sessions.map((s) => s.n)).toEqual([2, 3]);
  expect(patch.sessions[1].results.BARBELL_SQUAT).toEqual({ weightKg: 0, sets: [{ target: null, reps: 0 }] });
  // Lifts with no usable weight start at the bar, like lifts v1 never stored.
  expect(patch.lifts.DEADLIFT.weightKg).toBe(20);
  expect(patch.lifts.BENCH_PRESS.weightKg).toBe(20);
  expect(patch.nextSession).toBe(4);
});
