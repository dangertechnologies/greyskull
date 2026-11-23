import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseBackup } from './backup';
import { builtInExercises } from './catalog';
import { getPlan } from './config/plans';
import legacyV1 from './dev/v1-imperial.json';
import type { AppState, LiftState, Program, SessionLog } from './domain';
import { sessionFor } from './domain';
import { logPosition } from './format';
import { stateFile } from './storage';
import {
  initialState,
  initStore,
  LEGACY_KEY,
  migratePersisted,
  restoreExercises,
  STORAGE_KEY,
  storage,
  useStore,
} from './store';

/** A store snapshot written by the version that ran one program (store version 3). */
interface V3State extends Omit<AppState, 'version' | 'programs' | 'customPlans'> {
  version: 2;
  program: Program | null;
  lifts: Record<string, LiftState>;
}
interface Fixture {
  persisted: { state: V3State; version: 3 };
  /** What the old code resolved for the next session, and the draft it would have started. */
  expected: {
    dayName: string;
    slots: { exercise: string; lift: string; scheme: string; week: number | null }[];
    results: SessionLog['results'];
  } | null;
}

const NAMES = [
  ...['base', 'phrak', 'stronglifts', 'starting-strength', 'allpro', 'lyle-gbr', 'full-body-hypertrophy'].map(
    (id) => `plan-${id}`,
  ),
  'plan-shoulder-mobilex',
  'plan-gzclp',
  'plan-531-beginners',
  'switched-plan',
  '531-mid-week2',
  'gzclp-t1-stage2',
  'open-draft',
  'archived-custom',
  'no-program',
];

const files = (jest.requireMock('expo-file-system') as { __files: Map<string, string> }).__files;

/** The fixtures leave out unedited built-in exercises; a real snapshot had them all. */
function load(name: string): Fixture {
  const fixture = JSON.parse(JSON.stringify(require(`./__fixtures__/${name}.json`))) as Fixture;
  fixture.persisted.state.exercises = { ...builtInExercises(), ...fixture.persisted.state.exercises };
  return fixture;
}

const get = () => useStore.getState();

beforeEach(async () => {
  files.clear();
  await AsyncStorage.clear();
  useStore.setState({ ...initialState(), hydrated: false, storageError: null });
});

describe.each(NAMES)('store version 3 snapshot %s', (name) => {
  test('moves the program and its lifts, keeps every log, and resolves the same next session', () => {
    const { persisted, expected } = load(name);
    const old = persisted.state;
    const state = migratePersisted(JSON.parse(JSON.stringify(old)), 3);

    expect(state.version).toBe(3);
    expect(state.sessions).toEqual(old.sessions);
    expect(state.sessions.every((log) => log.programId === undefined)).toBe(true);
    expect(state).not.toHaveProperty('program');
    expect(state).not.toHaveProperty('lifts');
    expect(state.customPlans).toEqual([]);
    expect(state.breakDeload).toBe(true);
    expect(state.healthSync).toBe(false);
    expect(state.inventory.kettlebellsKg).toEqual([8, 12, 16, 20, 24, 28, 32]);
    expect(state.exercises.custom_front_squat).toEqual(old.exercises.custom_front_squat);

    if (!old.program || !expected) {
      expect(state.programs).toEqual([]);
      expect(state.draft).toBeNull();
      return;
    }
    expect(state.programs).toHaveLength(1);
    const [program] = state.programs;
    expect(program.lifts).toEqual(old.lifts);
    expect(program.position).toBe(old.nextSession - (old.program.startN ?? 0));
    expect(program.name).toBe(getPlan(old.program.template)?.name ?? 'Custom program');
    expect(program.days).toEqual(old.program.days);

    const next = sessionFor(program);
    expect(next.dayName).toBe(expected.dayName);
    expect(
      next.slots.map((s) => ({ exercise: s.exercise, lift: s.lift, scheme: s.scheme, week: s.week ?? null })),
    ).toEqual(expected.slots);

    useStore.setState({ ...state, hydrated: true });
    if (old.draft) {
      expect(state.draft).toMatchObject({ ...old.draft, programId: program.id, programName: program.name });
      expect(state.draft?.slots?.map((s) => s.exercise)).toEqual(old.draft.order);
      expect(state.nextSession).toBe(old.draft.n + 1);
      expect(get().startSession(program.id)).toBe(get().draft);
      expect(get().draft?.results).toEqual(expected.results);
    } else {
      expect(state.nextSession).toBe(old.nextSession);
      expect(get().startSession(program.id).results).toEqual(expected.results);
    }
  });
});

