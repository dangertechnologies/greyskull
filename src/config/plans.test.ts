import { builtInExercises } from '../catalog';
import { PLUGINS, sessionFor, validateProgram } from '../domain';
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
