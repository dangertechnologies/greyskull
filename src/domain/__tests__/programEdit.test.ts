import { active } from '../../__fixtures__/oneProgram';
import { builtInExercises } from '../../catalog';
import { sessionFor, TEMPLATES, validateProgram } from '../program';
import {
  addAlternatingSlot,
  addDay,
  addExercise,
  addSlot,
  blankProgram,
  buildProgram,
  canGroup,
  copyProgram,
  defaultGroupSettings,
  defaultSlot,
  dragTarget,
  groupLabel,
  groupSlots,
  moveSlot,
  moveSlotTo,
  progressionOptions,
  removeDay,
  removeSlot,
  renameDay,
  SCHEMES,
  setSlotLadder,
  setSlotProgression,
  setSlotScheme,
  switchMode,
  ungroup,
  updateGroup,
} from '../programEdit';
import type { Exercise, Program, Slot } from '../types';
import { DEFAULT_RULES } from '../types';

const ex = builtInExercises();
const base = TEMPLATES.base;

test('buildProgram applies plugins for the template only, then options', () => {
  const p = buildProgram(base, ['curls', 'rows_instead_of_chins'], {
    sessionsPerWeek: 2,
    rules: { ...DEFAULT_RULES, doubleAt: 8 },
  });
  expect(p.days.every((d) => d.slots.at(-1)?.exercise === 'CURLS')).toBe(true);
  expect(JSON.stringify(p)).not.toContain('BENT_OVER_ROW');
  expect(p.sessionsPerWeek).toBe(2);
  expect(p.rules.doubleAt).toBe(8);
  expect(JSON.stringify(base)).not.toContain('CURLS');
  expect(validateProgram(p, ex)).toEqual([]);
});

test('edits are immutable and keep the program valid', () => {
  const dips = addSlot(base, 1, 'DIPS', '2xAMRAP');
  expect(dips.days[1].slots.at(-1)).toEqual({ exercise: 'DIPS', scheme: '2xAMRAP' });
  expect(base.days[1].slots).toHaveLength(2);
  expect(sessionFor(active(dips, 1)).slots.map((s) => s.exercise)).toEqual([
    'BENCH_PRESS',
    'DEADLIFT',
    'DIPS',
  ]);
  expect(sessionFor(active(dips, 0)).slots).toHaveLength(2); // other days unchanged
  const moved = moveSlot(dips, 1, 2, -1);
  expect(moved.days[1].slots.map((s) => s.exercise)).toEqual([
    ['MILITARY_PRESS', 'BENCH_PRESS'],
    'DIPS',
    'DEADLIFT',
  ]);
  expect(moveSlot(dips, 1, 0, -1)).toEqual(dips);
  expect(removeSlot(moved, 1, 1).days[1].slots).toHaveLength(2);
  expect(setSlotScheme(base, 0, 1, '3x5+').days[0].slots[1].scheme).toBe('3x5+');
  expect(renameDay(base, 0, 'Push').days[0].name).toBe('Push');
});

test('days can be added and removed; an empty day is a validation error', () => {
  const more = addDay(base);
  expect(more.days.at(-1)).toEqual({ name: 'Day 4', slots: [] });
  expect(validateProgram(more, ex).join()).toMatch(/Day 4 has no exercises/);
  expect(removeDay(more, 3).days).toHaveLength(3);
});

test('an alternating pair keeps the order already used elsewhere', () => {
  const custom = {
    ...base,
    days: [
      {
        name: 'A',
        slots: [{ exercise: ['BENCH_PRESS', 'MILITARY_PRESS'] as [string, string], scheme: '2x5+' as const }],
      },
      { name: 'B', slots: [] },
    ],
  };
  const added = addAlternatingSlot(custom, 1, 'MILITARY_PRESS', 'BENCH_PRESS');
  expect(added.days[1].slots[0].exercise).toEqual(['BENCH_PRESS', 'MILITARY_PRESS']);
  expect(validateProgram(added, ex)).toEqual([]);
  const fresh = addAlternatingSlot(custom, 1, 'DIPS', 'CURLS');
  expect(fresh.days[1].slots[0].exercise).toEqual(['DIPS', 'CURLS']);
});

import { buildScheme, schemeParts } from '../programEdit';

