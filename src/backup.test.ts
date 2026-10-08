import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseBackup } from './backup';
import { CATALOG_VERSION } from './catalog';
import fixture from './dev/v1-imperial.json';
import type { Program } from './domain';
import { TEMPLATES } from './domain';
import { initialState, migratePersisted, STORAGE_KEY, useStore } from './store';

const get = () => useStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useStore.setState({ ...initialState(), hydrated: false });
});

function seeded() {
  get().setProgram(JSON.parse(JSON.stringify(TEMPLATES.base)) as Program);
  const d = get().startSession(0);
  for (const id of d.order) d.results[id].sets.forEach((_s, i) => get().logSet(id, i, 6));
  get().finishSession();
}

describe('backup import', () => {
  test('export → parse round-trips and summarises', () => {
    seeded();
    const r = parseBackup(get().exportJson());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.summary.sessions).toBe(1);
      expect(r.state.sessions).toHaveLength(1);
      expect(r.state.draft).toBeNull();
    }
  });

  test('importBackup replaces the state and never touches the legacy key', async () => {
    seeded();
    const json = get().exportJson();
    await AsyncStorage.setItem('GSLP_STATE_18', JSON.stringify(fixture));
    get().reset();
    expect(get().sessions).toHaveLength(0);
    const r = parseBackup(json);
    if (!r.ok) throw new Error(r.error);
    get().importBackup(r.state);
    expect(get().sessions).toHaveLength(1);
    expect(get().legacyChecked).toBe(true);
    expect(await AsyncStorage.getItem('GSLP_STATE_18')).toBe(JSON.stringify(fixture));
  });

  test.each([
    ['not json', '{nope'],
    ['v1 data', JSON.stringify(fixture)],
    ['array', '[]'],
    [
      'missing sessions',
      JSON.stringify({ version: 2, exercises: {}, lifts: {}, unit: 'kg', inventory: {}, nextSession: 0 }),
    ],
  ])('rejects %s', (_n, raw) => {
    expect(parseBackup(raw).ok).toBe(false);
  });

  test('rejects damaged sessions, bad weights and invalid programs', () => {
    seeded();
    const base = JSON.parse(get().exportJson());
    const bad = (mut: (s: any) => void) => {
      const c = JSON.parse(JSON.stringify(base));
      mut(c);
      return parseBackup(JSON.stringify(c)).ok;
    };
    expect(
      bad((s) => {
        s.sessions[0].results.BARBELL_SQUAT.sets[0].reps = 'x';
      }),
    ).toBe(false);
    expect(
      bad((s) => {
        s.lifts.BARBELL_SQUAT.weightKg = 0;
      }),
    ).toBe(false);
    expect(
      bad((s) => {
        s.program.days[0].slots[0].scheme = '9y9';
      }),
    ).toBe(false);
    expect(bad(() => {})).toBe(true);
  });

  test('backups from earlier builds get defaults for new fields', () => {
    const old = JSON.parse(JSON.stringify(initialState()));
    delete old.appearance;
    delete old.hapticsEnabled;
    const r = parseBackup(JSON.stringify(old));
    expect(r.ok && r.state.appearance).toBe('system');
  });
});

describe('persist migration', () => {
  test('a v2 snapshot without newer fields hydrates with defaults', async () => {
    const stale: Record<string, unknown> = { ...initialState(), unit: 'lb', minimalist: true };
    delete stale.appearance;
    delete stale.catalogVersion;
    delete stale.hapticsEnabled;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ state: stale, version: 2 }));
    await useStore.persist.rehydrate();
    expect(get().unit).toBe('lb');
    expect(get().minimalist).toBe(true);
    expect(get().appearance).toBe('system');
    expect(get().hapticsEnabled).toBe(true);
    expect(CATALOG_VERSION).toBeGreaterThan(0);
  });

  test('garbage input migrates to a usable state', () => {
    expect(migratePersisted(null, 1).unit).toBe('kg');
    expect(
      migratePersisted({ unit: 'lb', inventory: { barKg: 15 } }, 2).inventory.platesKg.length,
    ).toBeGreaterThan(0);
  });
});

describe('soft delete', () => {
  test('a custom exercise used in history is archived, not removed', () => {
    get().upsertExercise({
      id: 'custom_curl',
      name: 'Curl',
      shortName: 'Curl',
      kind: 'dumbbell',
      increment: { kg: 1, lb: 2 },
      step: { kg: 1, lb: 2 },
      custom: true,
    });
    const p = JSON.parse(JSON.stringify(TEMPLATES.base)) as Program;
    p.days[0].slots.push({ exercise: 'custom_curl', scheme: '2x8-12' });
    get().setProgram(p);
    const d = get().startSession(0);
    for (const id of d.order) d.results[id].sets.forEach((_s, i) => get().logSet(id, i, 8));
    get().finishSession();
    get().setProgram(JSON.parse(JSON.stringify(TEMPLATES.base)) as Program);
    expect(get().deleteExercise('custom_curl')).toEqual([]);
    expect(get().exercises.custom_curl.archived).toBe(true);
    expect(get().lifts.custom_curl).toBeUndefined();
  });
});
