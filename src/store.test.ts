import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import {
  lifts,
  program,
  programId,
  setLift,
  setPosition,
  setProgram,
  skipSession,
  startSession,
  undoSkip,
} from './__fixtures__/oneProgram';
import { CATALOG_VERSION } from './catalog';
import { getPlan } from './config/plans';
import fixture from './dev/v1-imperial.json';
import type { AppState, LiftState, Program, SessionLog } from './domain';
import { isLoadable, PLUGINS, TEMPLATES, toKg } from './domain';
import { stateFile } from './storage';
import { initialState, initStore, LEGACY_KEY, STORAGE_KEY, snapshot, storage, useStore } from './store';

const get = () => useStore.getState();
const baseProgram = (): Program => JSON.parse(JSON.stringify(TEMPLATES.base)) as Program;
const files = (jest.requireMock('expo-file-system') as { __files: Map<string, string> }).__files;
const stored = () =>
  JSON.parse(files.get(stateFile().uri) ?? 'null') as { state: AppState; version: number } | null;

beforeEach(async () => {
  files.clear();
  await AsyncStorage.clear();
  useStore.setState({ ...initialState(), hydrated: false, storageError: null });
});

/** Simulate killing and reopening the app: what was written to the file is all that survives. */
async function relaunch() {
  await storage.flush();
  useStore.setState({ ...initialState(), hydrated: false, storageError: null });
  await initStore();
}

function play(id: string, reps: number) {
  const draft = get().startSession(id);
  for (const ex of draft.order) {
    draft.results[ex].sets.forEach((_s, i) => {
      get().logSet(ex, i, reps);
    });
  }
  return get().finishSession();
}
const playSession = (reps: number) => play(programId(), reps);

