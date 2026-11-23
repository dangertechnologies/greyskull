import { builtInExercises } from './catalog';
import { USER_FIELDS } from './domain/exerciseFields';
import { exerciseFromForm, formFrom } from './exerciseEdit';

const catalog = builtInExercises();

test('opening and saving a built-in without a change gives back exactly the same exercise', () => {
  for (const e of Object.values(catalog)) {
    expect(JSON.stringify(exerciseFromForm(formFrom(e), e, () => 'unused'))).toBe(JSON.stringify(e));
  }
});

test('a built-in keeps its shipped content; only the user fields take the edited values', () => {
  const e = catalog.CAL_PUSHUP;
  const form = {
    ...formFrom(e),
    name: 'Floor push-up',
    equipment: ['rings' as const],
    timed: true,
    incKg: 5,
    description: 'changed',
    good: 'changed',
    video: 'https://changed',
  };
  const saved = exerciseFromForm(form, e, () => 'unused');
  expect(saved).toMatchObject({ name: 'Floor push-up', equipment: ['rings'], timed: true });
  expect(saved.increment.kg).toBe(5);
  expect(saved.description).toBe(e.description);
  expect(saved.goodForm).toEqual(e.goodForm);
  expect(saved.video).toBe(e.video);
  const changed = Object.keys(saved).filter(
    (k) =>
      JSON.stringify((saved as unknown as Record<string, unknown>)[k]) !==
      JSON.stringify((e as unknown as Record<string, unknown>)[k]),
  );
  for (const k of changed) expect(USER_FIELDS as readonly string[]).toContain(k);
});

test('a new custom exercise gets an id, trimmed text, one tip per line and equipment from its kind', () => {
  const form = {
    ...formFrom(undefined),
    name: '  Front squat ',
    kind: 'barbell' as const,
    abbr: 'fs ',
    good: 'Elbows up\n\n Chest tall ',
    url: ' https://x.test ',
  };
  const saved = exerciseFromForm(form, undefined, (n) => `custom_${n.toLowerCase().replace(/\s+/g, '_')}`);
  expect(saved).toMatchObject({
    id: 'custom_front_squat',
    name: 'Front squat',
    shortName: 'Front',
    abbr: 'FS',
    kind: 'barbell',
    custom: true,
    equipment: ['barbell'],
    goodForm: ['Elbows up', 'Chest tall'],
    url: 'https://x.test',
    increment: { kg: 2.5, lb: 5 },
  });
  expect(saved.step).toBeUndefined();
  expect(saved.timed).toBeUndefined();
});

test('bodyweight keeps the added-weight increment instead of forcing zero', () => {
  const saved = exerciseFromForm(
    { ...formFrom(undefined), name: 'Ring dip', kind: 'bodyweight', incKg: 1.25, incLb: 2.5 },
    undefined,
    () => 'custom_ring_dip',
  );
  expect(saved.increment).toEqual({ kg: 1.25, lb: 2.5 });
  expect(saved.equipment).toEqual(['none']);
});

test('dumbbell, machine and kettlebell exercises carry a weight step; an own bar weight only on a barbell', () => {
  const base = { ...formFrom(undefined), name: 'Z' };
  expect(
    exerciseFromForm({ ...base, kind: 'dumbbell', stepKg: 1, stepLb: 2 }, undefined, () => 'a').step,
  ).toEqual({ kg: 1, lb: 2 });
  expect(exerciseFromForm({ ...base, kind: 'kettlebell' }, undefined, () => 'a').step).toBeDefined();
  expect(
    exerciseFromForm({ ...base, kind: 'barbell', ownBar: true, barKg: 10, barLb: 25 }, undefined, () => 'a')
      .barKg,
  ).toEqual({ kg: 10, lb: 25 });
  expect(
    exerciseFromForm({ ...base, kind: 'dumbbell', ownBar: true }, undefined, () => 'a').barKg,
  ).toBeUndefined();
});
