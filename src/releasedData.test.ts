import AsyncStorage from '@react-native-async-storage/async-storage';
import base from './__fixtures__/plan-base.json';
import { parseBackup } from './backup';
import { builtInExercises } from './catalog';
import { stateFile } from './storage';
import { initialState, initStore, migratePersisted, storage, useStore } from './store';

/**
 * Data the released app (store version 3) let the user save, past the limits this version's editors have, must
 * load on every path: the saved file, the store upgrade and a restore of the user's own backup. The released
 * editors had no limit on day names, the number of days, custom exercise names, ids, form lines, descriptions or
 * increments, and took any link text.
 */

// biome-ignore lint/suspicious/noExplicitAny: tests build arbitrary JSON
type Doc = any;
const get = () => useStore.getState();
const files = (jest.requireMock('expo-file-system') as { __files: Map<string, string> }).__files;

const LONG_ID = `custom_${'a'.repeat(150)}`;
const releasedCustom = {
  id: LONG_ID,
  name: 'A'.repeat(150),
  shortName: 'A',
  kind: 'barbell',
  increment: { kg: 150, lb: 300 },
  description: 'd'.repeat(3000),
  goodForm: Array.from({ length: 25 }, (_, i) => `${i} ${'g'.repeat(400)}`),
  badForm: ['b'],
  url: 'youtube.com/watch?v=1',
  background: 'gym',
  icon: 'squat',
  custom: true,
};

/** The released app's one-program state, edited the way its editors allowed. */
function released(): Doc {
  const state: Doc = JSON.parse(JSON.stringify(base.persisted.state));
  state.exercises = { ...builtInExercises(), [LONG_ID]: releasedCustom };
  const days = state.program.days;
  days[0].name = '';
  days[1].name = 'n'.repeat(150);
  days[2].slots.push({ exercise: LONG_ID, scheme: '3x5' });
  while (days.length < 16) days.push({ ...days[days.length % 3], name: `Extra ${days.length}` });
  return state;
}

async function loadFile(state: Doc, version: number) {
  files.set(stateFile().uri, JSON.stringify({ state, version }));
  useStore.setState({ ...initialState(), hydrated: false, storageError: null });
  await initStore();
}

beforeEach(async () => {
  files.clear();
  await AsyncStorage.clear();
});

test('the released app’s data loads from the file with every log and lift kept', async () => {
  const state = released();
  await loadFile(state, 3);
  expect(get().storageError).toBeNull();
  const program = get().programs[0];
  expect(program.days).toHaveLength(16);
  expect(program.days[0].name).toBe('Day 1');
  expect(program.days[1].name).toBe('n'.repeat(150));
  expect(program.lifts).toEqual(state.lifts);
  expect(get().sessions).toHaveLength(state.sessions.length);
  expect(get().exercises[LONG_ID]).toMatchObject({
    name: 'A'.repeat(150),
    increment: { kg: 150, lb: 300 },
    goodForm: releasedCustom.goodForm,
    url: 'youtube.com/watch?v=1',
    background: 'gym',
    icon: 'squat',
  });
  // The repaired data is what is saved next; the original stays in the old-version copy.
  await storage.flush();
  expect(files.get(stateFile('state.v3.json').uri)).toContain('"name":""');
});

test('the released app’s data upgrades and its backup restores', () => {
  expect(migratePersisted(released(), 3).programs[0].days).toHaveLength(16);
  const r = parseBackup(JSON.stringify(released()));
  if (!r.ok) throw new Error(r.error);
  expect(r.state.programs[0].days[0].name).toBe('Day 1');
  expect(r.state.exercises[LONG_ID].name).toBe('A'.repeat(150));
  expect(r.state.sessions).toHaveLength(base.persisted.state.sessions.length);
});

test('a program renamed to 101 letters before names were capped still loads and restores', async () => {
  await loadFile(released(), 3);
  useStore.setState({
    programs: get().programs.map((p) => ({ ...p, name: 'x'.repeat(101) })),
  });
  const exported = get().exportJson();
  await storage.flush();
  await loadFile(JSON.parse(exported), 4);
  expect(get().storageError).toBeNull();
  expect(get().programs[0].name).toBe('x'.repeat(101));
  expect(parseBackup(exported).ok).toBe(true);
});

test('sizes that would stall the app are still refused, and the file is left as it was', async () => {
  const state = released();
  state.program.days[0].slots[0].scheme = '1000x5';
  const raw = JSON.stringify({ state, version: 3 });
  files.set(stateFile().uri, raw);
  useStore.setState({ ...initialState(), hydrated: false, storageError: null });
  await initStore();
  expect(get().storageError).toMatch(/damaged/);
  await storage.flush();
  expect(files.get(stateFile().uri)).toBe(raw);
});
