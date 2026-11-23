import {
  active,
  program as current,
  lifts,
  setLift,
  setPosition,
  setProgram,
  startSession,
} from '../__fixtures__/oneProgram';
import { builtInExercises } from '../catalog';
import { liftKeyOf, PLUGINS, sessionFor, tryParseScheme, validateProgram } from '../domain';
import { getLadder } from '../domain/ladders';
import { initialState, useStore } from '../store';
import { getPlan, PLANS } from './plans';

const catalog = builtInExercises();

test('plan ids are unique and match their program template', () => {
  expect(new Set(PLANS.map((p) => p.id)).size).toBe(PLANS.length);
  for (const plan of PLANS) expect(plan.program.template).toBe(plan.id);
  expect(getPlan('stronglifts')?.name).toBe('StrongLifts 5×5');
  expect(getPlan('nope')).toBeUndefined();
});

test.each(PLANS.map((p) => [p.id, p] as const))(
  '%s is valid, alone and with every extra it offers',
  (_id, plan) => {
    expect(validateProgram(plan.program, catalog)).toEqual([]);
    let all = plan.program;
    for (const id of plan.plugins) all = PLUGINS[id].apply(all);
    expect(validateProgram(all, catalog)).toEqual([]);
  },
);

test('offers more than the two Greyskull variants, with the new ones marked experimental', () => {
  expect(PLANS.length).toBeGreaterThanOrEqual(5);
  expect(PLANS.filter((p) => p.status === 'stable').map((p) => p.id)).toEqual(['base', 'phrak']);
});

test('StrongLifts alternates A/B with squat every session and deadlift on B only', () => {
  const plan = getPlan('stronglifts')!.program;
  const ids = [0, 1, 2, 3].map((n) =>
    sessionFor(active(plan, n)).slots.map((s) => `${s.exercise}:${s.scheme}`),
  );
  expect(ids[0]).toEqual(['BARBELL_SQUAT:5x5', 'BENCH_PRESS:5x5', 'BENT_OVER_ROW:5x5']);
  expect(ids[1]).toEqual(['BARBELL_SQUAT:5x5', 'MILITARY_PRESS:5x5', 'DEADLIFT:1x5']);
  expect(ids[2]).toEqual(ids[0]);
});

test('AllPro runs heavy, light (80 %), medium (90 %) with an 8–12 rep range', () => {
  const plan = getPlan('allpro')!.program;
  expect(
    [0, 1, 2, 3].map((n) => [sessionFor(active(plan, n)).dayName, sessionFor(active(plan, n)).intensity]),
  ).toEqual([
    ['Heavy', 1],
    ['Light', 0.8],
    ['Medium', 0.9],
    ['Heavy', 1],
  ]);
  expect(plan.rules.progression).toBe('double');
  expect(new Set(plan.days.flatMap((d) => d.slots.map((s) => s.scheme)))).toEqual(new Set(['2x8-12']));
});

test('all plan schemes and stages parse, with one scheme per lift key', () => {
  for (const plan of PLANS) {
    const schemes = new Map<string, string>();
    for (const day of plan.program.days) {
      for (const slot of day.slots) {
        expect(tryParseScheme(slot.scheme)).not.toBeNull();
        for (const stage of slot.stages ?? []) expect(tryParseScheme(stage)).not.toBeNull();
        const ids = typeof slot.exercise === 'string' ? [slot.exercise] : slot.exercise;
        for (const id of ids) {
          const key = liftKeyOf(slot, id);
          if (schemes.has(key)) expect(slot.scheme).toBe(schemes.get(key));
          schemes.set(key, slot.scheme);
        }
      }
    }
  }
});

test('GZCLP T2 weights and stages are independent of T1', () => {
  useStore.setState({ ...initialState(), hydrated: true });
  setProgram(getPlan('gzclp')!.program);
  setLift('BENCH_PRESS', { weightKg: 80, startKg: 80, fails: 0, stage: 1 });
  setLift('BENCH_PRESS@T2', { weightKg: 40, startKg: 40, fails: 0, stage: 2 });
  expect(lifts().BENCH_PRESS).toMatchObject({ weightKg: 80, stage: 1 });
  expect(lifts()['BENCH_PRESS@T2']).toMatchObject({ weightKg: 40, stage: 2 });
  const draft = startSession();
  expect(draft.results.BENCH_PRESS.weightKg).toBe(40);
  expect(draft.results.BENCH_PRESS.sets.map((s) => s.target)).toEqual([6, 6, 6]);
  expect(sessionFor({ ...current(), position: 2 }).slots[0].scheme).toBe('6x2+');
});

