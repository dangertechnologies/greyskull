import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseBackup } from './backup';
import { builtInExercises, refreshCatalog } from './catalog';
import type { AppState, Exercise } from './domain';
import { exerciseFromForm, formFrom } from './exerciseEdit';
import { stateFile } from './storage';
import { initialState, initStore, restoreExercises, storage, useStore } from './store';

const get = () => useStore.getState();
const shipped = builtInExercises();
const files = (jest.requireMock('expo-file-system') as { __files: Map<string, string> }).__files;
const stored = () =>
  JSON.parse(files.get(stateFile().uri) ?? 'null') as { state: AppState; version: number } | null;

beforeEach(async () => {
  files.clear();
  await AsyncStorage.clear();
  useStore.setState({ ...initialState(), hydrated: false, storageError: null });
});

async function relaunch() {
  await storage.flush();
  useStore.setState({ ...initialState(), hydrated: false, storageError: null });
  await initStore();
}

/** Edits a built-in the way the editor does, with `change` applied to its form. */
const edit = (id: string, change: Partial<ReturnType<typeof formFrom>>) =>
  get().upsertExercise(
    exerciseFromForm({ ...formFrom(get().exercises[id]), ...change }, get().exercises[id], () => 'x'),
  );

const importedBackup = async () => {
  const r = parseBackup(get().exportJson());
  if (!r.ok) throw new Error(r.error);
  files.clear();
  useStore.setState({ ...initialState(), hydrated: false, storageError: null });
  await initStore();
  await get().importBackup(r.state);
  await relaunch();
};

describe('turning a user field off on a built-in sticks', () => {
  const cases: [string, string, Partial<ReturnType<typeof formFrom>>, keyof Exercise][] = [
    ['CAL_PLANK', 'untick "Held for time"', { timed: false }, 'timed'],
    ['EZ_BAR_CURL', 'turn off "Different bar"', { ownBar: false }, 'barKg'],
    ['EZ_BAR_CURL', 'clear the abbreviation', { abbr: '' }, 'abbr'],
  ];
  test.each(cases)(
    '%s: %s survives two cold restarts and a backup round trip',
    async (id, _what, change, field) => {
      await initStore();
      expect(shipped[id][field]).toBeDefined();
      edit(id, change);
      expect(get().exercises[id][field]).toBeUndefined();
      await storage.flush();
      expect(stored()?.state.exercises[id]).toBeDefined();
      await relaunch();
      await relaunch();
      expect(get().exercises[id][field]).toBeUndefined();
      expect(get().exercises[id].name).toBe(shipped[id].name);
      await importedBackup();
      expect(get().exercises[id][field]).toBeUndefined();
    },
  );

  test('a stored null removes the field; a missing field takes the shipped value', () => {
    const out = restoreExercises({
      CAL_PLANK: { id: 'CAL_PLANK', timed: null },
      EZ_BAR_CURL: { id: 'EZ_BAR_CURL', name: 'Mine' },
    } as unknown as Record<string, Exercise>);
    expect('timed' in out.CAL_PLANK).toBe(false);
    expect(out.EZ_BAR_CURL.barKg).toEqual(shipped.EZ_BAR_CURL.barKg);
    expect(out.EZ_BAR_CURL.name).toBe('Mine');
  });

  test('a backup refuses null for a field that always has a value', () => {
    const data = JSON.parse(get().exportJson());
    data.exercises.CAL_PLANK = { id: 'CAL_PLANK', name: null };
    expect(parseBackup(JSON.stringify(data)).ok).toBe(false);
    data.exercises.CAL_PLANK = { id: 'CAL_PLANK', name: 'Plank', timed: null, barKg: null };
    expect(parseBackup(JSON.stringify(data)).ok).toBe(true);
  });
});

describe('a refresh from the bundle keeps what the user changed', () => {
  test('refreshCatalog keeps edited equipment, muscles, timed and abbreviation', () => {
    const next = refreshCatalog({
      CAL_PUSHUP: { ...shipped.CAL_PUSHUP, equipment: ['rings'], muscles: ['lats'], abbr: 'ZZ', timed: true },
    });
    expect(next.CAL_PUSHUP).toMatchObject({
      equipment: ['rings'],
      muscles: ['lats'],
      abbr: 'ZZ',
      timed: true,
    });
    expect(next.CAL_PUSHUP.pictogram).toBe(shipped.CAL_PUSHUP.pictogram);
  });
});

describe('a zero increment on a bodyweight built-in', () => {
  const zero = { kg: 0, lb: 0 };
  test('whole old entries stored it before bodyweight could carry load: that is not an edit', () => {
    const old = { ...shipped.CHINUPS, increment: zero };
    expect(restoreExercises({ CHINUPS: old }).CHINUPS.increment).toEqual(shipped.CHINUPS.increment);
  });
  test('a zero the user set is kept across restarts', async () => {
    await initStore();
    edit('CHINUPS', { incKg: 0, incLb: 0 });
    await relaunch();
    expect(get().exercises.CHINUPS.increment).toEqual(zero);
  });
});