describe('actions', () => {
  beforeEach(() => setProgram(baseProgram()));

  test('addProgram creates starting lifts (barbells at the bar, bodyweight at 0 kg) and validates', () => {
    expect(lifts().BARBELL_SQUAT).toEqual({
      weightKg: 20,
      startKg: 20,
      fails: 0,
      touchedAt: expect.any(String),
    });
    get().reset();
    const id = get().addProgram({ ...PLUGINS.chins.apply(TEMPLATES.base), name: 'With chins' });
    expect(get().programs[0]).toMatchObject({ id, name: 'With chins', position: 0, template: 'base' });
    expect(id).toMatch(/^base-/);
    expect(get().programs[0].lifts.CHINUPS).toEqual({
      weightKg: 0,
      startKg: 0,
      fails: 0,
      touchedAt: expect.any(String),
    });
    expect(() => get().addProgram({ ...baseProgram(), days: [], name: 'x' })).toThrow();
    const bad = baseProgram();
    bad.days[0].slots.push({ exercise: 'NOPE', scheme: '2x5+' });
    expect(() => get().addProgram({ ...bad, name: 'x' })).toThrow(/NOPE/);
    expect(get().programs).toHaveLength(1);
  });

  test('updateProgram keeps lifts and position for the same plan, starts another plan at its first day', () => {
    setLift('BARBELL_SQUAT', { weightKg: 100 });
    playSession(5);
    startSession();
    setProgram(baseProgram());
    expect(lifts().BARBELL_SQUAT.weightKg).toBe(102.5);
    expect(program().position).toBe(1);
    expect(get().draft).toBeNull();
    setProgram(getPlan('stronglifts')!.program);
    expect(program()).toMatchObject({ template: 'stronglifts', position: 0, name: 'StrongLifts 5×5' });
    expect(lifts().BARBELL_SQUAT.weightKg).toBe(102.5);
  });

  test('startSession twice returns the same draft; sets follow the scheme; the id is reserved', () => {
    const a = startSession();
    const b = startSession();
    expect(b).toBe(a);
    expect(a).toMatchObject({ n: 0, programId: programId(), programName: 'Test program', position: 0 });
    expect(get().nextSession).toBe(1);
    expect(a.order).toEqual(['MILITARY_PRESS', 'BARBELL_SQUAT']);
    expect(a.slots?.map((s) => s.exercise)).toEqual(a.order);
    expect(a.results.BARBELL_SQUAT.sets).toEqual([
      { target: 5, reps: 0 },
      { target: null, reps: 0 },
    ]);
    expect(a.results.BARBELL_SQUAT.weightKg).toBe(20);
  });

  test('finishSession applies progression exactly once and leaves the resolved slots out of history', () => {
    setLift('BARBELL_SQUAT', { weightKg: 100 });
    const out = playSession(8);
    expect(lifts().BARBELL_SQUAT.weightKg).toBe(102.5);
    expect(out.BARBELL_SQUAT.change).toBe('up');
    expect(out.MILITARY_PRESS.next.weightKg).toBe(22.5);
    expect(get().nextSession).toBe(1);
    expect(program().position).toBe(1);
    expect(get().sessions).toHaveLength(1);
    expect(get().sessions[0]).toMatchObject({ n: 0, programId: programId(), position: 0 });
    expect(get().sessions[0].slots).toBeUndefined();
    expect(get().sessions[0].finishedAt).toBeDefined();
    expect(get().draft).toBeNull();
    expect(() => get().finishSession()).toThrow();
    expect(lifts().BARBELL_SQUAT.weightKg).toBe(102.5);
  });

  test('finishSession uses the slots stored on the draft, not the program as it is now', () => {
    const p = baseProgram();
    p.days[0].slots[1] = { ...p.days[0].slots[1], lift: 'BARBELL_SQUAT@HEAVY' };
    setProgram(p);
    const draft = startSession();
    // Rules change mid-workout (allowed); the program's slots no longer match the draft's lift keys.
    useStore.setState((s) => ({
      programs: s.programs.map((x) => ({ ...x, days: baseProgram().days })),
    }));
    draft.results.BARBELL_SQUAT.sets.forEach((_s, i) => {
      get().logSet('BARBELL_SQUAT', i, 8);
    });
    get().finishSession();
    expect(lifts()['BARBELL_SQUAT@HEAVY'].weightKg).toBe(22.5);
    expect(lifts().BARBELL_SQUAT.weightKg).toBe(20);
  });

  test('a failed AMRAP stays, a second one deloads to a loadable weight', () => {
    setLift('BARBELL_SQUAT', { weightKg: 100 });
    playSession(8); // session 0: press + squat → squat 102.5
    playSession(4); // session 1: bench + deadlift — squat untouched
    expect(lifts().BARBELL_SQUAT.weightKg).toBe(102.5);
    playSession(4); // session 2: squat fails once → stays
    expect(lifts().BARBELL_SQUAT).toMatchObject({ weightKg: 102.5, fails: 1 });
    const out = playSession(4); // session 3: second fail → 90 % of 102.5 floored to a loadable weight
    expect(out.BARBELL_SQUAT.change).toBe('deload');
    expect(lifts().BARBELL_SQUAT).toMatchObject({ weightKg: 90, fails: 0 });
  });

  test('weights never compound: many finished sessions grow linearly', () => {
    for (let i = 0; i < 60; i++) playSession(6);
    for (const id of ['BARBELL_SQUAT', 'DEADLIFT', 'BENCH_PRESS', 'MILITARY_PRESS']) {
      expect(lifts()[id].weightKg).toBeLessThanOrEqual(20 + 60 * 2.5);
    }
  });

  test('draft survives a JSON round trip and logSet/setDraftWeight write through', () => {
    startSession();
    get().logSet('MILITARY_PRESS', 1, 12);
    get().setDraftWeight('MILITARY_PRESS', 25);
    const copy = JSON.parse(JSON.stringify(snapshot(get()))) as ReturnType<typeof snapshot>;
    expect(copy.draft?.results.MILITARY_PRESS.sets[1].reps).toBe(12);
    expect(copy.draft?.results.MILITARY_PRESS.weightKg).toBe(25);
    get().setDraftWeight('MILITARY_PRESS', -3);
    get().setDraftWeight('MILITARY_PRESS', 0);
    expect(get().draft?.results.MILITARY_PRESS.weightKg).toBe(25);
  });

  test('bodyweight exercises accept 0 kg in the draft and in their lift state', () => {
    setProgram(PLUGINS.chins.apply(TEMPLATES.base));
    const draft = startSession();
    expect(draft.results.CHINUPS.weightKg).toBe(0);
    get().setDraftWeight('CHINUPS', 10);
    get().setDraftWeight('CHINUPS', 0);
    expect(get().draft?.results.CHINUPS.weightKg).toBe(0);
    setLift('CHINUPS', { weightKg: 0 });
    expect(lifts().CHINUPS.weightKg).toBe(0);
    expect(() => setLift('BARBELL_SQUAT', { weightKg: 0 })).toThrow();
  });

  test('finish uses the weight actually lifted when edited mid-session', () => {
    startSession();
    get().setDraftWeight('BARBELL_SQUAT', 40);
    get().logSet('BARBELL_SQUAT', 1, 6);
    get().finishSession();
    expect(lifts().BARBELL_SQUAT.weightKg).toBe(42.5);
  });

  test('skipSession advances and logs a skipped entry; discards the draft of the same program', () => {
    startSession();
    skipSession();
    expect(get().nextSession).toBe(2);
    expect(program().position).toBe(1);
    expect(get().draft).toBeNull();
    expect(get().sessions[0]).toMatchObject({ n: 1, skipped: true, programId: programId(), position: 0 });
  });

  test('discardDraft drops the workout; its id stays used', () => {
    startSession();
    get().discardDraft();
    expect(get().draft).toBeNull();
    expect(startSession().n).toBe(1);
    expect(program().position).toBe(0);
  });

  test('editSession replaces results without recomputing lifts', () => {
    playSession(8);
    const before = lifts();
    get().editSession(0, { BARBELL_SQUAT: { weightKg: 50, sets: [{ target: null, reps: 3 }] } });
    expect(get().sessions[0].results.BARBELL_SQUAT.weightKg).toBe(50);
    expect(lifts()).toBe(before);
  });

  test('setLift validates and creates missing lifts', () => {
    expect(() => setLift('BARBELL_SQUAT', { weightKg: 0 })).toThrow();
    setLift('CURLS', { weightKg: 12.5 });
    expect(lifts().CURLS).toEqual({ weightKg: 12.5, startKg: 12.5, fails: 0, touchedAt: expect.any(String) });
    expect(() => get().setLift('nope', 'CURLS', { weightKg: 10 })).toThrow();
    get().setLiftStep(programId(), 'CURLS', 2);
    expect(lifts().CURLS.step).toBe(2);
    expect(() => get().setLiftStep(programId(), 'CURLS', -1)).toThrow();
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
    expect(get().inventory.kettlebellsKg).toEqual([8, 12, 16, 20, 24, 28, 32]);
  });

  test('equipment, bands, ease-back, health settings and health ids', () => {
    expect(get()).toMatchObject({ equipment: [], bands: [], breakDeload: true, healthSync: false });
    get().setEquipment(['barbell', 'rings', 'barbell']);
    get().setBands([{ id: 'red', label: 'Red' }]);
    get().setBreakDeload(false);
    get().setHealthSync(true);
    playSession(5);
    get().setHealthId(0, 'hk-1');
    expect(get()).toMatchObject({
      equipment: ['barbell', 'rings'],
      bands: [{ id: 'red', label: 'Red' }],
      breakDeload: false,
      healthSync: true,
    });
    expect(get().sessions[0].healthId).toBe('hk-1');
  });

  test('custom exercises: built-ins protected, referenced ones refused (programs and saved plans)', () => {
    expect(() => get().deleteExercise('BENCH_PRESS')).toThrow();
    get().upsertExercise({
      id: 'custom_front_squat',
      name: 'Front squat',
      shortName: 'Front',
      kind: 'barbell',
      increment: { kg: 2.5, lb: 5 },
      custom: true,
    });
    const p = baseProgram();
    p.days[0].slots.push({ exercise: 'custom_front_squat', scheme: '2x5+' });
    setProgram(p);
    expect(lifts().custom_front_squat.weightKg).toBe(20);
    expect(get().deleteExercise('custom_front_squat')).toEqual(['Day 1']);
    setProgram(baseProgram());
    get().saveCustomPlan({ id: 'mine', name: 'Mine', program: p });
    expect(get().deleteExercise('custom_front_squat')).toEqual(['Mine: Day 1']);
    get().deleteCustomPlan('mine');
    expect(get().deleteExercise('custom_front_squat')).toEqual([]);
    expect(get().exercises.custom_front_squat).toBeUndefined();
    expect(lifts().custom_front_squat).toBeUndefined();
  });

  test('saveCustomPlan validates and upserts by id', () => {
    const plan = { id: 'mine', name: ' Mine ', program: baseProgram() };
    get().saveCustomPlan(plan);
    get().saveCustomPlan({ ...plan, name: 'Renamed' });
    expect(get().customPlans).toEqual([{ ...plan, name: 'Renamed' }]);
    expect(() => get().saveCustomPlan({ ...plan, program: { ...baseProgram(), days: [] } })).toThrow();
    expect(() => get().saveCustomPlan({ ...plan, name: ' ' })).toThrow();
  });

  test('rename, pause and remove a program', () => {
    get().renameProgram(programId(), '  Strength  ');
    expect(program().name).toBe('Strength');
    expect(() => get().renameProgram(programId(), ' ')).toThrow();
    get().pauseProgram(programId(), true);
    expect(program().paused).toBe(true);
    get().removeProgram(programId());
    expect(get().programs).toEqual([]);
  });

  test('reset gives a fresh state and INITIAL is not mutated', () => {
    setLift('BARBELL_SQUAT', { weightKg: 123 });
    get().setInventory({ barKg: 15 });
    get().reset();
    expect(get().programs).toEqual([]);
    expect(get().inventory.barKg).toBe(20);
    expect(initialState().inventory.barKg).toBe(20);
    setProgram(baseProgram());
    expect(lifts().BARBELL_SQUAT.weightKg).toBe(20);
  });

  test('exportJson has the state but no actions', () => {
    const json = JSON.parse(get().exportJson()) as Record<string, unknown>;
    expect(json.version).toBe(3);
    expect(json.programs).toHaveLength(1);
    expect(json.hydrated).toBeUndefined();
    expect(json.storageError).toBeUndefined();
    expect(json.setUnit).toBeUndefined();
  });

  test('switching to lb snaps lifts of every program; toggling 20 times is lossless', () => {
    const original = { BARBELL_SQUAT: 100, DEADLIFT: 62.5, BENCH_PRESS: 20, MILITARY_PRESS: 37.5 };
    for (const [id, kg] of Object.entries(original)) setLift(id, { weightKg: kg, startKg: kg });
    const second = get().addProgram({ ...getPlan('stronglifts')!.program, name: 'B' });
    get().setLift(second, 'BARBELL_SQUAT', { weightKg: 62.5 });
    get().setUnit('lb');
    expect(lifts().BENCH_PRESS.weightKg).toBeCloseTo(toKg(45, 'lb'), 9);
    for (const p of get().programs)
      for (const l of Object.values(p.lifts))
        expect(isLoadable(l.weightKg, get().inventory, 'lb')).toBe(true);
    get().setUnit('kg');
    for (let i = 0; i < 19; i++) get().setUnit(i % 2 === 0 ? 'lb' : 'kg');
    expect(get().unit).toBe('lb');
    get().setUnit('kg');
    for (const [id, kg] of Object.entries(original)) {
      expect(lifts()[id].weightKg).toBe(kg);
      expect(lifts()[id].startKg).toBe(kg);
    }
    expect(get().programs[1].lifts.BARBELL_SQUAT.weightKg).toBe(62.5);
  });

  test('switching units mid-session re-snaps the draft weights too', () => {
    startSession();
    get().setUnit('lb');
    expect(get().draft?.results.BARBELL_SQUAT.weightKg).toBeCloseTo(toKg(45, 'lb'), 9);
  });
});

