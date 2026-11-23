import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildCatalog,
  EQUIPMENT,
  mapExercise,
  PICTOGRAM_KEYS,
  pictogram,
  serialize,
} from './build-catalog.mjs';

const row = (id, name, equipment = 'barbell') => ({
  id,
  name,
  equipment,
  category: 'strength',
  level: 'beginner',
  force: 'push',
  mechanic: 'compound',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps'],
  instructions: ['SOURCE PROSE MUST NOT BE COPIED'],
});
const fixture = [
  row('Fresh_Press', 'Fresh Press'),
  row('Duplicate', 'Bench-press'),
  row('TAKEN', 'Different movement'),
  row('Excluded', 'Excluded', 'machine'),
  row('Ez_Curl', 'EZ Curl', 'e-z curl bar'),
];
fixture[3].category = 'cardio';
const existing = {
  BENCH: { id: 'BENCH', name: 'Bench press', kind: 'barbell', increment: { kg: 1.25, lb: 2.5 } },
  TAKEN: { id: 'TAKEN', name: 'Taken', kind: 'bodyweight', increment: { kg: 0, lb: 0 } },
};

test('five-entry fixture drops duplicate names, collisions and excluded categories', () => {
  const r = buildCatalog(existing, fixture);
  assert.equal(r.imported, 2);
  assert.equal(r.exercises.TAKEN.name, 'Taken');
  assert.equal(r.exercises.DUPLICATE, undefined);
  assert.equal(r.exercises.EXCLUDED, undefined);
  assert.deepEqual(Object.keys(r.exercises), [...Object.keys(r.exercises)].sort());
  assert.deepEqual(r.exercises.EZ_CURL.barKg, { kg: 10, lb: 25 });
  for (const [id, d] of Object.entries(r.descriptions)) {
    assert.deepEqual(Object.keys(d), ['description']);
    assert.equal(r.exercises[id].goodForm, undefined);
    assert.equal(r.exercises[id].description, d.description);
    assert.equal(r.exercises[id].badForm, undefined);
    assert.equal(PICTOGRAM_KEYS.includes(r.exercises[id].pictogram), true);
    assert.equal(serialize(d).includes('SOURCE PROSE'), false);
  }
});

test('every source equipment value maps to exact kind, equipment and increments', () => {
  for (const equipment of [...Object.keys(EQUIPMENT), null]) {
    const e = mapExercise(row('Example', 'Example', equipment));
    const kind = ['barbell', 'e-z curl bar'].includes(equipment)
      ? 'barbell'
      : equipment === 'dumbbell'
        ? 'dumbbell'
        : equipment === 'kettlebells'
          ? 'kettlebell'
          : ['machine', 'cable'].includes(equipment)
            ? 'machine'
            : 'bodyweight';
    assert.equal(e.kind, kind);
    assert.deepEqual(e.equipment, [EQUIPMENT[equipment] ?? 'none']);
    assert.deepEqual(e.increment, { kg: ['barbell', 'bodyweight'].includes(kind) ? 2.5 : 2, lb: 5 });
    if (['dumbbell', 'kettlebell', 'machine'].includes(kind)) assert.deepEqual(e.step, e.increment);
  }
});

test('all 25 original entries retain every original field except specified increments', () => {
  const original = JSON.parse(readFileSync(new URL('../src/exercises.json', import.meta.url)));
  assert.equal(Object.keys(original).length, 25);
  const r = buildCatalog(original, fixture);
  for (const [id, e] of Object.entries(original)) {
    const copy = { ...r.exercises[id] };
    for (const field of ['equipment', 'muscles', 'pattern', 'pictogram']) {
      assert.ok(copy[field]);
      delete copy[field];
    }
    if (['CHINUPS', 'DIPS'].includes(id)) {
      assert.deepEqual(copy.increment, { kg: 2.5, lb: 5 });
      copy.increment = e.increment;
    }
    assert.equal(serialize(copy), serialize(e));
  }
});

