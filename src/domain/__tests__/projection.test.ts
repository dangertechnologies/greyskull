import { builtInExercises } from '../../catalog';
import { PLUGINS, TEMPLATES } from '../program';
import { project } from '../projection';
import { type AppState, DEFAULT_INVENTORY } from '../types';

function state(patch: Partial<AppState> = {}): AppState {
  return {
    version: 2,
    unit: 'kg',
    inventory: DEFAULT_INVENTORY,
    minimalist: false,
    restSeconds: 90,
    exercises: builtInExercises(),
    program: TEMPLATES.base,
    lifts: {
      BARBELL_SQUAT: { weightKg: 20, startKg: 20, fails: 0 },
      DEADLIFT: { weightKg: 20, startKg: 20, fails: 0 },
      BENCH_PRESS: { weightKg: 20, startKg: 20, fails: 0 },
      MILITARY_PRESS: { weightKg: 20, startKg: 20, fails: 0 },
    },
    sessions: [],
    nextSession: 0,
    draft: null,
    needsWeightConfirm: false,
    needsWeightConfirmSuspects: [],
    legacyChecked: true,
    ...patch,
  };
}

test('9 sessions from the bar: squat 20, 22.5, 25; deadlift 20, 22.5, 25', () => {
  const p = project(state(), 9);
  expect(p).toHaveLength(9);
  expect(p.map((s) => s.n)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const weights = (id: string) =>
    p.flatMap((s) => s.lifts.filter((l) => l.exercise === id).map((l) => l.weightKg));
  expect(weights('BARBELL_SQUAT')).toEqual([20, 22.5, 25, 27.5, 30, 32.5]);
  expect(weights('DEADLIFT')).toEqual([20, 22.5, 25]);
  expect(weights('MILITARY_PRESS')).toEqual([20, 22.5, 25, 27.5, 30]);
  expect(weights('BENCH_PRESS')).toEqual([20, 22.5, 25, 27.5]);
});

test('does not mutate state and starts from nextSession', () => {
  const s = state({ nextSession: 4 });
  const copy = JSON.stringify(s);
  const p = project(s, 3);
  expect(JSON.stringify(s)).toBe(copy);
  expect(p.map((x) => x.dayName)).toEqual(['Day 2', 'Day 3', 'Day 1']);
});

test('bodyweight shows 0 and no program gives []', () => {
  const s = state({ program: PLUGINS.chins.apply(TEMPLATES.base) });
  expect(project(s, 1)[0].lifts.at(-1)).toEqual({ exercise: 'CHINUPS', scheme: '2xAMRAP', weightKg: 0 });
  expect(project(state({ program: null }), 5)).toEqual([]);
});