describe('several programs', () => {
  let a: string;
  let b: string;
  let c: string;
  beforeEach(() => {
    useStore.setState({ ...initialState(), hydrated: true });
    a = get().addProgram({ ...baseProgram(), name: 'A' });
    b = get().addProgram({ ...getPlan('stronglifts')!.program, name: 'B' });
    c = get().addProgram({ ...baseProgram(), name: 'C' });
  });
  const find = (id: string) => get().programs.find((p) => p.id === id)!;

  test('ids differ even when added in the same millisecond', () => {
    expect(new Set([a, b, c]).size).toBe(3);
  });

  test('positions and lifts are independent', () => {
    get().setLift(a, 'BARBELL_SQUAT', { weightKg: 100 });
    play(a, 8);
    play(b, 5);
    play(b, 5);
    expect(find(a).position).toBe(1);
    expect(find(b).position).toBe(2);
    expect(find(c).position).toBe(0);
    expect(find(a).lifts.BARBELL_SQUAT.weightKg).toBe(102.5);
    expect(find(b).lifts.BARBELL_SQUAT.weightKg).toBe(25);
    expect(find(c).lifts.BARBELL_SQUAT.weightKg).toBe(20);
    expect(get().sessions.map((s) => s.programId)).toEqual([a, b, b]);
  });

  test("starting B while A's workout is open throws; skipping B keeps A's workout", () => {
    const draft = get().startSession(a);
    expect(() => get().startSession(b)).toThrow('Another workout is in progress');
    get().skipSession(b);
    expect(get().draft).toBe(draft);
    expect(find(b).position).toBe(1);
    expect(find(a).position).toBe(0);
  });

  test('removing a program discards its workout only', () => {
    get().startSession(a);
    get().removeProgram(b);
    expect(get().draft?.programId).toBe(a);
    get().removeProgram(a);
    expect(get().draft).toBeNull();
    expect(get().programs.map((p) => p.id)).toEqual([c]);
  });

  test('undo only takes back a skip at the end of the history, of that program', () => {
    get().skipSession(b);
    get().skipSession(c);
    get().undoSkip(b);
    expect(find(b).position).toBe(1);
    get().undoSkip(c);
    expect(find(c).position).toBe(0);
    get().undoSkip(b);
    expect(find(b).position).toBe(0);
    expect(get().sessions).toEqual([]);
    expect(get().nextSession).toBe(2);
    play(a, 5);
    get().undoSkip(a);
    expect(get().sessions).toHaveLength(1);
  });

  test('ids never repeat: start A, skip B, skip C, finish A, undo C, then more', () => {
    const draft = get().startSession(a);
    get().skipSession(b);
    get().skipSession(c);
    draft.order.forEach((id) => {
      draft.results[id].sets.forEach((_s, i) => {
        get().logSet(id, i, 5);
      });
    });
    get().finishSession();
    expect(get().sessions.map((s) => s.n)).toEqual([0, 1, 2]);
    get().undoSkip(c);
    expect(get().sessions.map((s) => s.n)).toEqual([0, 1]);
    expect(find(c).position).toBe(0);
    play(c, 5);
    get().skipSession(a);
    play(b, 5);
    const ns = get().sessions.map((s: SessionLog) => s.n);
    expect(new Set(ns).size).toBe(ns.length);
    expect(ns).toEqual([...ns].sort((x, y) => x - y));
    expect(ns).toEqual([0, 1, 3, 4, 5]);
  });
});

