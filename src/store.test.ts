import AsyncStorage from '@react-native-async-storage/async-storage';
import fixture from './dev/v1-imperial.json';
import type { Program } from './domain';
import { isLoadable, PLUGINS, TEMPLATES, toKg } from './domain';
import { initialState, initStore, LEGACY_KEY, STORAGE_KEY, snapshot, useStore } from './store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const get = () => useStore.getState();
const baseProgram = (): Program => JSON.parse(JSON.stringify(TEMPLATES.base)) as Program;

beforeEach(async () => {
  await AsyncStorage.clear();
  useStore.setState({ ...initialState(), hydrated: false });
});

const flush = () => new Promise((r) => setImmediate(r));

/** Simulate killing and reopening the app: what was written to storage is all that survives. */
async function relaunch() {
  await flush();
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  useStore.setState({ ...initialState(), hydrated: false });
  await flush();
  if (stored !== null) await AsyncStorage.setItem(STORAGE_KEY, stored);
  await initStore();
}

function playSession(reps: number) {
  const { nextSession } = get();
  const draft = get().startSession(nextSession);
  for (const id of draft.order) {
    draft.results[id].sets.forEach((_s, i) => {
      get().logSet(id, i, reps);
    });
  }
  return get().finishSession();
}

describe('actions', () => {
  beforeEach(() => get().setProgram(baseProgram()));

  test('setProgram creates bar-weight lifts for barbells only and validates', () => {
    expect(get().lifts.BARBELL_SQUAT).toEqual({ weightKg: 20, startKg: 20, fails: 0 });
    get().reset();
    get().setProgram(PLUGINS.chins.apply(TEMPLATES.base));
    expect(get().lifts.CHINUPS).toBeUndefined();
    expect(() => get().setProgram({ ...baseProgram(), days: [] })).toThrow();
    const bad = baseProgram();
    bad.days[0].slots.push({ exercise: 'NOPE', scheme: '2x5+' });
    expect(() => get().setProgram(bad)).toThrow(/NOPE/);
  });

  test('setProgram keeps existing lifts and discards the draft', () => {
    get().setLift('BARBELL_SQUAT', { weightKg: 100 });
    get().startSession(0);
    get().setProgram(baseProgram());
    expect(get().lifts.BARBELL_SQUAT.weightKg).toBe(100);
    expect(get().draft).toBeNull();
  });

  test('startSession twice returns the same draft; sets follow the scheme', () => {
    const a = get().startSession(0);
    const b = get().startSession(0);
    expect(b).toBe(a);
    expect(a.order).toEqual(['MILITARY_PRESS', 'BARBELL_SQUAT']);
    expect(a.results.BARBELL_SQUAT.sets).toEqual([
      { target: 5, reps: 0 },
      { target: null, reps: 0 },
    ]);
    expect(a.results.BARBELL_SQUAT.weightKg).toBe(20);
  });

  test('finishSession applies progression exactly once', () => {
    get().setLift('BARBELL_SQUAT', { weightKg: 100 });
    const out = playSession(8);
    expect(get().lifts.BARBELL_SQUAT.weightKg).toBe(102.5);
    expect(out.BARBELL_SQUAT.change).toBe('up');
    expect(out.MILITARY_PRESS.next.weightKg).toBe(22.5);
    expect(get().nextSession).toBe(1);
    expect(get().sessions).toHaveLength(1);
    expect(get().sessions[0].finishedAt).toBeDefined();
    expect(get().draft).toBeNull();
    expect(() => get().finishSession()).toThrow();
    expect(get().lifts.BARBELL_SQUAT.weightKg).toBe(102.5);
  });

  test('a failed AMRAP stays, a second one deloads to a loadable weight', () => {
    get().setLift('BARBELL_SQUAT', { weightKg: 100 });
    playSession(8); // session 0: press + squat → squat 102.5
    playSession(4); // session 1: bench + deadlift — squat untouched
    expect(get().lifts.BARBELL_SQUAT.weightKg).toBe(102.5);
    playSession(4); // session 2: squat fails once → stays
    expect(get().lifts.BARBELL_SQUAT).toMatchObject({ weightKg: 102.5, fails: 1 });
    const out = playSession(4); // session 3: second fail → 90 % of 102.5 floored to a loadable weight
    expect(out.BARBELL_SQUAT.change).toBe('deload');
    expect(get().lifts.BARBELL_SQUAT).toMatchObject({ weightKg: 90, fails: 0 });
  });

  test('weights never compound: many finished sessions grow linearly', () => {
    for (let i = 0; i < 60; i++) playSession(6);
    for (const id of ['BARBELL_SQUAT', 'DEADLIFT', 'BENCH_PRESS', 'MILITARY_PRESS']) {
      expect(get().lifts[id].weightKg).toBeLessThanOrEqual(20 + 60 * 2.5);
    }
  });

  test('draft survives a JSON round trip and logSet/setDraftWeight write through', () => {
    get().startSession(0);
    get().logSet('MILITARY_PRESS', 1, 12);
    get().setDraftWeight('MILITARY_PRESS', 25);
    const copy = JSON.parse(JSON.stringify(snapshot(get()))) as ReturnType<typeof snapshot>;
    expect(copy.draft?.results.MILITARY_PRESS.sets[1].reps).toBe(12);
    expect(copy.draft?.results.MILITARY_PRESS.weightKg).toBe(25);
    get().setDraftWeight('MILITARY_PRESS', -3);
    expect(get().draft?.results.MILITARY_PRESS.weightKg).toBe(25);
  });

  test('finish uses the weight actually lifted when edited mid-session', () => {
    get().startSession(0);
    get().setDraftWeight('BARBELL_SQUAT', 40);
    get().logSet('BARBELL_SQUAT', 1, 6);
    get().finishSession();
    expect(get().lifts.BARBELL_SQUAT.weightKg).toBe(42.5);
  });

  test('skipSession advances and logs a skipped entry; discards the draft', () => {
    get().startSession(0);
    get().skipSession();
    expect(get().nextSession).toBe(1);
    expect(get().draft).toBeNull();
    expect(get().sessions[0]).toMatchObject({ n: 0, skipped: true });
  });

  test('editSession replaces results without recomputing lifts', () => {
    playSession(8);
    const before = get().lifts;
    get().editSession(0, { BARBELL_SQUAT: { weightKg: 50, sets: [{ target: null, reps: 3 }] } });
    expect(get().sessions[0].results.BARBELL_SQUAT.weightKg).toBe(50);
    expect(get().lifts).toBe(before);
  });

  test('setLift validates and creates missing lifts', () => {
    expect(() => get().setLift('BARBELL_SQUAT', { weightKg: 0 })).toThrow();
    get().setLift('CURLS', { weightKg: 12.5 });
    expect(get().lifts.CURLS).toEqual({ weightKg: 12.5, startKg: 12.5, fails: 0 });
  });

  test('settings and inventory merge; rest time is clamped', () => {
    get().setSettings({ restSeconds: 999 });
    expect(get().restSeconds).toBe(300);
    get().setSettings({ restSeconds: -5, minimalist: true });
    expect(get().restSeconds).toBe(0);
    expect(get().minimalist).toBe(true);
    get().setInventory({ barKg: 15 });
    expect(get().inventory.barKg).toBe(15);
    expect(get().inventory.platesKg).toHaveLength(7);
  });

  test('custom exercises: built-ins protected, referenced ones refused, unreferenced deleted', () => {
    expect(() => get().deleteExercise('BENCH_PRESS')).toThrow();
    get().upsertExercise({
      id: 'custom_front_squat',
      name: 'Front squat',
      shortName: 'Front',
      icon: 'squat',
      kind: 'barbell',
      increment: { kg: 2.5, lb: 5 },
      custom: true,
    });
    const p = baseProgram();
    p.days[0].slots.push({ exercise: 'custom_front_squat', scheme: '2x5+' });
    get().setProgram(p);
    expect(get().lifts.custom_front_squat.weightKg).toBe(20);
    expect(get().deleteExercise('custom_front_squat')).toEqual(['Day 1']);
    expect(get().exercises.custom_front_squat).toBeDefined();
    get().setProgram(baseProgram());
    expect(get().deleteExercise('custom_front_squat')).toEqual([]);
    expect(get().exercises.custom_front_squat).toBeUndefined();
    expect(get().lifts.custom_front_squat).toBeUndefined();
  });

  test('reset gives a fresh state; setProgram still works and INITIAL is not mutated', () => {
    get().setLift('BARBELL_SQUAT', { weightKg: 123 });
    get().setInventory({ barKg: 15 });
    get().reset();
    expect(get().program).toBeNull();
    expect(get().inventory.barKg).toBe(20);
    expect(initialState().inventory.barKg).toBe(20);
    get().setProgram(baseProgram());
    expect(get().lifts.BARBELL_SQUAT.weightKg).toBe(20);
  });

  test('exportJson has the state but no actions', () => {
    const json = JSON.parse(get().exportJson()) as Record<string, unknown>;
    expect(json.version).toBe(2);
    expect(json.hydrated).toBeUndefined();
    expect(json.setUnit).toBeUndefined();
  });

  test('switching to lb snaps lifts to lb-loadable weights; toggling 20 times is lossless', () => {
    const original = { BARBELL_SQUAT: 100, DEADLIFT: 62.5, BENCH_PRESS: 20, MILITARY_PRESS: 37.5 };
    for (const [id, kg] of Object.entries(original)) get().setLift(id, { weightKg: kg, startKg: kg });
    get().setUnit('lb');
    expect(get().lifts.BENCH_PRESS.weightKg).toBeCloseTo(toKg(45, 'lb'), 9);
    for (const id of Object.keys(original))
      expect(isLoadable(get().lifts[id].weightKg, get().inventory, 'lb')).toBe(true);
    get().setUnit('kg');
    for (let i = 0; i < 19; i++) get().setUnit(i % 2 === 0 ? 'lb' : 'kg');
    expect(get().unit).toBe('lb');
    get().setUnit('kg');
    for (const [id, kg] of Object.entries(original)) {
      expect(get().lifts[id].weightKg).toBe(kg);
      expect(get().lifts[id].startKg).toBe(kg);
    }
  });

  test('switching units mid-session re-snaps the draft weights too', () => {
    get().startSession(0);
    get().setUnit('lb');
    expect(get().draft?.results.BARBELL_SQUAT.weightKg).toBeCloseTo(toKg(45, 'lb'), 9);
  });
});

