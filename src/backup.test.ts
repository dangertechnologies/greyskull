import AsyncStorage from '@react-native-async-storage/async-storage';
import { lifts, setLift, setProgram, startSession } from './__fixtures__/oneProgram';
import { parseBackup } from './backup';
import { CATALOG_VERSION } from './catalog';
import fixture from './dev/v1-imperial.json';
import type { Program } from './domain';
import { TEMPLATES } from './domain';
import { stateFile } from './storage';
import { initialState, initStore, migratePersisted, STORAGE_KEY, storage, useStore } from './store';

const get = () => useStore.getState();

const files = (jest.requireMock('expo-file-system') as { __files: Map<string, string> }).__files;

beforeEach(async () => {
  files.clear();
  await AsyncStorage.clear();
  useStore.setState({ ...initialState(), hydrated: false });
});

function seeded() {
  setProgram(JSON.parse(JSON.stringify(TEMPLATES.base)) as Program);
  const d = startSession();
  for (const id of d.order)
    d.results[id].sets.forEach((_s, i) => {
      get().logSet(id, i, 6);
    });
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
    await get().reset();
    expect(get().sessions).toHaveLength(0);
    const r = parseBackup(json);
    if (!r.ok) throw new Error(r.error);
    await get().importBackup(r.state);
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
    // biome-ignore lint/suspicious/noExplicitAny: test mutates arbitrary JSON
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
        s.programs[0].lifts.BARBELL_SQUAT.weightKg = -1;
      }),
    ).toBe(false);
    expect(
      bad((s) => {
        s.programs[0].days[0].slots[0].scheme = '9y9';
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

// biome-ignore lint/suspicious/noExplicitAny: tests mutate arbitrary JSON
type Doc = any;

describe('hostile backups are refused where the app would crash on them', () => {
  const withEdit = (mut: (s: Doc) => void) => {
    seeded();
    const c = JSON.parse(get().exportJson());
    mut(c);
    return c;
  };
  test.each([
    [
      'bands {}',
      (s: Doc) => {
        s.bands = {};
      },
    ],
    [
      'bands [null]',
      (s: Doc) => {
        s.bands = [null];
      },
    ],
    [
      'a band without a label',
      (s: Doc) => {
        s.bands = [{ id: 'red' }];
      },
    ],
    [
      'a band id every object has',
      (s: Doc) => {
        s.bands = [{ id: 'constructor', label: 'x' }];
      },
    ],
    [
      'kettlebells ["x"]',
      (s: Doc) => {
        s.inventory.kettlebellsKg = ['x'];
      },
    ],
    [
      'kettlebells lb 0',
      (s: Doc) => {
        s.inventory.kettlebellsLb = [0];
      },
    ],
    [
      'plates [null]',
      (s: Doc) => {
        s.inventory.platesKg = [null];
      },
    ],
    [
      'bar "x"',
      (s: Doc) => {
        s.inventory.barLb = 'x';
      },
    ],
    [
      'kettlebells not a list',
      (s: Doc) => {
        s.inventory.kettlebellsKg = 8;
      },
    ],
  ])('%s', (_n, mut) => {
    const data = withEdit(mut);
    expect(parseBackup(JSON.stringify(data)).ok).toBe(false);
    // Loading the stored file goes through the same check.
    expect(() => migratePersisted(data, 4)).toThrow(/damaged/);
  });

  test('a missing or long program or saved plan name is repaired, never refused', () => {
    const data = withEdit((s) => {
      s.customPlans = [{ id: 'p', name: 5, program: s.programs[0] }];
      s.programs.push({ ...s.programs[0], id: 'second', name: '' });
      s.programs[0].name = 'x'.repeat(20_000);
    });
    for (const state of [
      migratePersisted(data, 4),
      (parseBackup(JSON.stringify(data)) as { state: Doc }).state,
    ]) {
      expect(state.programs.map((p: Doc) => p.name)).toEqual(['x'.repeat(10_000), 'Greyskull LP']);
      expect(state.customPlans[0].name).toBe('My program');
    }
  });

  test('good bands, names and kettlebells still load', () => {
    const data = withEdit((s) => {
      s.bands = [{ id: 'red', label: 'Red' }];
      s.inventory.kettlebellsKg = [8, 12.5];
    });
    expect(parseBackup(JSON.stringify(data)).ok).toBe(true);
  });

  test('setBands refuses what a backup would be refused for', () => {
    expect(() => get().setBands({} as never)).toThrow();
    expect(() => get().setBands([{ id: '__proto__', label: 'x' }])).toThrow();
    get().setBands([{ id: 'red', label: 'Red' }]);
    expect(get().bands).toEqual([{ id: 'red', label: 'Red' }]);
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

  test('stored data that is not a state is refused; missing fields get defaults', () => {
    // Replacing unrecognisable data with defaults would let the next save overwrite it.
    for (const garbage of [null, 'x', [], 3]) expect(() => migratePersisted(garbage, 1)).toThrow(/damaged/);
    expect(
      migratePersisted({ unit: 'lb', inventory: { barKg: 15 } }, 2).inventory.platesKg.length,
    ).toBeGreaterThan(0);
  });
});

describe('stored equipment keeps only equipment this app knows', () => {
  const dirty = ['barbell', 'constructor', '__proto__', 'toString', 'jetpack', 7, 'barbell', 'rings'];
  test('loading the file, migrating an older snapshot and a one-program snapshot', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { ...initialState(), equipment: dirty }, version: 4 }),
    );
    await useStore.persist.rehydrate();
    expect(get().equipment).toEqual(['barbell', 'rings']);
    expect(migratePersisted({ ...initialState(), equipment: dirty }, 4).equipment).toEqual([
      'barbell',
      'rings',
    ]);
    expect(migratePersisted({ equipment: dirty }, 2).equipment).toEqual(['barbell', 'rings']);
    expect(migratePersisted({ equipment: 'barbell' }, 2).equipment).toEqual([]);
    expect(migratePersisted({}, 2).equipment).toEqual([]);
  });

  test('the gym setter never stores an unknown value', () => {
    get().setEquipment(['barbell', 'constructor' as never, 'barbell']);
    expect(get().equipment).toEqual(['barbell']);
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
    setProgram(p);
    const d = startSession();
    for (const id of d.order)
      d.results[id].sets.forEach((_s, i) => {
        get().logSet(id, i, 8);
      });
    get().finishSession();
    setProgram(JSON.parse(JSON.stringify(TEMPLATES.base)) as Program);
    expect(get().deleteExercise('custom_curl')).toEqual([]);
    expect(get().exercises.custom_curl.archived).toBe(true);
    expect(lifts().custom_curl).toBeUndefined();
  });
});

test('optional engine fields and seven training days survive a backup round-trip', () => {
  const program: Program = {
    template: 'custom',
    sessionsPerWeek: 7,
    rules: { ...TEMPLATES.base.rules, progression: '531' },
    days: [
      {
        name: 'A',
        slots: [
          {
            exercise: 'BARBELL_SQUAT',
            lift: 'BARBELL_SQUAT@T2',
            scheme: '3x5+',
            stages: ['3x5+', '3x3+'],
            progression: 'stages',
            advanceAt: 25,
          },
        ],
      },
    ],
  };
  setProgram(program);
  setLift('BARBELL_SQUAT@T2', { stage: 1 });
  startSession();
  get().finishSession();
  const state = JSON.parse(get().exportJson());
  state.sessions[0].results.BARBELL_SQUAT.sets[0].kg = 20;
  const r = parseBackup(JSON.stringify(state));
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.state.programs[0]).toMatchObject(program);
    expect(r.state.programs[0].lifts['BARBELL_SQUAT@T2'].stage).toBe(0);
    expect(r.state.sessions[0].results.BARBELL_SQUAT.sets[0].kg).toBe(20);
  }
  state.sessions[0].results.BARBELL_SQUAT.sets[0].kg = 'bad';
  expect(parseBackup(JSON.stringify(state)).ok).toBe(false);
  delete state.sessions[0].results.BARBELL_SQUAT.sets[0].kg;
  state.programs[0].lifts['BARBELL_SQUAT@T2'].stage = -1;
  expect(parseBackup(JSON.stringify(state)).ok).toBe(false);
  state.programs[0].lifts['BARBELL_SQUAT@T2'].stage = 0;
  expect(typeof state.programs[0].lifts['BARBELL_SQUAT@T2'].touchedAt).toBe('string');
  state.programs[0].lifts['BARBELL_SQUAT@T2'].touchedAt = 5;
  expect(parseBackup(JSON.stringify(state)).ok).toBe(false);
  delete state.programs[0].lifts['BARBELL_SQUAT@T2'].touchedAt;
  expect(parseBackup(JSON.stringify(state)).ok).toBe(true);
  state.programs[0].sessionsPerWeek = 8;
  expect(parseBackup(JSON.stringify(state)).ok).toBe(false);
});

