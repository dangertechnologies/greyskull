import { builtInExercises, refreshCatalog } from './catalog';
import type { Exercise } from './domain';

const shipped = builtInExercises();

test('every built-in has form tips, and the main lifts link a technique video', () => {
  for (const e of Object.values(shipped)) {
    expect(e.goodForm?.length).toBeGreaterThanOrEqual(3);
    expect(e.badForm?.length).toBeGreaterThanOrEqual(3);
    if (e.video) expect(e.video).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/);
  }
  for (const id of ['BARBELL_SQUAT', 'DEADLIFT', 'BENCH_PRESS', 'MILITARY_PRESS', 'BENT_OVER_ROW']) {
    expect(shipped[id].video).toBeDefined();
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
  expect(next.CRUNCHES.video).toBeUndefined();
  expect(next.DIPS).toEqual(shipped.DIPS);
  expect(next.custom_x).toEqual(old.custom_x);
});