test('scheme sheet controls round-trip every scheme the app ships', () => {
  for (const s of SCHEMES) expect(buildScheme(schemeParts(s))).toBe(s);
  expect(buildScheme({ sets: 3, mode: 'range', reps: 10, repsMax: 8 })).toBe('3x10-10');
  expect(schemeParts('4x6+')).toMatchObject({ sets: 4, mode: 'lastAmrap', reps: 6 });
  expect(schemeParts('2xAMRAP').mode).toBe('allAmrap');
});

describe('drag reorder', () => {
  const prog = (): Program => ({
    template: 'custom',
    sessionsPerWeek: 3,
    rules: { doubleAt: 10, deloadPct: 0.1, failsBeforeDeload: 1, warmups: true },
    days: [
      {
        name: 'A',
        slots: ['BARBELL_SQUAT', 'BENCH_PRESS', 'BARBELL_ROW'].map((exercise) => ({
          exercise,
          scheme: '2x5+' as const,
        })),
      },
    ],
  });
  const ids = (p: Program) => p.days[0].slots.map((s) => s.exercise);

  test('moveSlotTo moves to any position and clamps', () => {
    expect(ids(moveSlotTo(prog(), 0, 0, 2))).toEqual(['BENCH_PRESS', 'BARBELL_ROW', 'BARBELL_SQUAT']);
    expect(ids(moveSlotTo(prog(), 0, 2, 0))).toEqual(['BARBELL_ROW', 'BARBELL_SQUAT', 'BENCH_PRESS']);
    expect(ids(moveSlotTo(prog(), 0, 1, 99))).toEqual(['BARBELL_SQUAT', 'BARBELL_ROW', 'BENCH_PRESS']);
    expect(ids(moveSlotTo(prog(), 0, 1, 1))).toEqual(['BARBELL_SQUAT', 'BENCH_PRESS', 'BARBELL_ROW']);
  });

  test('dragTarget converts a finger offset into a row index', () => {
    expect(dragTarget(1, 0, 100, 3)).toBe(1);
    expect(dragTarget(1, 60, 100, 3)).toBe(2);
    expect(dragTarget(1, -160, 100, 3)).toBe(0);
    expect(dragTarget(0, 900, 100, 3)).toBe(2);
    expect(dragTarget(1, 50, 0, 3)).toBe(1);
  });
});

describe('timed schemes in the scheme sheet', () => {
  test('timed holds and ranges of seconds round-trip', () => {
    expect(schemeParts('3x30s')).toMatchObject({ sets: 3, mode: 'timed', reps: 30 });
    expect(schemeParts('3x10-30s')).toMatchObject({ sets: 3, mode: 'timedRange', reps: 10, repsMax: 30 });
    for (const s of ['3x30s', '2x45s', '3x10-30s', '4x5-15s'] as const)
      expect(buildScheme(schemeParts(s))).toBe(s);
    expect(buildScheme({ sets: 3, mode: 'timed', reps: 20, repsMax: 40 })).toBe('3x20s');
    expect(buildScheme({ sets: 3, mode: 'timedRange', reps: 40, repsMax: 20 })).toBe('3x40-40s');
  });

  test('switching between reps and seconds starts from a sensible value', () => {
    const reps = schemeParts('3x8');
    expect(switchMode(reps, 'timed')).toMatchObject({ mode: 'timed', reps: 30 });
    expect(switchMode(reps, 'timedRange')).toMatchObject({ mode: 'timedRange', reps: 20, repsMax: 40 });
    expect(switchMode(schemeParts('3x30s'), 'fixed')).toMatchObject({ mode: 'fixed', reps: 5 });
    expect(switchMode(schemeParts('3x30s'), 'range')).toMatchObject({ mode: 'range', reps: 8, repsMax: 12 });
    // Staying on the same side keeps what the user chose.
    expect(switchMode(schemeParts('3x40s'), 'timedRange')).toMatchObject({ reps: 40 });
    expect(switchMode(schemeParts('3x8'), 'range')).toMatchObject({ reps: 8 });
  });
});