test('calisthenics wins id collisions and retains valid pictograms', () => {
  const cal = { ...existing.TAKEN, pictogram: 'planche' };
  assert.deepEqual(buildCatalog(existing, fixture, { TAKEN: cal }).exercises.TAKEN, cal);
});

test('explicit byte budget fails before writing; exact budget succeeds', () => {
  assert.throws(() => buildCatalog(existing, fixture, {}, { maxBytes: 1 }), /budget exceeded/);
  const r = buildCatalog(existing, fixture);
  assert.equal(buildCatalog(existing, fixture, {}, { maxBytes: r.bytes }).bytes, r.bytes);
});

test('imports all eligible entries without a cap in deterministic order', () => {
  assert.throws(() => mapExercise({}), /Invalid source/);
  const source = Array.from({ length: 805 }, (_, i) => row(`Exercise_${i}`, `Exercise ${i}`));
  const result = buildCatalog(existing, [...source, ...fixture]);
  assert.equal(result.imported, 807);
  assert.deepEqual(buildCatalog(existing, [...fixture, ...source].reverse()), result);
});

test('descriptions contain only mapped facts and no imported cues', () => {
  const result = buildCatalog({}, [row('EZ', 'EZ Curl', 'e-z curl bar')]);
  assert.deepEqual(result.descriptions.EZ, { description: 'EZ Curl: ez bar; works chest; beginner.' });
  assert.equal(result.exercises.EZ.goodForm, undefined);
});

test('movement families receive their matching pictogram', () => {
  for (const [name, expected] of [
    ['Incline Push-Up', 'push-up'],
    ['Pushups', 'push-up'],
    ['Push Up to Side Plank', 'push-up'],
    ['Side Plank', 'plank'],
    ['Wide-Grip Pull-Up', 'pull-up'],
    ['Pullups', 'pull-up'],
    ['Close-Grip Chin-Up', 'chin-up'],
    ['Chin Ups', 'chin-up'],
    ['Bench Dips', 'dip'],
    ['Walking Lunges', 'lunge'],
    ['Inverted Row', 'inverted-row'],
    ['Bent Over Barbell Row', 'row'],
    ['Dumbbell Biceps Curl', 'curl'],
  ])
    assert.equal(pictogram({ name, pattern: 'core' }), expected, name);
});

test('generated catalog meets count, vocabulary, original text and pictogram targets', () => {
  const catalog = JSON.parse(readFileSync(new URL('../src/catalog/exercises.json', import.meta.url)));
  const descriptions = JSON.parse(readFileSync(new URL('../src/catalog/descriptions.json', import.meta.url)));
  const muscles = new Set(
    'abdominals abductors adductors biceps calves chest forearms glutes hamstrings lats lower-back middle-back neck quadriceps shoulders traps triceps'.split(
      ' ',
    ),
  );
  const equipment = new Set(
    'barbell ez-bar trap-bar dumbbell kettlebell cable machine bench pull-up-bar dip-bars rings parallettes bands box medicine-ball exercise-ball foam-roll none'.split(
      ' ',
    ),
  );
  assert.ok(Object.keys(descriptions).length > 400);
  for (const [id, d] of Object.entries(descriptions)) {
    assert.deepEqual(Object.keys(d), ['description']);
    assert.equal(catalog[id].goodForm, undefined);
    assert.equal(catalog[id].badForm, undefined);
    assert.equal(catalog[id].description, d.description);
  }
  const entries = Object.values(catalog);
  assert.ok(entries.filter((e) => e.pictogram === 'generic').length / entries.length < 0.15);
  for (const e of entries) {
    assert.ok(PICTOGRAM_KEYS.includes(e.pictogram), e.id);
    assert.ok(
      e.equipment.every((x) => equipment.has(x)),
      e.id,
    );
    assert.ok(
      e.muscles.every((x) => muscles.has(x)),
      e.id,
    );
    assert.ok(
      (e.secondary ?? []).every((x) => muscles.has(x)),
      e.id,
    );
    assert.equal(e.images, undefined);
  }
});