const HOSTILE = ['constructor', '__proto__', 'toString', 'hasOwnProperty'];
const custom = (id: string, extra: object = {}) => ({
  id,
  name: 'X',
  kind: 'barbell',
  increment: { kg: 1, lb: 2 },
  custom: true,
  ...extra,
});
const result = (extra: object = {}) => ({ weightKg: 20, sets: [{ target: 5, reps: 5 }], ...extra });
const session = (extra: object = {}) => ({
  n: 0,
  dayName: 'A',
  startedAt: '2026-01-01T10:00:00.000Z',
  finishedAt: '2026-01-01T11:00:00.000Z',
  order: [],
  results: {},
  ...extra,
});
// `defineProperty` makes "__proto__" an own key, as JSON.parse does, instead of setting a prototype.
// biome-ignore lint/suspicious/noExplicitAny: tests mutate arbitrary JSON
const own = (o: any, key: string, value: unknown) =>
  Object.defineProperty(o, key, { value, enumerable: true, configurable: true });
// biome-ignore lint/suspicious/noExplicitAny: tests mutate arbitrary JSON
const hostileCases = (id: string): [string, (s: any) => void][] => [
  [`${id} as an exercise id`, (s) => own(s.exercises, id, custom(id))],
  [`${id} as a slot exercise`, (s) => (s.programs[0].days[0].slots[0].exercise = id)],
  [`${id} as a slot ladder`, (s) => (s.programs[0].days[0].slots[0].ladder = id)],
  [
    `${id} as the exercise of a saved plan`,
    (s) =>
      (s.customPlans = [
        {
          id: 'p',
          name: 'P',
          program: { ...s.programs[0], days: [{ name: 'A', slots: [{ exercise: id, scheme: '3x5' }] }] },
        },
      ]),
  ],
  [
    `${id} as the pictogram of an exercise`,
    (s) => (s.exercises.custom_x = custom('custom_x', { pictogram: id })),
  ],
  [
    `${id} as the background of an exercise`,
    (s) => (s.exercises.custom_x = custom('custom_x', { background: id })),
  ],
  [`${id} as the kind of an exercise`, (s) => (s.exercises.custom_x = custom('custom_x', { kind: id }))],
  [`${id} as the template of a program`, (s) => (s.programs[0].template = id)],
  [
    `${id} as the pattern of an exercise`,
    (s) => (s.exercises.custom_x = custom('custom_x', { pattern: id })),
  ],
  [`${id} as an equipment value`, (s) => (s.exercises.custom_x = custom('custom_x', { equipment: [id] }))],
  [`${id} in the order of a session`, (s) => (s.sessions = [session({ order: [id] })])],
  [
    `${id} as the lift of a result`,
    (s) =>
      (s.sessions = [session({ order: ['BENCH_PRESS'], results: { BENCH_PRESS: result({ lift: id }) } })]),
  ],
  [
    `${id} as the exercise part of a lift key`,
    (s) =>
      (s.sessions = [
        session({ order: ['BENCH_PRESS'], results: { BENCH_PRESS: result({ lift: `${id}@T2` }) } }),
      ]),
  ],
  [`${id} as owned equipment`, (s) => (s.equipment = ['barbell', id])],
  [
    `${id} as the exercise part of a stored lift key`,
    (s) => own(s.programs[0].lifts, `${id}@T2`, { weightKg: 20, startKg: 20, fails: 0 }),
  ],
  [`${id} as a lift key`, (s) => own(s.programs[0].lifts, id, { weightKg: 20, startKg: 20, fails: 0 })],
];