describe('persistence and migration', () => {
  test('state persists to the file and rehydrates; nothing is written before the first read', async () => {
    setProgram(baseProgram());
    await storage.flush();
    expect(stored()).toBeNull();
    await initStore();
    setProgram(baseProgram());
    startSession();
    get().logSet('MILITARY_PRESS', 0, 5);
    await relaunch();
    expect(get().hydrated).toBe(true);
    expect(get().storageError).toBeNull();
    expect(program().template).toBe('base');
    expect(get().draft?.results.MILITARY_PRESS.sets[0].reps).toBe(5);
    expect(stored()?.version).toBe(4);
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test('the stored blob leaves out unedited built-ins; an edited one keeps its fields across two restarts', async () => {
    await initStore();
    get().upsertExercise({
      ...get().exercises.BENCH_PRESS,
      increment: { kg: 1.25, lb: 2.5 },
      equipment: ['barbell'],
    });
    get().upsertExercise({
      id: 'custom_curl',
      name: 'Curl',
      shortName: 'Curl',
      kind: 'dumbbell',
      increment: { kg: 1, lb: 2 },
      custom: true,
    });
    await storage.flush();
    expect(Object.keys(stored()?.state.exercises ?? {}).sort()).toEqual(['BENCH_PRESS', 'custom_curl']);
    expect(stored()?.state.exercises.BENCH_PRESS.goodForm).toBeUndefined();
    const shippedForm = get().exercises.BENCH_PRESS.goodForm;
    await relaunch();
    await relaunch();
    expect(get().exercises.BENCH_PRESS).toMatchObject({
      increment: { kg: 1.25, lb: 2.5 },
      equipment: ['barbell'],
      goodForm: shippedForm,
    });
    expect(get().exercises.custom_curl.name).toBe('Curl');
    expect(get().exercises.DEADLIFT).toBeDefined();
  });

  test('an unreadable file sets storageError and nothing is written over it', async () => {
    files.set(stateFile().uri, '{"state": {broken');
    await initStore();
    expect(get().hydrated).toBe(true);
    expect(get().storageError).toBeTruthy();
    get().reset();
    setProgram(baseProgram());
    await storage.flush();
    expect(files.get(stateFile().uri)).toBe('{"state": {broken');
    // Restoring a backup is the way out once the unreadable file is kept aside; if that copy fails, the
    // recovery screen stays and nothing is written.
    const copy = jest.spyOn(File.prototype, 'copy').mockRejectedValueOnce(new Error('disk full'));
    await get().importBackup({ ...initialState(), unit: 'kg', minimalist: true });
    await storage.flush();
    expect(get().storageError).toMatch(/disk full/);
    expect(files.get(stateFile().uri)).toBe('{"state": {broken');
    copy.mockRestore();
    await get().importBackup({ ...initialState(), unit: 'lb' });
    await storage.flush();
    expect(get().storageError).toBeNull();
    expect(stored()?.state.unit).toBe('lb');
    expect(files.get(stateFile('state.unreadable.json').uri)).toBe('{"state": {broken');
  });

  test('a 5,000-session history round-trips', async () => {
    await initStore();
    setProgram(baseProgram());
    const sessions: SessionLog[] = Array.from({ length: 5000 }, (_, n) => ({
      n,
      dayName: `Day ${(n % 3) + 1}`,
      startedAt: new Date(n * 86_400_000).toISOString(),
      finishedAt: new Date(n * 86_400_000 + 3_600_000).toISOString(),
      results: {
        BARBELL_SQUAT: {
          weightKg: 20 + (n % 200),
          sets: [
            { target: 5, reps: 5 },
            { target: null, reps: 7 },
          ],
        },
      },
      order: ['BARBELL_SQUAT'],
      programId: programId(),
      position: n,
    }));
    useStore.setState({ sessions, nextSession: 5000 });
    await relaunch();
    expect(get().sessions).toEqual(sessions);
    expect(get().nextSession).toBe(5000);
  });

  test('first launch with GSLP_STATE_18 migrates and leaves the legacy key alone', async () => {
    const raw = JSON.stringify(fixture);
    await AsyncStorage.setItem(LEGACY_KEY, raw);
    await initStore();
    expect(get().unit).toBe('lb');
    expect(get().needsWeightConfirm).toBe(true);
    expect(get().needsWeightConfirmSuspects).toEqual(['BENT_OVER_ROW']);
    expect(lifts().BENT_OVER_ROW.weightKg).toBe(20.41);
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
    expect(lifts().BENT_OVER_ROW.weightKg).toBeCloseTo(20.41, 2);
  });

  test('Reset does not bring v1 data back on the next launch and keeps the legacy key', async () => {
    const raw = JSON.stringify(fixture);
    await AsyncStorage.setItem(LEGACY_KEY, raw);
    await initStore();
    get().reset();
    await relaunch();
    expect(get().programs).toEqual([]);
    expect(get().needsWeightConfirm).toBe(false);
    expect(await AsyncStorage.getItem(LEGACY_KEY)).toBe(raw);
  });

  test('importLegacy (dev seed) re-imports on demand', async () => {
    await initStore();
    expect(await get().importLegacy()).toBe(false);
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify(fixture));
    expect(await get().importLegacy()).toBe(true);
    expect(get().sessions).toHaveLength(2);
    expect(get().programs).toHaveLength(1);
  });

  test('corrupt legacy data starts fresh and still hydrates', async () => {
    await AsyncStorage.setItem(LEGACY_KEY, '{oops');
    await initStore();
    expect(get().hydrated).toBe(true);
    expect(get().storageError).toBeNull();
    expect(get().programs).toEqual([]);
  });
});

test('an install with an older exercise catalog gets the new form tips and videos on launch', async () => {
  const stale = { ...initialState(), catalogVersion: 1 };
  stale.exercises.BENCH_PRESS = { ...stale.exercises.BENCH_PRESS, goodForm: ['old'], video: undefined };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ state: stale, version: 2 }));
  await initStore();
  expect(useStore.getState().exercises.BENCH_PRESS.goodForm).not.toEqual(['old']);
  expect(useStore.getState().exercises.BENCH_PRESS.video).toMatch(/youtube/);
  expect(useStore.getState().catalogVersion).toBe(CATALOG_VERSION);
});

