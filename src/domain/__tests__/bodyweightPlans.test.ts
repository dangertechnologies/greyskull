import { lifts, setProgram, startSession } from '../../__fixtures__/oneProgram';
import { PLANS } from '../../config/plans';
import { initialState, useStore } from '../../store';
import { exerciseOfLift, PLUGINS, type PluginId } from '../program';

const REPS = [3, 4, 5, 6, 8, 10, 12, 15, 20, 4, 25];

/**
 * Every plan without ladders, with its offered extras plus chin-ups and dips, as the store runs it. Ladder plans
 * are left out: the dip ladder already ends on dips, so the extra would put dips in a day twice, and ladders
 * add load by design (src/acceptance.test.ts covers them).
 */
const cases = PLANS.filter((plan) => !plan.program.days.some((d) => d.slots.some((s) => s.ladder))).map(
  (plan) => {
    const extras = [...new Set<PluginId>([...plan.plugins, 'chins', 'dips'])];
    return [plan.id, extras.reduce((p, id) => PLUGINS[id].apply(p), plan.program)] as const;
  },
);

describe('bodyweight extras of the built-in plans never change (no added load, same lift state)', () => {
  test.each(cases)('%s: 120 sessions', (_id, program) => {
    useStore.setState({ ...initialState(), hydrated: true });
    setProgram(program);
    const { exercises } = useStore.getState();
    const bodyweight = () =>
      Object.fromEntries(
        Object.entries(lifts()).filter(([key]) => exercises[exerciseOfLift(key)]?.kind === 'bodyweight'),
      );
    const before = bodyweight();
    expect(Object.keys(before)).toEqual(expect.arrayContaining(['CHINUPS', 'DIPS']));
    for (const state of Object.values(before))
      expect(state).toMatchObject({ weightKg: 0, startKg: 0, fails: 0 });
    for (let i = 0; i < 120; i++) {
      const draft = startSession();
      draft.order.forEach((id, k) => {
        draft.results[id].sets.forEach((set, j) => {
          const reps = REPS[(i + k * 3 + j) % REPS.length];
          useStore.getState().logSet(id, j, reps < 5 ? reps : Math.max(reps, set.target ?? 0));
        });
        if (exercises[id].kind === 'bodyweight') expect(draft.results[id].weightKg).toBe(0);
      });
      useStore.getState().finishSession();
      expect(bodyweight()).toEqual(before);
    }
  });

  test('the 5/3/1 and StrongLifts extras are covered', () => {
    const ids = (planId: string) =>
      cases.find(([id]) => id === planId)?.[1].days.flatMap((d) => d.slots.map((s) => s.exercise));
    expect(ids('531-beginners')).toEqual(expect.arrayContaining(['DIPS', 'CHINUPS']));
    expect(ids('stronglifts')).toEqual(expect.arrayContaining(['DIPS', 'CHINUPS']));
  });
});
