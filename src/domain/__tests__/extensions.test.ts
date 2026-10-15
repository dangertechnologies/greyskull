import { builtInExercises } from '../../catalog';
import { liftLabel } from '../../format';
import { initialState, useStore } from '../../store';
import { liftKeyOf, liftKeysOf, sessionFor, validateProgram } from '../program';
import { buildProgram } from '../programEdit';
import { fiveThreeOneSets, nextLift } from '../progression';
import { project } from '../projection';
import { DEFAULT_INVENTORY, DEFAULT_RULES, type LiftState, type Program, type Scheme } from '../types';
import { toKg, toUnit } from '../units';

const ex = builtInExercises();
const inv = DEFAULT_INVENTORY;
const lift: LiftState = { weightKg: 100, startKg: 100, fails: 0 };
const stages: Scheme[] = ['3x5+', '3x3+', '5x1+'];
const program: Program = {
  template: 'custom',
  sessionsPerWeek: 3,
  rules: DEFAULT_RULES,
  days: [
    { name: 'A', slots: [{ exercise: 'BARBELL_SQUAT', scheme: '3x5+', stages, progression: 'stages' }] },
    {
      name: 'B',
      slots: [{ exercise: 'BARBELL_SQUAT', lift: 'BARBELL_SQUAT@T2', scheme: '3x10', progression: 'linear' }],
    },
  ],
};

beforeEach(() => useStore.setState({ ...initialState(), hydrated: true }));

test('stages advance on a miss, then deload and reset after the last stage', () => {
  const run = (l: LiftState, reps: number[]) =>
    nextLift(
      l,
      { weightKg: 100, sets: reps.map((r, i) => ({ target: i === reps.length - 1 ? null : 5, reps: r })) },
      DEFAULT_RULES,
      ex.BARBELL_SQUAT,
      inv,
      'kg',
      { progression: 'stages', scheme: '3x5+', stages },
    );
  expect(run(lift, [5, 5, 5])).toMatchObject({ change: 'up', next: { weightKg: 102.5, fails: 0 } });
  expect(run(lift, [4, 5, 5])).toMatchObject({ change: 'same', next: { weightKg: 100, stage: 1, fails: 0 } });
  expect(run({ ...lift, stage: 2 }, [5, 5, 0])).toMatchObject({
    change: 'deload',
    next: { weightKg: 90, stage: 0, fails: 0 },
  });
  const oneRep = nextLift(
    { ...lift, stage: 2 },
    { weightKg: 100, sets: [{ target: null, reps: 1 }] },
    DEFAULT_RULES,
    ex.BARBELL_SQUAT,
    inv,
    'kg',
    { progression: 'stages', scheme: '1x1+', stages },
  );
  expect(oneRep.change).toBe('up');
});

test('T3 requires advanceAt on the last set before adding weight', () => {
  const run = (reps: number) =>
    nextLift(
      lift,
      {
        weightKg: 100,
        sets: [
          { target: 15, reps: 15 },
          { target: null, reps },
        ],
      },
      DEFAULT_RULES,
      ex.BARBELL_SQUAT,
      inv,
      'kg',
      { progression: 'linear', scheme: '2x15+', advanceAt: 25 },
    );
  expect(run(24).next.weightKg).toBe(100);
  expect(run(25).next.weightKg).toBe(102.5);
});

test.each([
  [0, [65, 75, 85, 65, 65, 65, 65, 65], [5, 5, null, 5, 5, 5, 5, 5]],
  [1, [70, 80, 90, 70, 70, 70, 70, 70], [3, 3, null, 5, 5, 5, 5, 5]],
  [2, [75, 85, 95, 75, 75, 75, 75, 75], [5, 3, null, 5, 5, 5, 5, 5]],
])('531 week %s includes three main sets and five FSL sets', (week, kg, targets) => {
  const sets = fiveThreeOneSets(100, week as number, ex.BARBELL_SQUAT, inv, 'kg');
  expect(sets.map((s) => s.kg)).toEqual(kg);
  expect(sets.map((s) => s.target)).toEqual(targets);
  expect(sets.every((s) => s.reps === 0)).toBe(true);
});

