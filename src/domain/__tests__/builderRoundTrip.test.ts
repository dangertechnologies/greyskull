import { builtInExercises } from '../../catalog';
import { exportPlan, importPlan } from '../../planShare';
import { LADDERS } from '../ladders';
import { parseProgram, validateProgram } from '../program';
import {
  addAlternatingSlot,
  addDay,
  addExercise,
  addSlot,
  blankProgram,
  groupSlots,
  moveSlot,
  moveSlotTo,
  removeDay,
  removeSlot,
  renameDay,
  setSlotLadder,
  setSlotProgression,
  setSlotScheme,
  ungroup,
  updateGroup,
} from '../programEdit';
import type { GroupKind, Program, Scheme } from '../types';

const catalog = builtInExercises();
const ids = Object.keys(catalog);
const SCHEMES: Scheme[] = ['2x5+', '3x8', '3x8-12', '3x30s', '3x10-30s', '5x5', '2xAMRAP', '4x6+'];
const KINDS: GroupKind[] = ['superset', 'circuit', 'emom', 'interval'];
const NAMES = ['', '  ', 'A', 'Push', 'x'.repeat(99), 'x'.repeat(100), 'x'.repeat(101), 'x'.repeat(300)];

/** Small seeded generator, so a failing sequence can be replayed. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function step(p: Program, r: () => number, growing: boolean): [Program, string] {
  const pick = <T>(list: T[]): T => list[Math.floor(r() * list.length)];
  const d = Math.floor(r() * p.days.length);
  const slots = p.days[d]?.slots.length ?? 0;
  const i = Math.floor(r() * Math.max(1, slots));
  if (growing && r() < 0.7) {
    // Half the walks mostly add whole days and fresh exercises, so the limits on days and exercises are reached.
    if (r() < 0.4) return [addExercise(addDay(p), p.days.length, catalog.BENCH_PRESS), 'addDayWithExercise'];
    const used = new Set(
      p.days[d].slots.flatMap((s) => (typeof s.exercise === 'string' ? [s.exercise] : s.exercise)),
    );
    const fresh = ids.filter((id) => !used.has(id) && catalog[id].kind === 'barbell');
    return [addExercise(p, d, catalog[fresh[Math.floor(r() * fresh.length)] ?? 'BENCH_PRESS']), 'addFresh'];
  }
  const op = Math.floor(r() * 16);
  switch (op) {
    case 0:
      return [addDay(p), 'addDay'];
    case 1:
      return [p.days.length > 1 ? removeDay(p, d) : p, 'removeDay'];
    case 2:
      return [renameDay(p, d, pick(NAMES)), 'renameDay'];
    case 3:
    case 4:
      return [addExercise(p, d, catalog[pick(ids)]), 'addExercise'];
    case 5:
      return [addSlot(p, d, pick(ids), pick(SCHEMES)), 'addSlot'];
    case 6:
      return [addAlternatingSlot(p, d, pick(ids), pick(ids)), 'addAlternatingSlot'];
    case 7:
      return [removeSlot(p, d, i), 'removeSlot'];
    case 8:
      return [moveSlot(p, d, i, r() < 0.5 ? 1 : -1), 'moveSlot'];
    case 9:
      return [moveSlotTo(p, d, i, Math.floor(r() * (slots + 1))), 'moveSlotTo'];
    case 10:
      return [setSlotScheme(p, d, i, pick(SCHEMES)), 'setSlotScheme'];
    case 11:
      return [
        setSlotProgression(p, d, i, pick(['amrap', 'linear', 'double'] as const), catalog),
        'progression',
      ];
    case 12:
      return [setSlotLadder(p, d, i, pick(LADDERS).id), 'ladder'];
    case 13: {
      const from = Math.floor(r() * Math.max(1, slots));
      const picked = Array.from({ length: 1 + Math.floor(r() * 3) }, (_, k) => from + k);
      return [
        groupSlots(p, d, picked, pick(KINDS), { rounds: 3, restS: 60, workS: 30, minutes: 6 }),
        'group',
      ];
    }
    case 14: {
      const g = p.days[d]?.groups;
      return [
        g?.length ? updateGroup(p, d, g[0].id, { rounds: 2 + Math.floor(r() * 4), minutes: 4 }) : p,
        'updateGroup',
      ];
    }
    default: {
      const g = p.days[d]?.groups;
      return [g?.length ? ungroup(p, d, g[0].id) : p, 'ungroup'];
    }
  }
}

test('a program the builder accepts always survives a JSON round trip and an export and import', () => {
  let accepted = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const r = rng(seed);
    let p = blankProgram();
    const trail: string[] = [];
    for (let n = 0; n < 90; n++) {
      let op: string;
      [p, op] = step(p, r, seed % 2 === 0);
      trail.push(op);
      if (validateProgram(p, catalog).length > 0) continue;
      accepted++;
      const context = `seed ${seed}, after ${trail.join(', ')}`;
      const parsed = parseProgram(JSON.parse(JSON.stringify(p)));
      expect({ context, ok: parsed.ok, error: parsed.ok ? '' : parsed.error }).toEqual({
        context,
        ok: true,
        error: '',
      });
      if (!parsed.ok) continue;
      expect({ context, errors: validateProgram(parsed.program, catalog) }).toEqual({ context, errors: [] });
      const shared = importPlan(exportPlan({ id: 'p', name: 'P', program: p }, catalog), {
        exercises: catalog,
        customPlans: [],
      });
      expect({ context, ok: shared.ok, error: shared.ok ? '' : shared.error }).toEqual({
        context,
        ok: true,
        error: '',
      });
    }
  }
  // The walk must actually reach valid programs, or this proves nothing.
  expect(accepted).toBeGreaterThan(300);
});