test('launch with store version 3 data: copied to the file, kept as state.v3.json, legacy key untouched', async () => {
  const { persisted } = load('open-draft');
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify(legacyV1));
  await initStore();
  expect(get().storageError).toBeNull();
  expect(get().programs).toHaveLength(1);
  expect(get().sessions).toEqual(persisted.state.sessions);
  expect(get().draft?.programId).toBe(get().programs[0].id);
  expect(files.get(stateFile('state.v3.json').uri)).toBe(JSON.stringify(persisted));
  expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(persisted));
  expect(await AsyncStorage.getItem(LEGACY_KEY)).toBe(JSON.stringify(legacyV1));
  await storage.flush();
  const written = JSON.parse(files.get(stateFile().uri) ?? '{}') as { version: number; state: AppState };
  expect(written.version).toBe(4);
  expect(written.state.programs[0].lifts).toEqual(persisted.state.lifts);
});

test('a backup from the one-program version imports into programs', () => {
  const { persisted } = load('plan-gzclp');
  const result = parseBackup(JSON.stringify(persisted.state));
  if (!result.ok) throw new Error(result.error);
  expect(result.state.programs[0].lifts).toEqual(persisted.state.lifts);
  expect(result.state.programs[0].template).toBe('gzclp');
  expect(result.state.sessions).toEqual(persisted.state.sessions);
  expect(result.summary.planName).toBe('gzclp');
});

test('the first version (GSLP_STATE_18) imports into one program', async () => {
  await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify(legacyV1));
  await initStore();
  expect(get().programs).toHaveLength(1);
  expect(get().programs[0]).toMatchObject({ template: 'base', position: 2 });
  expect(get().programs[0].lifts.BENT_OVER_ROW.weightKg).toBe(20.41);
  expect(get().sessions).toHaveLength(2);
  expect(get().nextSession).toBe(2);
});

test('history from before the move counts for the moved program from its start on', () => {
  const { persisted } = load('switched-plan');
  const state = migratePersisted(persisted.state, 3);
  const [program] = state.programs;
  expect(program.startN).toBe(4);
  expect(state.sessions.map((log) => logPosition(log, program))).toEqual([null, null, null, null, 0, 1, 2]);
  const added = { id: 'new', startN: undefined };
  expect(state.sessions.map((log) => logPosition(log, added)).every((p) => p === null)).toBe(true);
  const own: SessionLog = { ...state.sessions[0], programId: program.id, position: 3 };
  expect(logPosition(own, program)).toBe(3);
  expect(logPosition({ ...own, programId: 'other' }, program)).toBeNull();
});

describe('a load that fails never leads to a write', () => {
  const noDays = JSON.stringify({
    state: {
      ...load('plan-base').persisted.state,
      program: { template: 'base', sessionsPerWeek: 3, rules: {} },
    },
    version: 3,
  });
  const nullExercise = JSON.stringify({
    state: { ...initialState(), exercises: { BENCH_PRESS: null } },
    version: 4,
  });
  test.each([
    ['the migration fails (a program without days)', noDays],
    ['the merge fails (an exercise that is null)', nullExercise],
  ])('%s: the file stays byte for byte and the error is shown', async (_name, raw) => {
    jest.useFakeTimers();
    try {
      files.set(stateFile().uri, raw);
      await initStore();
      expect(get().storageError).toBeTruthy();
      expect(get().hydrated).toBe(true);
      useStore.setState({ unit: 'lb' });
      await jest.advanceTimersByTimeAsync(1000);
      await storage.flush();
      expect(files.get(stateFile().uri)).toBe(raw);
    } finally {
      jest.useRealTimers();
    }
  });

  test('an unreadable first-version entry is tried again on the next launch', async () => {
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify(legacyV1));
    // The first launch reads the store entry (empty), then the first version's entry, which fails.
    // (Queued once-only results on the mock itself: restoring a spy on it would drop its implementation.)
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('busy'));
    await initStore();
    expect(get().storageError).toBeNull();
    expect(get().legacyChecked).toBe(false);
    expect(get().programs).toEqual([]);
    await storage.flush();
    useStore.setState({ ...initialState(), hydrated: false });
    await initStore();
    expect(get().storageError).toBeNull();
    expect(get().programs).toHaveLength(1);
    expect(get().legacyChecked).toBe(true);
  });
});

test('built-in exercises from a one-program snapshot take the shipped content (abbr, bodyweight increment)', () => {
  const { persisted } = load('plan-base');
  const old = persisted.state;
  old.exercises.BENCH_PRESS = { ...old.exercises.BENCH_PRESS, abbr: 'OLD', increment: { kg: 1, lb: 2 } };
  old.exercises.CHINUPS = { ...old.exercises.CHINUPS, increment: { kg: 0, lb: 0 } };
  useStore.setState({ ...migratePersisted(JSON.parse(JSON.stringify(old)), 3), hydrated: true });
  const restored = restoreExercises(migratePersisted(JSON.parse(JSON.stringify(old)), 3).exercises);
  expect(restored.BENCH_PRESS.abbr).toBe(builtInExercises().BENCH_PRESS.abbr);
  // The user's own increment stays.
  expect(restored.BENCH_PRESS.increment).toEqual({ kg: 1, lb: 2 });
  expect(restored.CHINUPS.increment).toEqual(builtInExercises().CHINUPS.increment);
});
