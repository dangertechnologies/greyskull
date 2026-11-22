import { builtInExercises } from '../catalog';
import { liftKeyOf, PLUGINS, sessionFor, tryParseScheme, validateProgram } from '../domain';
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
  const ids = [0, 1, 2, 3].map((n) => sessionFor(plan, n).slots.map((s) => `${s.exercise}:${s.scheme}`));
  expect(ids[0]).toEqual(['BARBELL_SQUAT:5x5', 'BENCH_PRESS:5x5', 'BENT_OVER_ROW:5x5']);
  expect(ids[1]).toEqual(['BARBELL_SQUAT:5x5', 'MILITARY_PRESS:5x5', 'DEADLIFT:1x5']);
  expect(ids[2]).toEqual(ids[0]);
});

test('AllPro runs heavy, light (80 %), medium (90 %) with an 8–12 rep range', () => {
  const plan = getPlan('allpro')!.program;
  expect([0, 1, 2, 3].map((n) => [sessionFor(plan, n).dayName, sessionFor(plan, n).intensity])).toEqual([
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
  const store = useStore.getState();
  store.setProgram(getPlan('gzclp')!.program);
  store.setLift('BENCH_PRESS', { weightKg: 80, startKg: 80, fails: 0, stage: 1 });
  store.setLift('BENCH_PRESS@T2', { weightKg: 40, startKg: 40, fails: 0, stage: 2 });
  const state = useStore.getState();
  expect(state.lifts.BENCH_PRESS).toMatchObject({ weightKg: 80, stage: 1 });
  expect(state.lifts['BENCH_PRESS@T2']).toMatchObject({ weightKg: 40, stage: 2 });
  const draft = store.startSession(0);
  expect(draft.results.BENCH_PRESS.weightKg).toBe(40);
  expect(draft.results.BENCH_PRESS.sets.map((s) => s.target)).toEqual([6, 6, 6]);
  expect(sessionFor(state.program!, 2, state.lifts).slots[0].scheme).toBe('6x2+');
});

test.each([0, 1, 2])('5/3/1 day %s builds eight sets for each main lift', (n) => {
  useStore.setState({ ...initialState(), hydrated: true });
  const program = getPlan('531-beginners')!.program;
  const store = useStore.getState();
  store.setProgram(program);
  const draft = store.startSession(n);
  const main = sessionFor(program, n).slots.filter((s) => s.progression === '531');
  expect(main).toHaveLength(2);
  for (const slot of main) {
    const sets = draft.results[slot.exercise].sets;
    expect(sets).toHaveLength(8);
    expect(sets.map((s) => s.target)).toEqual([5, 5, null, 5, 5, 5, 5, 5]);
    expect(sets.every((s) => s.kg !== undefined)).toBe(true);
  }
});
