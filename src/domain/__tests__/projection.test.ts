import { active } from '../../__fixtures__/oneProgram';
import { builtInExercises } from '../../catalog';
import { initialState } from '../../store';
import { PLUGINS, TEMPLATES } from '../program';
import { project } from '../projection';
import type { AppState, Program } from '../types';

const LIFTS = {
  BARBELL_SQUAT: { weightKg: 20, startKg: 20, fails: 0 },
  DEADLIFT: { weightKg: 20, startKg: 20, fails: 0 },
  BENCH_PRESS: { weightKg: 20, startKg: 20, fails: 0 },
  MILITARY_PRESS: { weightKg: 20, startKg: 20, fails: 0 },
};

function state(
  program: Program | null = TEMPLATES.base,
  position = 0,
  patch: Partial<AppState> = {},
): AppState {
  return {
    ...initialState(),
    exercises: builtInExercises(),
    programs: program ? [active(program, position, LIFTS)] : [],
    legacyChecked: true,
    ...patch,
  };
}

test('9 sessions from the bar: squat 20, 22.5, 25; deadlift 20, 22.5, 25', () => {
  const p = project(state(), 'test', 9);
  expect(p).toHaveLength(9);
  expect(p.map((s) => s.n)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const weights = (id: string) =>
    p.flatMap((s) => s.lifts.filter((l) => l.exercise === id).map((l) => l.weightKg));
  expect(weights('BARBELL_SQUAT')).toEqual([20, 22.5, 25, 27.5, 30, 32.5]);
  expect(weights('DEADLIFT')).toEqual([20, 22.5, 25]);
  expect(weights('MILITARY_PRESS')).toEqual([20, 22.5, 25, 27.5, 30]);
  expect(weights('BENCH_PRESS')).toEqual([20, 22.5, 25, 27.5]);
});

test('does not mutate state and starts from the program position', () => {
  const s = state(TEMPLATES.base, 4, { nextSession: 9 });
  const copy = JSON.stringify(s);
  const p = project(s, 'test', 3);
  expect(p.map((x) => x.n)).toEqual([9, 10, 11]);
  expect(JSON.stringify(s)).toBe(copy);
  expect(p.map((x) => x.dayName)).toEqual(['Day 2', 'Day 3', 'Day 1']);
});

test('bodyweight shows 0 and no program gives []', () => {
  const s = state(PLUGINS.chins.apply(TEMPLATES.base));
  expect(project(s, 'test', 1)[0].lifts.at(-1)).toEqual({
    exercise: 'CHINUPS',
    scheme: '2xAMRAP',
    weightKg: 0,
  });
  expect(project(state(null), 'test', 5)).toEqual([]);
  expect(project(s, 'another', 5)).toEqual([]);
});
