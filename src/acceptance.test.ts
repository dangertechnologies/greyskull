import { lifts, programId, setLift, setProgram, startSession } from './__fixtures__/oneProgram';
import { getPlan, PLANS } from './config/plans';
import type { AppState, SessionLog, Unit } from './domain';
import {
  exerciseOfLift,
  formatPlates,
  isLoadable,
  PLUGINS,
  platesPerSide,
  project,
  roundAddedLoad,
  TEMPLATES,
  toKg,
  toUnit,
} from './domain';
import { getLadder } from './domain/ladders';
import { initialState, useStore } from './store';

const REPS = [3, 4, 5, 6, 8, 10, 12, 4, 4, 5];

function everyWeightLoadable(unit: Unit) {
  const s = useStore.getState();
  const bar = unit === 'kg' ? s.inventory.barKg : s.inventory.barLb;
  const check = (kg: number) => {
    expect(isLoadable(kg, s.inventory, unit)).toBe(true);
    const side = platesPerSide(kg, s.inventory, unit);
    expect(bar + 2 * side.reduce((a, b) => a + b, 0)).toBeCloseTo(toUnit(kg, unit), 6);
    expect(formatPlates(kg, s.inventory, unit)).toMatch(/^(bar only|per side: )/);
  };
  for (const [key, lift] of Object.entries(lifts())) {
    expect(lift.weightKg).toBeLessThan(1000);
    // Dumbbells and machines round to their own step, not to bar + plates.
    if (s.exercises[exerciseOfLift(key)]?.kind === 'barbell') check(lift.weightKg);
  }
  for (const p of project(s as AppState, programId(), 9)) {
    for (const l of p.lifts) if (s.exercises[l.exercise].kind === 'barbell') check(l.weightKg);
  }
}

describe.each<[Unit, number[]]>([
  ['kg', []],
  ['kg', [0.5]],
  ['lb', []],
  ['lb', [1.25]],
])('%s with extra plates %j', (unit, extra) => {
  test('150 sessions of mixed results keep every weight loadable, bounded and plate-consistent', () => {
    useStore.setState({ ...initialState(), hydrated: true });
    const s = useStore.getState();
    if (unit === 'lb') s.setUnit('lb');
    if (extra.length) {
      s.setInventory(
        unit === 'kg'
          ? { platesKg: [...s.inventory.platesKg, ...extra] }
          : { platesLb: [...s.inventory.platesLb, ...extra] },
      );
    }
    setProgram(PLUGINS.chins.apply(PLUGINS.curls.apply(TEMPLATES.base)));
    const startKg = toKg(unit === 'kg' ? 20 : 45, unit);

    for (let i = 0; i < 150; i++) {
      const draft = startSession();
      draft.order.forEach((id, k) => {
        const reps = REPS[(i + k * 3) % REPS.length];
        draft.results[id].sets.forEach((_x, j) => {
          useStore.getState().logSet(id, j, reps);
        });
      });
      useStore.getState().finishSession();
      everyWeightLoadable(unit);
    }
    // No compounding: nothing can grow faster than two increments (2 × 5 lb / 2 × 2.5 kg) per session.
    const maxKg = startKg + 150 * (unit === 'kg' ? 5.5 : 2 * 5 * 0.45359237 + 0.5);
    for (const lift of Object.values(lifts())) expect(lift.weightKg).toBeLessThanOrEqual(maxKg);
  });
});

test('toggling kg ↔ lb 20 times leaves every displayed weight unchanged', () => {
  useStore.setState({ ...initialState(), hydrated: true });
  setProgram(TEMPLATES.base);
  for (const [id, kg] of [
    ['BARBELL_SQUAT', 102.5],
    ['DEADLIFT', 140],
    ['BENCH_PRESS', 62.5],
    ['MILITARY_PRESS', 40],
  ] as const) {
    setLift(id, { weightKg: kg, startKg: kg });
  }
  const before = JSON.stringify(lifts());
  for (let i = 0; i < 20; i++) useStore.getState().setUnit(i % 2 === 0 ? 'lb' : 'kg');
  expect(useStore.getState().unit).toBe('kg');
  expect(JSON.stringify(lifts())).toBe(before);
});