test('undoSkip takes back only the latest skip; Undo never rewinds the session id', () => {
  useStore.setState({ ...initialState(), hydrated: true });
  setProgram(TEMPLATES.base);
  skipSession();
  skipSession();
  expect(useStore.getState().nextSession).toBe(2);
  undoSkip();
  expect(useStore.getState().nextSession).toBe(2);
  expect(program().position).toBe(1);
  expect(useStore.getState().sessions).toHaveLength(1);
  undoSkip();
  undoSkip();
  expect(useStore.getState().sessions).toHaveLength(0);
  expect(program().position).toBe(0);
  // A finished session is never undone.
  startSession();
  useStore.getState().finishSession();
  undoSkip();
  expect(useStore.getState().sessions).toHaveLength(1);
  expect(useStore.getState().sessions[0].n).toBe(2);
});

/** A lift state stored without `touchedAt` (as before it existed), so a break can ease it. */
function stale(key: string, patch: Partial<LiftState> = {}) {
  useStore.setState((s) => ({
    programs: s.programs.map((p, i) => {
      if (i !== 0) return p;
      const fresh: LiftState = { weightKg: 0, startKg: 0, fails: 0 };
      const { touchedAt: _t, ...rest } = { ...(p.lifts[key] ?? fresh), ...patch };
      return { ...p, lifts: { ...p.lifts, [key]: rest } };
    }),
  }));
}

