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

test('bodyweight shows its added load (0 = none) and no program gives []', () => {
  const s = state(PLUGINS.chins.apply(TEMPLATES.base));
  expect(project(s, 'test', 1)[0].lifts.at(-1)).toEqual({
    exercise: 'CHINUPS',
    scheme: '2xAMRAP',
    weightKg: 0,
  });
  expect(project(state(null), 'test', 5)).toEqual([]);
  expect(project(s, 'another', 5)).toEqual([]);
});

test('bodyweight added load is projected, not zeroed', () => {
  const s = state(PLUGINS.chins.apply(TEMPLATES.base));
  s.programs[0].lifts = { ...LIFTS, CHINUPS: { weightKg: 10, startKg: 0, fails: 0 } };
  expect(project(s, 'test', 1)[0].lifts.at(-1)?.weightKg).toBe(10);
});

test('an EZ-bar lift without a state starts at its own bar', () => {
  const p = JSON.parse(JSON.stringify(TEMPLATES.base)) as Program;
  p.days[0].slots.push({ exercise: 'EZ_BAR_CURL', scheme: '3x8' });
  expect(project(state(p), 'test', 1)[0].lifts.at(-1)).toMatchObject({
    exercise: 'EZ_BAR_CURL',
    weightKg: 10,
  });
});

test('ladder lifts climb through their steps', () => {
  const ladder: Program = {
    template: 'custom',
    sessionsPerWeek: 3,
    rules: TEMPLATES.base.rules,
    days: [{ name: 'A', slots: [{ exercise: 'CAL_SCAPULAR_PULL', scheme: '3x5-8', ladder: 'rr_pullup' }] }],
  };
  const p = project(state(ladder), 'test', 8);
  // 5, 6, 7, 8 reps on the first step, then the arch hang (timed) begins.
  expect(p.map((x) => x.lifts[0].exercise)).toEqual([
    ...Array(4).fill('CAL_SCAPULAR_PULL'),
    ...Array(4).fill('CAL_ARCH_HANG'),
  ]);
  expect(p[4].lifts[0]).toMatchObject({ scheme: '3x10-30s', weightKg: 0 });
});

test('after a long break the first projected session starts from the eased weight, like startSession', () => {
  const NOW = Date.parse('2026-06-30T12:00:00Z');
  const long = new Date(NOW - 30 * 86_400_000).toISOString();
  const lifts = { ...LIFTS, BARBELL_SQUAT: { weightKg: 100, startKg: 100, fails: 0 } };
  const s = state(TEMPLATES.base, 0, {
    programs: [active(TEMPLATES.base, 0, lifts)],
    sessions: [
      {
        n: 1,
        dayName: 'Old',
        startedAt: long,
        finishedAt: long,
        results: { BARBELL_SQUAT: { weightKg: 100, sets: [{ target: 5, reps: 5 }] } },
        order: ['BARBELL_SQUAT'],
      },
    ],
  });
  expect(project(s, 'test', 1, NOW)[0].lifts.find((l) => l.exercise === 'BARBELL_SQUAT')?.weightKg).toBe(80);
  expect(
    project({ ...s, breakDeload: false }, 'test', 1, NOW)[0].lifts.find((l) => l.exercise === 'BARBELL_SQUAT')
      ?.weightKg,
  ).toBe(100);
});
