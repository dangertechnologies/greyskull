import { getPlan, PLANS } from './config/plans';
import type { AppState, Unit } from './domain';
import { formatPlates, isLoadable, PLUGINS, platesPerSide, project, TEMPLATES, toKg, toUnit } from './domain';
import { initialState, useStore } from './store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

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
  for (const [id, lift] of Object.entries(s.lifts)) {
    if (s.exercises[id].kind === 'bodyweight') continue;
    check(lift.weightKg);
    expect(lift.weightKg).toBeLessThan(1000);
  }
  for (const p of project(s as AppState, 9)) {
    for (const l of p.lifts) if (s.exercises[l.exercise].kind !== 'bodyweight') check(l.weightKg);
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
    s.setProgram(PLUGINS.chins.apply(PLUGINS.curls.apply(TEMPLATES.base)));
    const startKg = toKg(unit === 'kg' ? 20 : 45, unit);

    for (let i = 0; i < 150; i++) {
      const state = useStore.getState();
      const draft = state.startSession(state.nextSession);
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
    for (const lift of Object.values(useStore.getState().lifts))
      expect(lift.weightKg).toBeLessThanOrEqual(maxKg);
  });
});

test('toggling kg ↔ lb 20 times leaves every displayed weight unchanged', () => {
  useStore.setState({ ...initialState(), hydrated: true });
  const s = useStore.getState();
  s.setProgram(TEMPLATES.base);
  for (const [id, kg] of [
    ['BARBELL_SQUAT', 102.5],
    ['DEADLIFT', 140],
    ['BENCH_PRESS', 62.5],
    ['MILITARY_PRESS', 40],
  ] as const) {
    s.setLift(id, { weightKg: kg, startKg: kg });
  }
  const before = JSON.stringify(useStore.getState().lifts);
  for (let i = 0; i < 20; i++) useStore.getState().setUnit(i % 2 === 0 ? 'lb' : 'kg');
  expect(useStore.getState().unit).toBe('kg');
  expect(JSON.stringify(useStore.getState().lifts)).toBe(before);
});

test.each(PLANS.map((p) => [p.id] as const))(
  '%s: 120 mixed sessions keep every weight loadable and bounded',
  (planId) => {
    useStore.setState({ ...initialState(), hydrated: true });
    const s = useStore.getState();
    s.setProgram(getPlan(planId)!.program);
    for (let i = 0; i < 120; i++) {
      const state = useStore.getState();
      const draft = state.startSession(state.nextSession);
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
    for (const lift of Object.values(useStore.getState().lifts))
      expect(lift.weightKg).toBeLessThanOrEqual(20 + 120 * 10);
  },
);