describe('a damaged backup is refused, never thrown', () => {
  const current = () => {
    useStore.setState({ ...initialState(), hydrated: true });
    setProgram(JSON.parse(JSON.stringify(TEMPLATES.base)) as Program);
    return JSON.parse(get().exportJson());
  };
  // biome-ignore lint/suspicious/noExplicitAny: tests mutate arbitrary JSON
  test.each<[string, (s: any) => void]>([
    ['a saved plan that is null', (s) => (s.customPlans = [null])],
    ['a saved plan without a program', (s) => (s.customPlans = [{ id: 'x', name: 'X' }])],
    ['a program without rules', (s) => delete s.programs[0].rules],
    ['a program whose days are not a list', (s) => (s.programs[0].days = {})],
    ['a day without slots', (s) => delete s.programs[0].days[0].slots],
    ['a slot that is null', (s) => (s.programs[0].days[0].slots = [null])],
    ['lifts that are a list', (s) => (s.programs[0].lifts = [])],
    ['exercises with a null entry', (s) => (s.exercises.BENCH_PRESS = null)],
    ['an order item that has no result', (s) => (s.sessions = [session({ order: ['BENCH_PRESS'] })])],
    ['an order item that is not text', (s) => (s.sessions = [session({ order: [3] })])],
    ['equipment that is not a list', (s) => (s.equipment = 'barbell')],
    ['equipment this app does not know', (s) => (s.equipment = ['barbell', 'jetpack'])],
    ['an exercise filed under another id', (s) => (s.exercises.custom_x = custom('custom_y'))],
    ...HOSTILE.flatMap(hostileCases),
    [
      'a one-program backup whose program has no rules',
      (s) => {
        s.version = 2;
        s.program = { ...s.programs[0], rules: undefined };
        s.lifts = {};
        delete s.programs;
      },
    ],
  ])('%s', (_name, mutate) => {
    const data = current();
    mutate(data);
    let result: ReturnType<typeof parseBackup> | undefined;
    expect(() => {
      result = parseBackup(JSON.stringify(data));
    }).not.toThrow();
    expect(result?.ok).toBe(false);
  });
});

