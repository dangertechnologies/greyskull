import { builtInExercises, CATALOG_VERSION, refreshCatalog } from './catalog';
import type { Exercise } from './domain';
import { restoreExercises } from './store';

const shipped = builtInExercises();

test('the bundle has the full library: every entry has equipment, muscles, a pattern and a loadable increment', () => {
  const all = Object.values(shipped);
  expect(all.length).toBeGreaterThan(900);
  expect(all.filter((e) => e.id.startsWith('CAL_')).length).toBeGreaterThan(50);
  for (const e of all) {
    expect(e.equipment?.length).toBeGreaterThan(0);
    expect(e.muscles?.length).toBeGreaterThan(0);
    expect(e.pattern).toBeDefined();
    expect(e.pictogram).toBeDefined();
    expect(e.increment.kg).toBeGreaterThanOrEqual(0); // 0: bodyweight work that cannot take load (crunches)
    if (e.video) expect(e.video).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/);
  }
  expect(CATALOG_VERSION).toBeGreaterThanOrEqual(5);
});

test('the main lifts and the calisthenics entries keep form tips and a technique video', () => {
  for (const id of ['BARBELL_SQUAT', 'DEADLIFT', 'BENCH_PRESS', 'MILITARY_PRESS', 'BENT_OVER_ROW']) {
    expect(shipped[id].video).toBeDefined();
    expect(shipped[id].goodForm?.length).toBeGreaterThanOrEqual(3);
    expect(shipped[id].badForm?.length).toBeGreaterThanOrEqual(3);
  }
  for (const e of Object.values(shipped).filter((x) => x.id.startsWith('CAL_'))) {
    expect(e.goodForm?.length).toBeGreaterThanOrEqual(2);
  }
});

test('refresh replaces shipped content but keeps the user settings and custom exercises', () => {
  const old: Record<string, Exercise> = JSON.parse(JSON.stringify(shipped));
  old.BENCH_PRESS = {
    ...old.BENCH_PRESS,
    name: 'My bench',
    increment: { kg: 5, lb: 10 },
    goodForm: ['old tip'],
    video: 'https://old',
    pictogram: 'old',
  };
  old.CRUNCHES = { ...old.CRUNCHES, video: 'https://removed-upstream' };
  delete (old as Partial<Record<string, Exercise>>).DIPS;
  old.custom_x = {
    id: 'custom_x',
    name: 'X',
    shortName: 'X',
    icon: 'muscle',
    kind: 'barbell',
    increment: { kg: 1, lb: 2 },
    custom: true,
  };

  const next = refreshCatalog(old);
  expect(next.BENCH_PRESS).toMatchObject({ name: 'My bench', increment: { kg: 5, lb: 10 } });
  expect(next.BENCH_PRESS.goodForm).toEqual(shipped.BENCH_PRESS.goodForm);
  expect(next.BENCH_PRESS.video).toBe(shipped.BENCH_PRESS.video);
  expect(next.BENCH_PRESS.pictogram).toBe(shipped.BENCH_PRESS.pictogram);
  expect(next.CRUNCHES.video).toBeUndefined();
  expect(next.DIPS).toEqual(shipped.DIPS);
  expect(next.custom_x).toEqual(old.custom_x);
});

test('refresh gives a bodyweight built-in stored with a zero increment the shipped one, and keeps a chosen one', () => {
  const old = JSON.parse(JSON.stringify(shipped)) as Record<string, Exercise>;
  old.CHINUPS = { ...old.CHINUPS, increment: { kg: 0, lb: 0 } };
  old.DIPS = { ...old.DIPS, increment: { kg: 1.25, lb: 2.5 } };
  const next = refreshCatalog(old);
  expect(next.CHINUPS.increment).toEqual(shipped.CHINUPS.increment);
  expect(next.CHINUPS.increment.kg).toBeGreaterThan(0);
  expect(next.DIPS.increment).toEqual({ kg: 1.25, lb: 2.5 });
});

test('on launch a stored edit of a user field wins over the bundle, and other content comes from the bundle', () => {
  const id = 'CAL_PUSHUP';
  const stored = {
    [id]: { id, name: 'My push-up', equipment: ['rings'], description: 'stale' },
  } as unknown as Record<string, Exercise>;
  const restored = restoreExercises(stored)[id];
  expect(restored.name).toBe('My push-up');
  expect(restored.equipment).toEqual(['rings']);
  expect(restored.description).toBe(shipped[id].description);
});