describe('easing back after a break', () => {
  const DAY = 86_400_000;
  const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
  /** A finished log `days` ago with every listed exercise done for `reps`. */
  const past = (days: number, ids: string[], reps = 5, patch: Partial<SessionLog> = {}): SessionLog => ({
    n: 100 + days,
    dayName: 'Old',
    startedAt: ago(days),
    finishedAt: ago(days),
    results: Object.fromEntries(ids.map((id) => [id, { weightKg: 50, sets: [{ target: 5, reps }] }])),
    order: ids,
    ...patch,
  });
  const history = (...logs: SessionLog[]) => useStore.setState({ sessions: logs });
  const logAll = (id: string, reps: number) =>
    get().draft?.results[id].sets.forEach((_s, i) => {
      get().logSet(id, i, reps);
    });

  beforeEach(() => {
    setProgram(baseProgram());
    stale('BARBELL_SQUAT', { weightKg: 100 });
  });

  test('20 days off: the draft starts 10 % lighter, the stored lift is untouched, finish progresses from it', () => {
    history(past(20, ['BARBELL_SQUAT', 'MILITARY_PRESS']));
    const draft = startSession();
    expect(draft.results.BARBELL_SQUAT.weightKg).toBe(90);
    expect(draft.eased).toMatchObject({ gapDays: 20, lifts: { BARBELL_SQUAT: { weightKg: 90, fails: 0 } } });
    expect(lifts().BARBELL_SQUAT.weightKg).toBe(100);
    logAll('BARBELL_SQUAT', 5);
    get().finishSession();
    expect(lifts().BARBELL_SQUAT.weightKg).toBe(92.5);
    expect(lifts().BARBELL_SQUAT.touchedAt).toBe(get().sessions.find((l) => l.n === draft.n)?.finishedAt);
  });

  test('switched off, or trained recently in another program, nothing eases', () => {
    history(past(20, ['BARBELL_SQUAT']));
    get().setBreakDeload(false);
    expect(startSession().results.BARBELL_SQUAT.weightKg).toBe(100);
    get().discardDraft();
    get().setBreakDeload(true);
    history(past(20, ['BARBELL_SQUAT']), past(3, ['BARBELL_SQUAT'], 5, { programId: 'another' }));
    expect(startSession().eased).toBeUndefined();
  });

  test('a light day counts as training; a session with no reps does not', () => {
    history(past(20, ['BARBELL_SQUAT']), past(3, ['BARBELL_SQUAT'], 5, { intensity: 0.8 }));
    expect(startSession().results.BARBELL_SQUAT.weightKg).toBe(100);
    get().discardDraft();
    history(past(20, ['BARBELL_SQUAT']), past(3, ['BARBELL_SQUAT'], 0));
    expect(startSession().results.BARBELL_SQUAT.weightKg).toBe(90);
  });

  test('undoEase rebuilds the draft from the stored lifts, only before a set is logged', () => {
    history(past(30, ['BARBELL_SQUAT']));
    const draft = startSession();
    expect(draft.results.BARBELL_SQUAT.weightKg).toBe(80);
    get().undoEase();
    expect(get().draft).toMatchObject({ n: draft.n, startedAt: draft.startedAt });
    expect(get().draft?.eased).toBeUndefined();
    expect(get().draft?.results.BARBELL_SQUAT.weightKg).toBe(100);
    expect(get().nextSession).toBe(draft.n + 1);
    get().discardDraft();
    startSession();
    get().logSet('BARBELL_SQUAT', 0, 5);
    get().undoEase();
    expect(get().draft?.results.BARBELL_SQUAT.weightKg).toBe(80);
  });

  test('an eased session finished with no reps keeps the stored lift, so the next one eases once, not twice', () => {
    history(past(30, ['BARBELL_SQUAT']));
    expect(startSession().results.BARBELL_SQUAT.weightKg).toBe(80);
    get().finishSession();
    expect(lifts().BARBELL_SQUAT).toMatchObject({ weightKg: 100, fails: 0 });
    expect(lifts().BARBELL_SQUAT.touchedAt).toBeUndefined();
    setPosition(0);
    expect(startSession().results.BARBELL_SQUAT.weightKg).toBe(80);
  });

  test('a light day: eased state kept only when trained', () => {
    setProgram({
      ...baseProgram(),
      template: 'custom',
      days: [{ name: 'Light', intensity: 0.8, slots: [{ exercise: 'BARBELL_SQUAT', scheme: '2x5+' }] }],
    });
    stale('BARBELL_SQUAT', { weightKg: 100 });
    history(past(30, ['BARBELL_SQUAT']));
    startSession();
    get().finishSession();
    expect(lifts().BARBELL_SQUAT.weightKg).toBe(100);
    startSession();
    logAll('BARBELL_SQUAT', 5);
    get().finishSession();
    expect(lifts().BARBELL_SQUAT.weightKg).toBe(80);
  });

  test('a GZCLP stage does not advance on an eased session with no reps', () => {
    setProgram({
      ...baseProgram(),
      template: 'custom',
      rules: { ...baseProgram().rules, progression: 'stages' },
      days: [{ name: 'A', slots: [{ exercise: 'BARBELL_SQUAT', scheme: '5x3+', stages: ['5x3+', '6x2+'] }] }],
    });
    stale('BARBELL_SQUAT', { weightKg: 100, stage: 0 });
    history(past(30, ['BARBELL_SQUAT']));
    startSession();
    get().finishSession();
    expect(lifts().BARBELL_SQUAT).toMatchObject({ weightKg: 100, stage: 0 });
  });

  test('a 5/3/1 training max eased after a break stays lowered after a week-1 finish, not after an empty one', () => {
    get().reset();
    setProgram(getPlan('531-beginners')!.program);
    stale('BARBELL_SQUAT', { weightKg: 100 });
    history(past(30, ['BARBELL_SQUAT']));
    startSession();
    get().finishSession();
    expect(lifts().BARBELL_SQUAT.weightKg).toBe(100);
    setPosition(0);
    const draft = startSession();
    expect(draft.results.BARBELL_SQUAT.tmKg).toBe(80);
    logAll('BARBELL_SQUAT', 5);
    get().finishSession();
    expect(lifts().BARBELL_SQUAT).toMatchObject({ weightKg: 80, fails: 0 });
  });

  test('bodyweight added load eases, and an empty finish keeps it', () => {
    setProgram(PLUGINS.chins.apply(TEMPLATES.base));
    stale('CHINUPS', { weightKg: 10 });
    history(past(30, ['CHINUPS']));
    expect(startSession().results.CHINUPS.weightKg).toBe(7.5);
    get().finishSession();
    expect(lifts().CHINUPS.weightKg).toBe(10);
  });

  test('a lift set after the break (a new program, a retest) is not eased', () => {
    get().reset();
    useStore.setState({ sessions: [past(60, ['BARBELL_SQUAT'], 5, { programId: 'old' })] });
    setProgram(getPlan('531-beginners')!.program);
    setLift('BARBELL_SQUAT', { weightKg: 100 });
    expect(startSession().results.BARBELL_SQUAT.tmKg).toBe(100);
    get().discardDraft();
    stale('BARBELL_SQUAT');
    expect(startSession().results.BARBELL_SQUAT.tmKg).toBe(70);
  });

  test('editing a lift during an eased workout drops its ease: the edit wins at finish', () => {
    history(past(30, ['BARBELL_SQUAT']));
    startSession();
    setLift('BARBELL_SQUAT', { weightKg: 110 });
    expect(get().draft?.eased?.lifts.BARBELL_SQUAT).toBeUndefined();
    expect(get().draft?.results.BARBELL_SQUAT.weightKg).toBe(110);
    get().finishSession();
    expect(lifts().BARBELL_SQUAT.weightKg).toBe(110);
  });

  test('a stale lift with only a miss to reset makes no ease', () => {
    setProgram(PLUGINS.chins.apply(TEMPLATES.base));
    setLift('BARBELL_SQUAT', { weightKg: 100 });
    stale('CHINUPS', { weightKg: 0, fails: 1 });
    history(past(30, ['CHINUPS', 'BARBELL_SQUAT']));
    expect(startSession().eased).toBeUndefined();
  });

  test('switching to lb snaps the eased states; finishing stores loadable lb weights', () => {
    history(past(30, ['BARBELL_SQUAT']));
    startSession();
    get().setUnit('lb');
    const eased = get().draft?.eased?.lifts.BARBELL_SQUAT;
    expect(isLoadable(eased?.weightKg ?? 0, get().inventory, 'lb')).toBe(true);
    expect(isLoadable(eased?.startKg ?? 0, get().inventory, 'lb')).toBe(true);
    logAll('BARBELL_SQUAT', 5);
    get().finishSession();
    expect(isLoadable(lifts().BARBELL_SQUAT.weightKg, get().inventory, 'lb')).toBe(true);
    expect(isLoadable(lifts().BARBELL_SQUAT.startKg, get().inventory, 'lb')).toBe(true);
  });

  test('new and edited lift states record when they were set', () => {
    expect(lifts().MILITARY_PRESS.touchedAt).toEqual(expect.any(String));
    useStore.setState((s) => ({
      programs: s.programs.map((p) => ({
        ...p,
        lifts: { ...p.lifts, DEADLIFT: { weightKg: 60, startKg: 20, fails: 0 } },
      })),
    }));
    get().setLiftStep(programId(), 'DEADLIFT', 0);
    expect(lifts().DEADLIFT.touchedAt).toEqual(expect.any(String));
  });
});