test("a one-program backup's built-in exercises take the shipped abbreviation", () => {
  useStore.setState({ ...initialState(), hydrated: true });
  setProgram(JSON.parse(JSON.stringify(TEMPLATES.base)) as Program);
  const data = JSON.parse(get().exportJson());
  data.version = 2;
  data.program = data.programs[0];
  data.lifts = data.programs[0].lifts;
  delete data.programs;
  data.exercises.BENCH_PRESS = { ...get().exercises.BENCH_PRESS, abbr: 'OLD', increment: { kg: 1, lb: 2 } };
  const r = parseBackup(JSON.stringify(data));
  if (!r.ok) throw new Error(r.error);
  expect(r.state.exercises.BENCH_PRESS.abbr).toBe(get().exercises.BENCH_PRESS.abbr);
  expect(r.state.exercises.BENCH_PRESS.increment).toEqual({ kg: 1, lb: 2 });
});

describe('limits hold on every path: a backup, an old stored file and a load', () => {
  // biome-ignore lint/suspicious/noExplicitAny: tests mutate arbitrary JSON
  type Doc = any;
  const seededDoc = (): Doc => {
    seeded();
    return JSON.parse(get().exportJson());
  };
  const refusedEverywhere = async (doc: Doc) => {
    expect(parseBackup(JSON.stringify(doc)).ok).toBe(false);
    expect(() => migratePersisted(doc, 4)).toThrow(/damaged/);
    // Loading the file: the recovery screen with the reason, and the file untouched.
    const raw = JSON.stringify({ state: doc, version: 4 });
    files.clear();
    files.set(stateFile().uri, raw);
    useStore.setState({ ...initialState(), hydrated: false, storageError: null });
    await initStore();
    expect(get().storageError).toMatch(/damaged/);
    await storage.flush();
    expect(files.get(stateFile().uri)).toBe(raw);
  };

  test.each([
    [
      'a custom exercise with a huge increment',
      (s: Doc) => (s.exercises.custom_x = custom('custom_x', { increment: { kg: 1e9, lb: 1 } })),
    ],
    [
      'a custom exercise with a 500 kg bar',
      (s: Doc) => (s.exercises.custom_x = custom('custom_x', { barKg: { kg: 500, lb: 1 } })),
    ],
    [
      'a custom exercise with a name of 10,001 letters',
      (s: Doc) => (s.exercises.custom_x = custom('custom_x', { name: 'x'.repeat(10_001) })),
    ],
    ['a custom exercise stored under another id', (s: Doc) => (s.exercises.custom_x = custom('custom_y'))],
    [
      'a custom exercise with muscles that are not a list',
      (s: Doc) => (s.exercises.custom_x = custom('custom_x', { muscles: 'wings' })),
    ],
    ['a plate of 1,000,000 kg', (s: Doc) => (s.inventory.platesKg = [1e6])],
    ['a bar of 500 kg', (s: Doc) => (s.inventory.barKg = 500)],
    ['a thousand plate sizes', (s: Doc) => (s.inventory.platesLb = Array.from({ length: 1000 }, () => 5))],
    [
      'a stored program with 201 sets in a slot',
      (s: Doc) => (s.programs[0].days[0].slots[0].scheme = '201x5'),
    ],
    [
      'a saved plan with an EMOM of 500 minutes',
      (s: Doc) => {
        const day = {
          name: 'A',
          slots: [{ exercise: 'BARBELL_SQUAT', scheme: '3x5', group: 'g' }],
          groups: [{ id: 'g', kind: 'emom', minutes: 500 }],
        };
        s.customPlans = [{ id: 'p', name: 'P', program: { ...s.programs[0], days: [day] } }];
      },
    ],
  ])('%s is refused (never clamped or dropped)', async (_name, edit) => {
    const doc = seededDoc();
    edit(doc);
    await refusedEverywhere(doc);
  });

  test('a custom exercise keeps archived and loses fields a custom exercise does not have', () => {
    const doc = seededDoc();
    doc.exercises.custom_x = custom('custom_x', { archived: true, secret: 'x', pictogram: 'barbell' });
    const r = parseBackup(JSON.stringify(doc));
    if (!r.ok) throw new Error(r.error);
    expect(r.state.exercises.custom_x).toMatchObject({ id: 'custom_x', custom: true, archived: true });
    expect(r.state.exercises.custom_x).not.toHaveProperty('secret');
  });

  test('nextSession is raised above every id in use, on a backup and on a load', async () => {
    const doc = seededDoc();
    doc.sessions = [1, 2, 7].map((n) =>
      session({ n, startedAt: `2026-01-0${n}T10:00:00.000Z`, finishedAt: `2026-01-0${n}T11:00:00.000Z` }),
    );
    doc.nextSession = 0;
    const r = parseBackup(JSON.stringify(doc));
    expect(r.ok && r.state.nextSession).toBe(8);
    expect(migratePersisted(doc, 4).nextSession).toBe(8);
    files.set(
      stateFile().uri,
      JSON.stringify({
        state: { ...doc, draft: { ...session({ n: 12 }), programId: doc.programs[0].id } },
        version: 4,
      }),
    );
    useStore.setState({ ...initialState(), hydrated: false, storageError: null });
    await initStore();
    expect(get().storageError).toBeNull();
    expect(get().nextSession).toBe(13);
  });

  test.each([
    ['two sessions with one id', (s: Doc) => (s.sessions = [session({ n: 3 }), session({ n: 3 })])],
    ['an id that is not a whole number', (s: Doc) => (s.sessions = [session({ n: 1.5 })])],
    [
      'a result flagged skipped with a string',
      (s: Doc) =>
        (s.sessions = [
          session({ order: ['BENCH_PRESS'], results: { BENCH_PRESS: result({ skipped: 'yes' }) } }),
        ]),
    ],
    ['a negative id', (s: Doc) => (s.sessions = [session({ n: -1 })])],
    ['a start that is not a date', (s: Doc) => (s.sessions = [session({ startedAt: 'yesterday' })])],
    ['a start without a time', (s: Doc) => (s.sessions = [session({ startedAt: '2026-01-01' })])],
    ['a finish that is not text', (s: Doc) => (s.sessions = [session({ finishedAt: 5 })])],
    [
      'a finish that is not a date',
      (s: Doc) => (s.sessions = [session({ finishedAt: '2026-13-45T99:00:00Z' })]),
    ],
  ])('a backup with %s is refused', (_name, edit) => {
    const doc = seededDoc();
    edit(doc);
    expect(parseBackup(JSON.stringify(doc)).ok).toBe(false);
  });

  test('dates with a time-zone offset are still accepted', () => {
    const doc = seededDoc();
    doc.sessions = [
      session({ startedAt: '2026-01-01T10:00:00+02:00', finishedAt: '2026-01-01T11:00:00.000+02:00' }),
    ];
    expect(parseBackup(JSON.stringify(doc)).ok).toBe(true);
  });

  test('a backup text over 20 MB is refused before it is parsed', () => {
    const r = parseBackup(' '.repeat(20 * 1024 * 1024 + 1));
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/too large.*20 MB/) });
  });
});