test('sessionFor resolves independent lift keys and clamps stages', () => {
  expect(liftKeyOf(program.days[1].slots[0])).toBe('BARBELL_SQUAT@T2');
  expect(liftKeysOf(program)).toEqual(['BARBELL_SQUAT', 'BARBELL_SQUAT@T2']);
  expect(sessionFor(program, 0, { BARBELL_SQUAT: { ...lift, stage: 99 } }).slots[0]).toMatchObject({
    exercise: 'BARBELL_SQUAT',
    lift: 'BARBELL_SQUAT',
    scheme: '5x1+',
    progression: 'stages',
  });
  expect(sessionFor(program, 1).slots[0].lift).toBe('BARBELL_SQUAT@T2');
  expect(liftLabel('BARBELL_SQUAT@T2', ex)).toBe(`${ex.BARBELL_SQUAT.name} (T2)`);
});

test('validateProgram rejects invalid stages, mismatched lift mappings and pair lift keys', () => {
  expect(validateProgram(program, ex)).toEqual([]);
  const bad: Program = JSON.parse(JSON.stringify(program));
  bad.days[0].slots[0].stages = ['bad' as Scheme];
  bad.days[1].slots[0].lift = 'BARBELL_SQUAT';
  bad.days[1].slots[0].exercise = 'BENCH_PRESS';
  expect(validateProgram(bad, ex).join()).toMatch(/stage/);
  expect(validateProgram(bad, ex).join()).toMatch(/same exercise/);
  bad.days[1].slots[0].exercise = ['BARBELL_SQUAT', 'BENCH_PRESS'];
  expect(validateProgram(bad, ex).join()).toMatch(/alternating/);
});

test.each([4, 5])(
  'buildProgram accepts %s training days without changing the rotation',
  (sessionsPerWeek) => {
    const p = buildProgram(program, [], { sessionsPerWeek, rules: DEFAULT_RULES });
    expect(p.sessionsPerWeek).toBe(sessionsPerWeek);
    expect([0, 1, 2].map((n) => sessionFor(p, n).dayName)).toEqual(['A', 'B', 'A']);
  },
);

test.each([0, 8, 2.5, NaN])('validateProgram rejects invalid training frequency %s', (sessionsPerWeek) => {
  expect(validateProgram({ ...program, sessionsPerWeek }).length).toBeGreaterThan(0);
});

test('store and projection use independent weights and the current stage', () => {
  const s = useStore.getState();
  s.setProgram(program);
  s.setLift('BARBELL_SQUAT', { ...lift, stage: 1 });
  expect(useStore.getState().lifts['BARBELL_SQUAT@T2'].weightKg).toBe(20);
  const draft = s.startSession(0);
  expect(draft.results.BARBELL_SQUAT.sets.map((s) => s.target)).toEqual([3, 3, null]);
  draft.results.BARBELL_SQUAT.sets.forEach((_, i) => {
    s.logSet('BARBELL_SQUAT', i, 3);
  });
  s.finishSession();
  expect(useStore.getState().lifts.BARBELL_SQUAT.weightKg).toBe(102.5);
  expect(useStore.getState().lifts['BARBELL_SQUAT@T2'].weightKg).toBe(20);
  expect(project(useStore.getState(), 1)[0].lifts[0].weightKg).toBe(20);
});

const five: Program = {
  ...program,
  rules: { ...DEFAULT_RULES, progression: '531', increments: { BARBELL_SQUAT: { kg: 5, lb: 10 } } },
  days: ['A', 'B', 'C'].map((name) => ({ name, slots: [{ exercise: 'BARBELL_SQUAT', scheme: '3x5+' }] })),
};

test('531 TM only increases at the last week-3 occurrence; projection agrees', () => {
  const s = useStore.getState();
  s.setProgram(five);
  s.setLift('BARBELL_SQUAT', lift);
  const projected = project(useStore.getState(), 10);
  expect(projected.map((p) => p.lifts[0].weightKg)).toEqual([85, 85, 85, 90, 90, 90, 95, 95, 95, 90]);
  for (let n = 0; n < 10; n++) {
    const d = s.startSession(n);
    expect(d.results.BARBELL_SQUAT.weightKg).toBe(projected[n].lifts[0].weightKg);
    const before = JSON.stringify(d.results);
    s.setDraftWeight('BARBELL_SQUAT', 200);
    expect(JSON.stringify(useStore.getState().draft?.results)).toBe(before);
    d.results.BARBELL_SQUAT.sets.forEach((set, i) => {
      s.logSet('BARBELL_SQUAT', i, set.target ?? 1);
    });
    const o = s.finishSession().BARBELL_SQUAT;
    expect(o.change).toBe(n === 8 ? 'up' : 'none');
  }
  expect(useStore.getState().lifts.BARBELL_SQUAT.weightKg).toBe(105);
});