describe('persistence and migration', () => {
  test('state persists and rehydrates', async () => {
    get().setProgram(baseProgram());
    get().startSession(0);
    get().logSet('MILITARY_PRESS', 0, 5);
    await relaunch();
    expect(get().hydrated).toBe(true);
    expect(get().program?.template).toBe('base');
    expect(get().draft?.results.MILITARY_PRESS.sets[0].reps).toBe(5);
  });

  test('first launch with GSLP_STATE_18 migrates and leaves the legacy key alone', async () => {
    const raw = JSON.stringify(fixture);
    await AsyncStorage.setItem(LEGACY_KEY, raw);
    await initStore();
    expect(get().unit).toBe('lb');
    expect(get().needsWeightConfirm).toBe(true);
    expect(get().needsWeightConfirmSuspects).toEqual(['BENT_OVER_ROW']);
    expect(get().lifts.BENT_OVER_ROW.weightKg).toBe(20.41);
    expect(get().sessions).toHaveLength(2);
    expect(get().nextSession).toBe(2);
    expect(await AsyncStorage.getItem(LEGACY_KEY)).toBe(raw);
  });

  test('confirmWeights stores the edited weights and clears the flag', async () => {
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify(fixture));
    await initStore();
    get().confirmWeights({ BENT_OVER_ROW: toKg(45, 'lb') });
    expect(get().needsWeightConfirm).toBe(false);
    expect(get().needsWeightConfirmSuspects).toEqual([]);
    expect(get().lifts.BENT_OVER_ROW.weightKg).toBeCloseTo(20.41, 2);
  });

  test('Reset does not bring v1 data back on the next launch and keeps the legacy key', async () => {
    const raw = JSON.stringify(fixture);
    await AsyncStorage.setItem(LEGACY_KEY, raw);
    await initStore();
    get().reset();
    await relaunch();
    expect(get().program).toBeNull();
    expect(get().needsWeightConfirm).toBe(false);
    expect(await AsyncStorage.getItem(LEGACY_KEY)).toBe(raw);
  });

  test('importLegacy (dev seed) re-imports on demand', async () => {
    await initStore();
    expect(await get().importLegacy()).toBe(false);
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify(fixture));
    expect(await get().importLegacy()).toBe(true);
    expect(get().sessions).toHaveLength(2);
  });

  test('corrupt legacy data starts fresh and still hydrates', async () => {
    await AsyncStorage.setItem(LEGACY_KEY, '{oops');
    await initStore();
    expect(get().hydrated).toBe(true);
    expect(get().program).toBeNull();
  });
});

test('an install with an older exercise catalog gets the new form tips and videos on launch', async () => {
  const stale = { ...initialState(), catalogVersion: 1 };
  stale.exercises.BENCH_PRESS = { ...stale.exercises.BENCH_PRESS, goodForm: ['old'], video: undefined };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ state: stale, version: 2 }));
  await initStore();
  expect(useStore.getState().exercises.BENCH_PRESS.goodForm).not.toEqual(['old']);
  expect(useStore.getState().exercises.BENCH_PRESS.video).toMatch(/youtube/);
  expect(useStore.getState().catalogVersion).toBe(2);
});