test.each(PLANS.map((p) => [p.id] as const))(
  '%s: 120 mixed sessions keep every weight loadable and bounded',
  (planId) => {
    useStore.setState({ ...initialState(), hydrated: true });
    setProgram(getPlan(planId)!.program);
    for (let i = 0; i < 120; i++) {
      const state = useStore.getState();
      const draft = startSession();
      draft.order.forEach((id, k) => {
        draft.results[id].sets.forEach((set, j) => {
          const miss = REPS[(i + k * 3 + j) % REPS.length] < 4;
          useStore.getState().logSet(id, j, miss ? 3 : (set.target ?? REPS[(i + k) % REPS.length]));
        });
        expect(
          isLoadable(draft.results[id].weightKg, state.inventory, 'kg') ||
            state.exercises[id].kind !== 'barbell',
        ).toBe(true);
      });
      useStore.getState().finishSession();
      everyWeightLoadable('kg');
    }
    for (const lift of Object.values(lifts())) expect(lift.weightKg).toBeLessThanOrEqual(20 + 120 * 10);
  },
);

describe('calisthenics plans', () => {
  const NEW_PLANS = ['recommended-routine', 'six-ladders', 'skill-track', 'hybrid'];
  const get = () => useStore.getState();

  /** Every ladder slot of a program, with the ladder's step count. */
  const ladderIds = (planId: string) =>
    [
      ...new Set(
        getPlan(planId)!.program.days.flatMap((d) => d.slots.flatMap((s) => (s.ladder ? [s.ladder] : []))),
      ),
    ].filter((id) => (getLadder(id)?.steps.length ?? 0) > 1);

  /** Log every set of a draft: the target, or 3 reps (a miss) when `miss` says so. */
  function play(programIdToPlay: string, miss: (exercise: string, set: number) => boolean = () => false) {
    const draft = get().startSession(programIdToPlay);
    draft.order.forEach((id) => {
      draft.results[id].sets.forEach((set, j) => {
        get().logSet(id, j, miss(id, j) ? 1 : (set.target ?? 8));
      });
    });
    return draft;
  }

  describe.each(NEW_PLANS.map((id) => [id] as const))('%s', (planId) => {
    test('120 sessions with misses: ladders advance one step at a time and never fall back, loads stay loadable', () => {
      useStore.setState({ ...initialState(), hydrated: true });
      const id = get().addProgram({ ...getPlan(planId)!.program, name: planId });
      const steps: Record<string, number> = {};
      const state = () => get().programs.find((p) => p.id === id)!;
      for (let i = 0; i < 120; i++) {
        // The first set of every fourth session is a miss, so deloads happen too.
        const draft = play(id, (_e, set) => i % 4 === 3 && set === 0);
        for (const key of draft.order) {
          const result = draft.results[key];
          if (result.lift !== undefined && getLadder(result.lift)) {
            expect(getLadder(result.lift)!.steps[result.step ?? 0].exercise).toBe(key);
          }
        }
        get().finishSession();
        for (const [key, lift] of Object.entries(state().lifts)) {
          const ladder = getLadder(key);
          if (!ladder) continue;
          const step = lift.step ?? 0;
          expect(step - (steps[key] ?? 0)).toBeGreaterThanOrEqual(0);
          expect(step - (steps[key] ?? 0)).toBeLessThanOrEqual(1);
          steps[key] = step;
          expect(step).toBeLessThan(ladder.steps.length);
          // Added load only after the last step of a weighted ladder, in whole single plates.
          if (ladder.after !== 'weighted' || step < ladder.steps.length - 1) expect(lift.weightKg).toBe(0);
          expect(roundAddedLoad(lift.weightKg, get().inventory, 'kg')).toBe(lift.weightKg);
        }
        for (const [key, lift] of Object.entries(state().lifts)) {
          const exercise = get().exercises[exerciseOfLift(key)];
          if (exercise?.kind === 'barbell')
            expect(isLoadable(lift.weightKg, get().inventory, 'kg')).toBe(true);
        }
      }
      for (const ladder of ladderIds(planId)) expect(steps[ladder]).toBeGreaterThan(0);
    });
  });

  test('two programs together keep their own positions and lifts, even for a ladder they share', () => {
    useStore.setState({ ...initialState(), hydrated: true });
    const routine = get().addProgram({ ...getPlan('recommended-routine')!.program, name: 'Routine' });
    const skills = get().addProgram({ ...getPlan('skill-track')!.program, name: 'Skills' });
    const hybrid = get().addProgram({ ...getPlan('hybrid')!.program, name: 'Hybrid' });
    const find = (id: string) => get().programs.find((p) => p.id === id)!;
    const run = (id: string) => {
      play(id);
      get().finishSession();
    };
    for (let i = 0; i < 40; i++) run(routine);
    for (let i = 0; i < 5; i++) run(skills);
    run(hybrid);
    expect([routine, skills, hybrid].map((id) => find(id).position)).toEqual([40, 5, 1]);
    // The routine climbed its pull-up ladder; the hybrid, which shares the ladder, has done one session.
    expect(find(routine).lifts.rr_pullup.step ?? 0).toBeGreaterThan(find(hybrid).lifts.rr_pullup.step ?? 0);
    expect(find(hybrid).lifts.rr_pullup.step ?? 0).toBe(0);
    // Each program holds only its own lifts.
    expect(Object.keys(find(skills).lifts).sort()).toEqual(
      ['skill_front_lever', 'skill_handstand', 'skill_lsit', 'skill_muscleup', 'skill_planche'].sort(),
    );
    expect(Object.keys(find(routine).lifts)).not.toContain('skill_handstand');
    expect(Object.keys(find(hybrid).lifts)).toEqual(
      expect.arrayContaining(['BARBELL_SQUAT', 'DEADLIFT', 'rr_pullup', 'rr_row']),
    );
    expect(
      get()
        .sessions.map((s) => s.programId)
        .filter((p) => p === skills),
    ).toHaveLength(5);
  });

  describe('a break counts training in every program', () => {
    const DAY = 86_400_000;
    const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
    const pullups = (days: number, programId: string, step: number): SessionLog => ({
      n: 100 + days,
      programId,
      dayName: 'Old',
      startedAt: ago(days),
      finishedAt: ago(days),
      results: {
        [getLadder('rr_pullup')!.steps[step].exercise]: {
          weightKg: 0,
          lift: 'rr_pullup',
          step,
          sets: [{ target: 5, reps: 5 }],
        },
      },
      order: [getLadder('rr_pullup')!.steps[step].exercise],
    });

    function setUp() {
      useStore.setState({ ...initialState(), hydrated: true });
      const routine = get().addProgram({ ...getPlan('recommended-routine')!.program, name: 'Routine' });
      const hybrid = get().addProgram({ ...getPlan('hybrid')!.program, name: 'Hybrid' });
      // The routine's pull-up is at step 3 with a state older than its last session, as after an update.
      useStore.setState((s) => ({
        programs: s.programs.map((p) =>
          p.id === routine
            ? { ...p, lifts: { ...p.lifts, rr_pullup: { weightKg: 0, startKg: 0, fails: 0, step: 3 } } }
            : p,
        ),
      }));
      return { routine, hybrid };
    }

    test('five weeks off every program: the ladder goes down one step', () => {
      const { routine } = setUp();
      useStore.setState({ sessions: [pullups(35, routine, 3)] });
      const draft = get().startSession(routine);
      expect(draft.results[getLadder('rr_pullup')!.steps[2].exercise]).toBeDefined();
    });

    test('a recent session of the same ladder in another program means no ease', () => {
      const { routine, hybrid } = setUp();
      useStore.setState({ sessions: [pullups(35, routine, 3), pullups(3, hybrid, 0)] });
      const draft = get().startSession(routine);
      expect(draft.eased).toBeUndefined();
      expect(draft.results[getLadder('rr_pullup')!.steps[3].exercise]).toBeDefined();
    });
  });
});