describe('new exercises get a scheme that can progress', () => {
  const custom = (patch: Partial<Exercise>): Exercise => ({
    id: 'x',
    name: 'X',
    shortName: 'X',
    kind: 'barbell',
    increment: { kg: 2.5, lb: 5 },
    ...patch,
  });
  test('a barbell lift keeps the program default, bodyweight and timed ones do not', () => {
    expect(defaultSlot(custom({}))).toEqual({ exercise: 'x', scheme: '2x5+' });
    expect(defaultSlot(custom({ kind: 'bodyweight' }))).toEqual({
      exercise: 'x',
      scheme: '3x8-12',
      progression: 'double',
    });
    expect(defaultSlot(custom({ kind: 'bodyweight', timed: true }))).toEqual({
      exercise: 'x',
      scheme: '3x20-40s',
      progression: 'double',
    });
    expect(defaultSlot(custom({ kind: 'dumbbell', timed: true }))).toEqual({
      exercise: 'x',
      scheme: '3x30s',
      progression: 'linear',
    });
  });
  test('every catalog exercise gets a slot that validates on its own', () => {
    for (const e of Object.values(ex)) {
      const p = addExercise(
        { ...base, days: [{ name: 'A', slots: [] }], rules: { ...DEFAULT_RULES, progression: 'amrap' } },
        0,
        e,
      );
      expect(validateProgram(p, ex)).toEqual([]);
    }
  });
});

describe('progression per slot', () => {
  const day = (slot: Slot, rules: Partial<Program['rules']> = {}): Program => ({
    template: 'custom',
    sessionsPerWeek: 3,
    rules: { ...DEFAULT_RULES, ...rules },
    days: [{ name: 'A', slots: [slot] }],
  });
  const model = (o: ReturnType<typeof progressionOptions>, m: string) => o.find((x) => x.model === m);

  test('timed holds cannot use AMRAP, bodyweight lifts only double or ladder', () => {
    const plank = progressionOptions({ exercise: 'CAL_PLANK', scheme: '3x30s' }, ex);
    expect(model(plank, 'amrap')?.disabled).toMatch(/hold/i);
    expect(model(plank, 'linear')?.disabled).toMatch(/bodyweight/i);
    expect(model(plank, 'double')?.disabled).toBeUndefined();
    const dips = progressionOptions({ exercise: 'DIPS', scheme: '3x8' }, ex);
    expect(model(dips, 'amrap')?.disabled).toMatch(/bodyweight/i);
    expect(model(dips, 'linear')?.disabled).toMatch(/bodyweight/i);
    expect(model(dips, 'double')?.disabled).toBeUndefined();
    const squat = progressionOptions({ exercise: 'BARBELL_SQUAT', scheme: '2x5+' }, ex);
    expect(squat.map((o) => o.disabled)).toEqual([undefined, undefined, undefined, undefined]);
    const pair = progressionOptions({ exercise: ['BENCH_PRESS', 'MILITARY_PRESS'], scheme: '2x5+' }, ex);
    expect(model(pair, 'ladder')?.disabled).toMatch(/pair/i);
  });

  test('picking double turns a fixed scheme into a range; picking linear keeps the scheme', () => {
    const squat = addSlot({ ...base, days: [{ name: 'A', slots: [] }] }, 0, 'BARBELL_SQUAT', '3x8');
    const double = setSlotProgression(squat, 0, 0, 'double', ex);
    expect(double.days[0].slots[0]).toMatchObject({ progression: 'double', scheme: '3x8-12' });
    const timed = setSlotProgression(addSlot(squat, 0, 'CAL_PLANK', '3x30s'), 0, 1, 'double', ex);
    expect(timed.days[0].slots[1].scheme).toBe('3x30-45s');
    const amrap = setSlotProgression(squat, 0, 0, 'amrap', ex);
    expect(amrap.days[0].slots[0]).toMatchObject({ progression: 'amrap', scheme: '3x8' });
    expect(validateProgram(double, ex)).toEqual([]);
  });

  test('a choice the exercise cannot use is ignored', () => {
    const p = addSlot({ ...base, days: [{ name: 'A', slots: [] }] }, 0, 'CAL_PLANK', '3x30s');
    expect(setSlotProgression(p, 0, 0, 'amrap', ex)).toBe(p);
    expect(setSlotProgression(p, 0, 0, 'linear', ex)).toBe(p);
  });

  test('a ladder slot starts at the first step, uses ladder progression and keeps a range', () => {
    const p = setSlotLadder(day({ exercise: 'BARBELL_SQUAT', scheme: '2x5+' }), 0, 0, 'rr_pullup');
    expect(p.days[0].slots[0]).toEqual({
      exercise: 'CAL_SCAPULAR_PULL',
      scheme: '3x5-8',
      progression: 'ladder',
      ladder: 'rr_pullup',
    });
    expect(validateProgram(p, ex)).toEqual([]);
    const holds = setSlotLadder(p, 0, 0, 'skill_lsit');
    expect(holds.days[0].slots[0]).toMatchObject({ exercise: 'CAL_LSIT_FOOT_SUPPORTED', scheme: '3x10-30s' });
    expect(validateProgram(holds, ex)).toEqual([]);
    expect(setSlotLadder(p, 0, 0, 'nope')).toBe(p);
  });

  test('leaving a ladder keeps the first step as a plain exercise', () => {
    const ladder = setSlotLadder(day({ exercise: 'DIPS', scheme: '2x5+' }), 0, 0, 'rr_dip');
    const back = setSlotProgression(ladder, 0, 0, 'double', ex);
    const slot = back.days[0].slots[0];
    expect(slot).toMatchObject({ exercise: 'CAL_SUPPORT_HOLD', progression: 'double' });
    expect(slot.ladder).toBeUndefined();
    expect(validateProgram(back, ex)).toEqual([]);
  });

  test('a timed scheme moves the slot off AMRAP, whatever the program says', () => {
    const p = day({ exercise: 'BARBELL_SQUAT', scheme: '2x5+' }, { progression: 'amrap' });
    const timed = setSlotScheme(p, 0, 0, '3x30s');
    expect(timed.days[0].slots[0].progression).toBe('linear');
    expect(setSlotScheme(p, 0, 0, '3x10-30s').days[0].slots[0].progression).toBe('double');
    // Already fine: nothing is added.
    const linear = day({ exercise: 'BARBELL_SQUAT', scheme: '2x5+', progression: 'double' });
    expect(setSlotScheme(linear, 0, 0, '3x10-30s').days[0].slots[0].progression).toBe('double');
    // Reps stay as they are.
    expect(setSlotScheme(p, 0, 0, '3x5').days[0].slots[0].progression).toBeUndefined();
  });
});