test.each([0, 1, 2])('5/3/1 day %s builds eight sets for each main lift', (n) => {
  useStore.setState({ ...initialState(), hydrated: true });
  const program = getPlan('531-beginners')!.program;
  setProgram(program);
  setPosition(n);
  const draft = startSession();
  const main = sessionFor(active(program, n)).slots.filter((s) => s.progression === '531');
  expect(main).toHaveLength(2);
  for (const slot of main) {
    const sets = draft.results[slot.exercise].sets;
    expect(sets).toHaveLength(8);
    expect(sets.map((s) => s.target)).toEqual([5, 5, null, 5, 5, 5, 5, 5]);
    expect(sets.every((s) => s.kg !== undefined)).toBe(true);
  }
});

describe('plan categories', () => {
  test('every plan has one of the five categories', () => {
    const categories = ['strength', 'hypertrophy', 'calisthenics', 'skills', 'mobility'];
    for (const plan of PLANS) expect(categories).toContain(plan.category);
  });

  test.each([
    ['base', 'strength'],
    ['phrak', 'strength'],
    ['stronglifts', 'strength'],
    ['starting-strength', 'strength'],
    ['gzclp', 'strength'],
    ['531-beginners', 'strength'],
    ['allpro', 'hypertrophy'],
    ['lyle-gbr', 'hypertrophy'],
    ['full-body-hypertrophy', 'hypertrophy'],
    ['shoulder-mobilex', 'mobility'],
    ['recommended-routine', 'calisthenics'],
    ['six-ladders', 'calisthenics'],
    ['skill-track', 'skills'],
    ['hybrid', 'calisthenics'],
  ])('%s is %s', (id, category) => {
    expect(getPlan(id)?.category).toBe(category);
  });
});

describe('calisthenics plans', () => {
  const ladderSlots = (id: string) =>
    getPlan(id)!.program.days.map((d) => d.slots.filter((s) => s.ladder).map((s) => s.ladder));

  test('every ladder slot names its ladder and progresses as a ladder, starting at the first step', () => {
    for (const id of ['recommended-routine', 'six-ladders', 'skill-track', 'hybrid']) {
      for (const day of getPlan(id)!.program.days)
        for (const slot of day.slots.filter((s) => s.ladder)) {
          expect(slot.progression).toBe('ladder');
          expect(slot.exercise).toBe(getLadder(slot.ladder!)!.steps[0].exercise);
        }
    }
  });

  test('Recommended Routine: one day of three supersets and a core circuit with the brief rests', () => {
    const { days } = getPlan('recommended-routine')!.program;
    expect(days).toHaveLength(1);
    expect(days[0].slots.map((s) => [s.ladder, s.scheme, s.group])).toEqual([
      ['rr_pullup', '3x5-8', 's1'],
      ['rr_squat', '3x5-8', 's1'],
      ['rr_dip', '3x5-8', 's2'],
      ['rr_hinge', '3x5-8', 's2'],
      ['rr_row', '3x5-8', 's3'],
      ['rr_pushup', '3x5-8', 's3'],
      ['rr_antiextension', '3x8-12', 'core'],
      ['rr_antirotation', '3x8-12', 'core'],
      ['rr_extension', '3x8-12', 'core'],
    ]);
    expect(days[0].groups).toEqual([
      { id: 's1', kind: 'superset', restS: 90 },
      { id: 's2', kind: 'superset', restS: 90 },
      { id: 's3', kind: 'superset', restS: 90 },
      { id: 'core', kind: 'circuit', rounds: 3, restS: 60 },
    ]);
    expect(getPlan('recommended-routine')!.description).toMatch(/bodyweightfitness/);
  });

  test('Six Ladders rotates push-up and leg raise, pull-up and squat, handstand push-up and bridge', () => {
    expect(ladderSlots('six-ladders')).toEqual([
      ['six_pushup', 'six_legraise'],
      ['six_pullup', 'six_squat'],
      ['six_hspu', 'six_bridge'],
    ]);
    expect(getPlan('six-ladders')!.program.sessionsPerWeek).toBe(3);
  });

  test('Skill Track: two days that share the handstand, holds of 10 to 30 s and muscle-up 3 to 5', () => {
    const plan = getPlan('skill-track')!;
    expect(ladderSlots('skill-track')).toEqual([
      ['skill_handstand', 'skill_front_lever', 'skill_lsit'],
      ['skill_handstand', 'skill_planche', 'skill_muscleup'],
    ]);
    const schemes = plan.program.days.flatMap((d) => d.slots.map((s) => [s.ladder, s.scheme]));
    expect(schemes).toContainEqual(['skill_handstand', '3x10-30s']);
    expect(schemes).toContainEqual(['skill_muscleup', '3x3-5']);
    expect(plan.program.sessionsPerWeek).toBe(3);
  });

  test('Hybrid: barbell lifts as 2x5+ AMRAP beside ladders at 3x5-8, anti-extension on both days', () => {
    const { days } = getPlan('hybrid')!.program;
    expect(days.map((d) => d.slots.map((s) => s.ladder ?? s.exercise))).toEqual([
      ['BARBELL_SQUAT', 'rr_pullup', 'rr_dip', 'rr_antiextension'],
      ['DEADLIFT', 'rr_row', 'rr_pushup', 'rr_antiextension'],
    ]);
    for (const day of days) {
      expect(day.slots[0]).toMatchObject({ scheme: '2x5+' });
      expect(day.slots[0].ladder).toBeUndefined();
      expect(day.slots[1].scheme).toBe('3x5-8');
      expect(day.slots[2].scheme).toBe('3x5-8');
    }
  });
});