test('531 missing the week-3 AMRAP counts failures against TM, not the FSL weight', () => {
  const s = useStore.getState();
  s.setProgram(five);
  s.setLift('BARBELL_SQUAT', lift);
  for (const n of [8, 17]) {
    const d = s.startSession(n);
    d.results.BARBELL_SQUAT.sets.forEach((set, i) => {
      s.logSet('BARBELL_SQUAT', i, set.target ?? 0);
    });
    s.finishSession();
  }
  expect(useStore.getState().lifts.BARBELL_SQUAT).toMatchObject({ weightKg: 90, fails: 0 });
});

test('changing frequency preserves the draft, weights and day rotation', () => {
  const s = useStore.getState();
  s.setProgram(program);
  const draft = s.startSession(0);
  const before = useStore.getState().lifts;
  s.setSessionsPerWeek(5);
  expect(useStore.getState().program?.sessionsPerWeek).toBe(5);
  expect(useStore.getState().draft).toBe(draft);
  expect(useStore.getState().lifts).toBe(before);
  expect(() => s.setSessionsPerWeek(8)).toThrow();
});

test('531 rounds percentages to the actual lb plate inventory', () => {
  const sets = fiveThreeOneSets(toKg(225, 'lb'), 0, ex.BARBELL_SQUAT, inv, 'lb');
  expect(sets.map((s) => Math.round(toUnit(s.kg!, 'lb')))).toEqual([145, 170, 190, 145, 145, 145, 145, 145]);
});

test('a later slot with a separate lift key does not delay the 531 TM increase', () => {
  const p: Program = { ...five, days: [five.days[0], program.days[1]] };
  expect(sessionFor(p, 4).slots[0]).toMatchObject({ week: 2, lastInWeek: true });
});

test('a later stage judges its AMRAP set by that stage, not stage 0', () => {
  const s = useStore.getState();
  s.setProgram(program);
  s.setLift('BARBELL_SQUAT', { weightKg: 100, stage: 1 });
  const draft = useStore.getState().startSession(0);
  draft.results.BARBELL_SQUAT.sets.forEach((set, i) => {
    useStore.getState().logSet('BARBELL_SQUAT', i, set.target ?? 3);
  });
  useStore.getState().finishSession();
  expect(useStore.getState().lifts.BARBELL_SQUAT).toMatchObject({ weightKg: 102.5, stage: 1 });
});

test('a new plan starts on its first day and first 5/3/1 week, whatever the session count', () => {
  useStore.setState({ nextSession: 7 });
  const plan: Program = {
    ...program,
    template: 'other',
    days: [{ name: 'A', slots: [{ exercise: 'BARBELL_SQUAT', scheme: '3x5+', progression: '531' }] }],
  };
  useStore.getState().setProgram(plan);
  const stored = useStore.getState().program!;
  expect(stored.startN).toBe(7);
  expect(sessionFor(stored, 7).slots[0].week).toBe(0);
  expect(sessionFor(stored, 8).slots[0].week).toBe(1);
  useStore.getState().setProgram({ ...plan, sessionsPerWeek: 2 });
  expect(useStore.getState().program!.startN).toBe(7);
});

test('a program start must be a non-negative whole number', () => {
  expect(validateProgram({ ...program, startN: -1 })).toContain('Invalid program start.');
  expect(validateProgram({ ...program, startN: 4 })).not.toContain('Invalid program start.');
});

test('GZCLP T3 holds the weight below 25 reps instead of deloading', () => {
  const t3 = { progression: 'linear' as const, scheme: '3x15+' as Scheme, advanceAt: 25 };
  const result = { weightKg: 50, sets: [15, 15, 20].map((reps, i) => ({ target: i < 2 ? 15 : null, reps })) };
  let state = { ...lift, weightKg: 50 };
  for (let i = 0; i < 3; i++) {
    const outcome = nextLift(state, result, DEFAULT_RULES, ex.LAT_PULLDOWN, inv, 'kg', t3);
    expect(outcome.change).toBe('same');
    state = outcome.next;
  }
  expect(state).toMatchObject({ weightKg: 50, fails: 0 });
});