describe('grouped sets', () => {
  const slots = (...ids: string[]): Slot[] => ids.map((exercise) => ({ exercise, scheme: '3x8' as const }));
  const start = (...ids: string[]): Program => ({
    template: 'custom',
    sessionsPerWeek: 3,
    rules: { ...DEFAULT_RULES, progression: 'linear' },
    days: [{ name: 'A', slots: slots(...ids) }],
  });
  const groupsOf = (p: Program) => p.days[0].groups ?? [];
  const validIds = ['BARBELL_SQUAT', 'BENCH_PRESS', 'BENT_OVER_ROW', 'DEADLIFT'];

  test('canGroup explains why a selection cannot be grouped', () => {
    const p = groupSlots(start(...validIds), 0, [0, 1], 'superset', { restS: 90 });
    const day0 = p.days[0];
    expect(canGroup(day0, [2, 3], 'superset')).toBeNull();
    expect(canGroup(day0, [], 'superset')).toMatch(/select/i);
    expect(canGroup(day0, [2], 'superset')).toMatch(/at least 2/);
    expect(canGroup(day0, [2], 'emom')).toBeNull();
    expect(canGroup(day0, [2, 3], 'emom')).toBeNull();
    expect(canGroup(p.days[0], [1, 2], 'superset')).toMatch(/already/i);
    expect(canGroup(start(...validIds).days[0], [0, 2], 'superset')).toMatch(/next to each other/);
  });

  test('a superset is added with a rest and an id, and validates', () => {
    const p = groupSlots(start(...validIds), 0, [1, 2], 'superset', { restS: 90 });
    expect(groupsOf(p)).toEqual([{ id: 'g1', kind: 'superset', restS: 90 }]);
    expect(p.days[0].slots.map((s) => s.group)).toEqual([undefined, 'g1', 'g1', undefined]);
    expect(validateProgram(p, ex)).toEqual([]);
    const second = groupSlots(p, 0, [3], 'emom', { minutes: 10 });
    expect(groupsOf(second).map((g) => g.id)).toEqual(['g1', 'g2']);
  });

  test('a circuit sets every exercise to the number of rounds', () => {
    const p = groupSlots(start(...validIds), 0, [0, 1, 2], 'circuit', { rounds: 4, restS: 60 });
    expect(p.days[0].slots.map((s) => s.scheme)).toEqual(['4x8', '4x8', '4x8', '3x8']);
    expect(groupsOf(p)[0]).toEqual({ id: 'g1', kind: 'circuit', rounds: 4, restS: 60 });
    expect(validateProgram(p, ex)).toEqual([]);
    const more = updateGroup(p, 0, 'g1', { rounds: 2, restS: 30 });
    expect(more.days[0].slots.map((s) => s.scheme)).toEqual(['2x8', '2x8', '2x8', '3x8']);
    expect(groupsOf(more)[0]).toMatchObject({ rounds: 2, restS: 30 });
    expect(validateProgram(more, ex)).toEqual([]);
    // Alternating stages stay in step with the scheme.
    const staged = start(...validIds);
    staged.days[0].slots[0] = { exercise: 'BARBELL_SQUAT', scheme: '3x5', stages: ['3x5', '4x4'] };
    const grouped = groupSlots(staged, 0, [0, 1], 'circuit', { rounds: 5 });
    expect(grouped.days[0].slots[0]).toMatchObject({ scheme: '5x5', stages: ['5x5', '5x4'] });
  });

  test('an interval keeps rounds and work time; an EMOM turns minutes into sets', () => {
    const interval = groupSlots(start(...validIds), 0, [0, 1], 'interval', {
      rounds: 8,
      workS: 30,
      restS: 15,
    });
    expect(groupsOf(interval)[0]).toEqual({ id: 'g1', kind: 'interval', rounds: 8, workS: 30, restS: 15 });
    expect(interval.days[0].slots.slice(0, 2).map((s) => s.scheme)).toEqual(['8x8', '8x8']);
    expect(validateProgram(interval, ex)).toEqual([]);
    const emom = groupSlots(start(...validIds), 0, [0, 1], 'emom', { minutes: 10 });
    expect(emom.days[0].slots.slice(0, 2).map((s) => s.scheme)).toEqual(['5x8', '5x8']);
    expect(validateProgram(emom, ex)).toEqual([]);
    const longer = updateGroup(emom, 0, 'g1', { minutes: 12 });
    expect(longer.days[0].slots.slice(0, 2).map((s) => s.scheme)).toEqual(['6x8', '6x8']);
    // Minutes the exercises do not divide are kept, so validateProgram says so.
    const odd = updateGroup(emom, 0, 'g1', { minutes: 7 });
    expect(validateProgram(odd, ex).join()).toMatch(/divide 7 minutes/);
  });

  test('settings that do not belong to the kind are not stored', () => {
    const p = groupSlots(start(...validIds), 0, [0, 1], 'superset', {
      rounds: 3,
      workS: 20,
      minutes: 4,
      restS: 45,
    });
    expect(groupsOf(p)[0]).toEqual({ id: 'g1', kind: 'superset', restS: 45 });
  });

  test('defaults per kind validate for any slot count', () => {
    for (const kind of ['superset', 'circuit', 'emom', 'interval'] as const) {
      for (let n = kind === 'emom' || kind === 'interval' ? 1 : 2; n <= 4; n++) {
        const idx = Array.from({ length: n }, (_, i) => i);
        const p = groupSlots(start(...validIds), 0, idx, kind, defaultGroupSettings(kind, n));
        expect(validateProgram(p, ex)).toEqual([]);
      }
    }
  });

  test('ungroup frees the exercises and keeps their sets', () => {
    const p = groupSlots(start(...validIds), 0, [0, 1], 'circuit', { rounds: 4 });
    const free = ungroup(p, 0, 'g1');
    expect(free.days[0].groups).toBeUndefined();
    expect(free.days[0].slots.every((s) => s.group === undefined)).toBe(true);
    expect(free.days[0].slots[0].scheme).toBe('4x8');
    expect(validateProgram(free, ex)).toEqual([]);
  });

  test('a group of ladder slots is left for validateProgram to judge', () => {
    let p = start('CAL_PULLUP', 'DIPS');
    p = setSlotLadder(p, 0, 0, 'rr_pullup');
    p = setSlotLadder(p, 0, 1, 'rr_dip');
    const grouped = groupSlots(p, 0, [0, 1], 'superset', { restS: 60 });
    expect(grouped.days[0].slots.map((s) => s.scheme)).toEqual(['3x5-8', '3x10-30s']);
    expect(validateProgram(grouped, ex)).toEqual([]);
  });

  test('removing exercises dissolves groups that fall below their minimum or empty out', () => {
    const p = groupSlots(start(...validIds), 0, [0, 1], 'superset', { restS: 60 });
    const one = removeSlot(p, 0, 0);
    expect(one.days[0].groups).toBeUndefined();
    expect(one.days[0].slots[0].group).toBeUndefined();
    const three = groupSlots(start(...validIds), 0, [0, 1, 2], 'circuit', { rounds: 3 });
    const two = removeSlot(three, 0, 1);
    expect(groupsOf(two)).toHaveLength(1);
    expect(validateProgram(two, ex)).toEqual([]);
    const solo = groupSlots(start(...validIds), 0, [3], 'emom', { minutes: 5 });
    expect(removeSlot(solo, 0, 3).days[0].groups).toBeUndefined();
    expect(removeDay(p, 0).days).toHaveLength(0);
  });

  test('moves never split a group: an outside exercise hops over it, a member stays inside', () => {
    const p = groupSlots(start(...validIds), 0, [1, 2], 'superset', { restS: 60 });
    const names = (q: Program) => q.days[0].slots.map((s) => s.exercise);
    // BARBELL_SQUAT (0) moves down: jumps over the whole superset.
    expect(names(moveSlot(p, 0, 0, 1))).toEqual([
      'BENCH_PRESS',
      'BENT_OVER_ROW',
      'BARBELL_SQUAT',
      'DEADLIFT',
    ]);
    expect(validateProgram(moveSlot(p, 0, 0, 1), ex)).toEqual([]);
    // DEADLIFT (3) moves up: jumps over it too.
    expect(names(moveSlot(p, 0, 3, -1))).toEqual([
      'BARBELL_SQUAT',
      'DEADLIFT',
      'BENCH_PRESS',
      'BENT_OVER_ROW',
    ]);
    // Members swap inside the group, but cannot leave it.
    expect(names(moveSlot(p, 0, 1, 1))).toEqual([
      'BARBELL_SQUAT',
      'BENT_OVER_ROW',
      'BENCH_PRESS',
      'DEADLIFT',
    ]);
    expect(moveSlot(p, 0, 1, -1)).toBe(p);
    expect(moveSlot(p, 0, 2, 1)).toBe(p);
    // A drag that would land inside the group, or pull a member out, is ignored.
    expect(moveSlotTo(p, 0, 0, 1)).toBe(p);
    expect(moveSlotTo(p, 0, 1, 3)).toBe(p);
    expect(names(moveSlotTo(p, 0, 0, 3))).toEqual([
      'BENCH_PRESS',
      'BENT_OVER_ROW',
      'DEADLIFT',
      'BARBELL_SQUAT',
    ]);
  });
});