describe('ladder lifts in the store', () => {
  const BANDS = [
    { id: 'heavy', label: 'Heavy band' },
    { id: 'light', label: 'Light band' },
  ];
  const ladderProgram = (): Program => ({
    template: 'custom',
    sessionsPerWeek: 3,
    rules: { doubleAt: 10, deloadPct: 0.1, failsBeforeDeload: 1, warmups: true },
    days: [{ name: 'A', slots: [{ exercise: 'CAL_SCAPULAR_PULL', scheme: '3x5-8', ladder: 'rr_pullup' }] }],
  });

  beforeEach(() => {
    setProgram(ladderProgram());
    get().setBands(BANDS);
  });

  test('the ladder id is an unweighted lift key', () => {
    expect(lifts().rr_pullup).toEqual({ weightKg: 0, startKg: 0, fails: 0, touchedAt: expect.any(String) });
    setLift('rr_pullup', { weightKg: 0, step: 2 });
    expect(lifts().rr_pullup.step).toBe(2);
  });

  test('results record step, scheme, timed and band; finishing climbs through the bands', () => {
    setLift('rr_pullup', { step: 1 });
    const hang = startSession().results.CAL_ARCH_HANG;
    expect(hang).toMatchObject({ lift: 'rr_pullup', step: 1, scheme: '3x10-30s', timed: true });
    get().discardDraft();
    setLift('rr_pullup', { step: 3, reps: 8, bandId: 'heavy' });
    const draft = startSession();
    const banded = draft.results.CAL_PULLUP_BAND_ASSISTED;
    expect(banded).toMatchObject({ step: 3, scheme: '3x5-8', band: { id: 'heavy', label: 'Heavy band' } });
    expect(banded.timed).toBeUndefined();
    banded.sets.forEach((_s, i) => {
      get().logSet('CAL_PULLUP_BAND_ASSISTED', i, 8);
    });
    get().finishSession();
    expect(lifts().rr_pullup).toMatchObject({ step: 3, bandId: 'light' });
  });

  test('after 30 days off a ladder goes one step down for the session, onto the heaviest band', () => {
    stale('rr_pullup', { step: 4, reps: 7 });
    useStore.setState({
      sessions: [
        {
          n: 50,
          dayName: 'A',
          startedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
          results: { CAL_PULLUP: { weightKg: 0, sets: [{ target: 7, reps: 7 }], lift: 'rr_pullup' } },
          order: ['CAL_PULLUP'],
        },
      ],
    });
    const draft = startSession();
    expect(draft.order).toEqual(['CAL_PULLUP_BAND_ASSISTED']);
    expect(draft.results.CAL_PULLUP_BAND_ASSISTED).toMatchObject({ step: 3, band: { id: 'heavy' } });
    expect(draft.results.CAL_PULLUP_BAND_ASSISTED.sets[0].target).toBe(5);
    expect(lifts().rr_pullup).toMatchObject({ step: 4, reps: 7 });
  });
});