describe('ladder progression, as the plan descriptions say it', () => {
  /** One all-success session: every set logged at its target. Returns the targets and the exercise. */
  function sessionOf(exercise: string) {
    const draft = startSession();
    const { sets } = draft.results[exercise];
    sets.forEach((set, j) => {
      useStore.getState().logSet(exercise, j, set.target ?? 0);
    });
    useStore.getState().finishSession();
    return sets.map((set) => set.target);
  }

  test('meeting every set raises the target by one rep, and only the top of the range unlocks the next step', () => {
    useStore.setState({ ...initialState(), hydrated: true });
    setProgram(getPlan('recommended-routine')!.program);
    // The squat ladder uses the slot's 3x5-8 on every step.
    const first = getLadder('rr_squat')!.steps;
    const seen: [string, (number | null)[]][] = [];
    for (let i = 0; i < 8; i++) {
      const exercise = first[lifts().rr_squat?.step ?? 0].exercise;
      seen.push([exercise, sessionOf(exercise)]);
    }
    const targets = (reps: number) => [reps, reps, reps];
    expect(seen.map(([e, t]) => [e, t])).toEqual([
      [first[0].exercise, targets(5)],
      [first[0].exercise, targets(6)],
      [first[0].exercise, targets(7)],
      [first[0].exercise, targets(8)],
      [first[1].exercise, targets(5)],
      [first[1].exercise, targets(6)],
      [first[1].exercise, targets(7)],
      [first[1].exercise, targets(8)],
    ]);
  });

  test('a hold target grows by five seconds up to the top of its range, then the next variation starts', () => {
    useStore.setState({ ...initialState(), hydrated: true });
    setProgram(getPlan('skill-track')!.program);
    const steps = getLadder('skill_handstand')!.steps;
    const seen: [string, number | null][] = [];
    for (let i = 0; i < 6; i++) {
      const exercise = steps[lifts().skill_handstand?.step ?? 0].exercise;
      seen.push([exercise, sessionOf(exercise)[0]]);
    }
    expect(seen).toEqual([
      [steps[0].exercise, 10],
      [steps[0].exercise, 15],
      [steps[0].exercise, 20],
      [steps[0].exercise, 25],
      [steps[0].exercise, 30],
      [steps[1].exercise, 20],
    ]);
  });
});