test('a group is described in one line', () => {
  expect(groupLabel({ id: 'g1', kind: 'superset', restS: 90 })).toBe('Superset · rest 90 s');
  expect(groupLabel({ id: 'g1', kind: 'circuit', rounds: 3, restS: 60 })).toBe(
    'Circuit · 3 rounds · rest 60 s',
  );
  expect(groupLabel({ id: 'g1', kind: 'emom', minutes: 10 })).toBe('EMOM · 10 min');
  expect(groupLabel({ id: 'g1', kind: 'interval', rounds: 8, workS: 30, restS: 15 })).toBe(
    'Interval · 8 rounds · 30 s work · 15 s rest',
  );
});

test('a blank program is one empty day that only needs an exercise', () => {
  const blank = blankProgram();
  expect(blank).toMatchObject({
    template: 'custom',
    sessionsPerWeek: 3,
    days: [{ name: 'Day 1', slots: [] }],
  });
  expect(validateProgram(blank, ex)).toEqual(['Day 1 has no exercises.']);
  expect(validateProgram(addExercise(blank, 0, ex.BENCH_PRESS), ex)).toEqual([]);
  expect(blankProgram().rules).not.toBe(blankProgram().rules);
});

test('a copy is a custom program that shares nothing with its source', () => {
  const active = { ...base, id: 'p', name: 'P', position: 4, lifts: {}, startN: 3, paused: true };
  const copy = copyProgram(active);
  expect(Object.keys(copy).sort()).toEqual(['days', 'rules', 'sessionsPerWeek', 'template']);
  expect(copy.template).toBe('custom');
  expect(copy.days).toEqual(base.days);
  copy.days[0].name = 'Changed';
  expect(base.days[0].name).not.toBe('Changed');
  expect(validateProgram(copy, ex)).toEqual([]);
});