test('an EZ-bar lift starts at its own bar', () => {
  const p = baseProgram();
  p.days[0].slots.push({ exercise: 'EZ_BAR_CURL', scheme: '3x8' });
  setProgram(p);
  expect(lifts().EZ_BAR_CURL.weightKg).toBe(10);
});

test('confirmed weights record when they were set', () => {
  setProgram(baseProgram());
  stale('BARBELL_SQUAT');
  get().confirmWeights({ BARBELL_SQUAT: 80 });
  expect(lifts().BARBELL_SQUAT).toMatchObject({ weightKg: 80, touchedAt: expect.any(String) });
});

test('switching units snaps a ladder lift’s added load to single plates', () => {
  setProgram({
    template: 'custom',
    sessionsPerWeek: 3,
    rules: { doubleAt: 10, deloadPct: 0.1, failsBeforeDeload: 1, warmups: true },
    days: [{ name: 'A', slots: [{ exercise: 'CAL_SCAPULAR_PULL', scheme: '3x5-8', ladder: 'rr_pullup' }] }],
  });
  setLift('rr_pullup', { weightKg: 10, step: 5 });
  get().setUnit('lb');
  expect(toKg(22.5, 'lb')).toBeCloseTo(lifts().rr_pullup.weightKg, 9);
});
