import { builtInExercises } from './catalog';
import { USER_FIELDS } from './domain/exerciseFields';
import { exerciseFromForm, formFrom, linkProblem } from './exerciseEdit';
import { customId } from './exerciseId';
import { exportPlan, importPlan } from './planShare';

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

test('a link must be empty or an http(s) address', () => {
  expect(linkProblem('')).toBeNull();
  expect(linkProblem('  ')).toBeNull();
  expect(linkProblem('https://www.youtube.com/watch?v=abc')).toBeNull();
  expect(linkProblem(' http://example.com/a b'.trim())).not.toBeNull();
  expect(linkProblem('javascript:alert(1)')).not.toBeNull();
  expect(linkProblem('youtube.com/watch')).not.toBeNull();
  expect(linkProblem('file:///etc/passwd')).not.toBeNull();
  expect(linkProblem('https://')).not.toBeNull();
});

describe('limits a saved custom exercise keeps, so a program that uses it can be shared', () => {
  const form = (patch: object) => ({ ...formFrom(undefined), name: 'Front squat', ...patch });
  const made = (patch: object) => exerciseFromForm(form(patch), undefined, (n) => `custom_${n}`);

  test('name and short name 100 letters, description 2000, at most 20 tips of 300 letters', () => {
    const e = made({
      name: 'n'.repeat(150),
      shortName: 's'.repeat(150),
      description: 'd'.repeat(2500),
      good: Array.from({ length: 30 }, () => 'g'.repeat(400)).join('\n'),
      bad: Array.from({ length: 30 }, (_, i) => `bad ${i}`).join('\n'),
    });
    expect(e.name).toHaveLength(100);
    expect(e.shortName).toHaveLength(100);
    expect(e.description).toHaveLength(2000);
    expect(e.goodForm).toHaveLength(20);
    expect(e.goodForm?.every((l) => l.length === 300)).toBe(true);
    expect(e.badForm).toHaveLength(20);
  });

  test('an exercise at every limit is accepted by the importer', () => {
    const e = made({
      name: 'n'.repeat(150),
      description: 'd'.repeat(2500),
      good: Array.from({ length: 30 }, () => 'g'.repeat(400)).join('\n'),
    });
    const id = customId(e.name, catalog);
    expect(id.length).toBeLessThanOrEqual(80);
    const plan = {
      id: 'p',
      name: 'P',
      program: {
        template: 'custom',
        sessionsPerWeek: 3,
        rules: { doubleAt: 10, deloadPct: 0.1, failsBeforeDeload: 1, warmups: true },
        days: [{ name: 'A', slots: [{ exercise: id, scheme: '2x5+' }] }],
      },
    } as const;
    const file = exportPlan(plan as never, { ...catalog, [id]: { ...e, id } });
    const r = importPlan(file, { exercises: catalog, customPlans: [] });
    expect(r.ok).toBe(true);
  });
});
