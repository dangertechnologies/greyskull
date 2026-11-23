import { active } from '../../__fixtures__/oneProgram';
import { builtInExercises } from '../../catalog';
import { setOrder } from '../groups';
import { LADDERS } from '../ladders';
import { parseScheme, sessionFor, setTargets, validateProgram } from '../program';
import { nextLift } from '../progression';
import { DEFAULT_INVENTORY, DEFAULT_RULES, type LiftState, type Program, type Slot } from '../types';

const ex = builtInExercises();
const inv = DEFAULT_INVENTORY;
const BANDS = [
  { id: 'heavy', label: 'Heavy band' },
  { id: 'light', label: 'Light band' },
];
const fresh = (): LiftState => ({ weightKg: 0, startKg: 0, fails: 0 });
const program = (slots: Slot[], groups: Program['days'][0]['groups'] = []): Program => ({
  template: 'custom',
  sessionsPerWeek: 3,
  rules: DEFAULT_RULES,
  days: [{ name: 'A', slots, groups }],
});

/** One all-success session of every ladder slot of `p`; returns the next lift states. */
function finishAll(p: Program, lifts: Record<string, LiftState>): Record<string, LiftState> {
  const next = { ...lifts };
  for (const slot of sessionFor(active(p, 0, lifts)).slots) {
    if (!slot.ladder) continue;
    const state = lifts[slot.lift] ?? fresh();
    const sets = setTargets(slot.scheme, state.reps).map((target) => ({ target, reps: target ?? 8 }));
    const result = { weightKg: state.weightKg, sets, step: slot.step, scheme: slot.scheme };
    next[slot.lift] = nextLift(state, result, DEFAULT_RULES, ex[slot.exercise], inv, 'kg', {
      ...slot,
      bands: BANDS,
    }).next;
  }
  return next;
}

describe.each(LADDERS.map((l) => [l.id, l] as const))('%s: 120 good sessions', (id, ladder) => {
  test('reach every step in order, respect the range tops and load only loadable weight', () => {
    const p = program([{ exercise: ladder.steps[0].exercise, scheme: '3x5-8', ladder: id }]);
    expect(validateProgram(p, ex)).toEqual([]);
    let lifts: Record<string, LiftState> = {};
    const steps = [0];
    for (let i = 0; i < 120; i++) {
      const [slot] = sessionFor(active(p, 0, lifts)).slots;
      const { reps, repsMax } = parseScheme(slot.scheme);
      for (const target of setTargets(slot.scheme, lifts[id]?.reps)) {
        expect(target).toBeGreaterThanOrEqual(reps ?? 0);
        expect(target).toBeLessThanOrEqual(repsMax ?? reps ?? 0);
      }
      lifts = finishAll(p, lifts);
      const state = lifts[id];
      const step = state.step ?? 0;
      expect(step - (steps.at(-1) ?? 0)).toBeGreaterThanOrEqual(0);
      expect(step - (steps.at(-1) ?? 0)).toBeLessThanOrEqual(1);
      steps.push(step);
      const scheme = parseScheme(ladder.steps[step].scheme ?? '3x5-8');
      if (state.reps !== undefined)
        expect(state.reps).toBeLessThanOrEqual(scheme.repsMax ?? scheme.reps ?? 0);
      // Added load only after the last step of a weighted ladder, in whole single plates (1.25 kg).
      if (ladder.after !== 'weighted' || step < ladder.steps.length - 1) expect(state.weightKg).toBe(0);
      expect(Number.isInteger(state.weightKg / 1.25)).toBe(true);
      if (state.bandId !== undefined) expect(ladder.steps[step].band).toBe(true);
    }
    expect([...new Set(steps)]).toEqual(ladder.steps.map((_, i) => i));
    if (ladder.after === 'weighted') expect(lifts[id].weightKg).toBeGreaterThan(0);
  });
});

test('every group kind walks every set exactly once across 120 sessions of changing ladder steps', () => {
  const p = program(
    [
      { exercise: 'CAL_SCAPULAR_PULL', scheme: '3x5-8', ladder: 'rr_pullup', group: 'a' },
      { exercise: 'CAL_ASSISTED_SQUAT', scheme: '3x5-8', ladder: 'rr_squat', group: 'a' },
      { exercise: 'CAL_PLANK', scheme: '3x8-12', ladder: 'rr_antiextension', group: 'c' },
      { exercise: 'CAL_PALLOF_PRESS_BANDED', scheme: '3x8-12', ladder: 'rr_antirotation', group: 'c' },
      { exercise: 'CAL_REVERSE_HYPEREXTENSION', scheme: '3x8-12', ladder: 'rr_extension', group: 'c' },
      { exercise: 'BARBELL_SQUAT', scheme: '3x5', group: 'e' },
      { exercise: 'BENCH_PRESS', scheme: '3x5', group: 'e' },
      { exercise: 'CAL_SUPPORT_HOLD', scheme: '4x20s', progression: 'linear', group: 'i' },
    ],
    [
      { id: 'a', kind: 'superset', restS: 90 },
      { id: 'c', kind: 'circuit', rounds: 3, restS: 60 },
      { id: 'e', kind: 'emom', minutes: 6 },
      { id: 'i', kind: 'interval', rounds: 4, workS: 20, restS: 10 },
    ],
  );
  expect(validateProgram(p, ex)).toEqual([]);
  let lifts: Record<string, LiftState> = {};
  for (let i = 0; i < 120; i++) {
    const session = sessionFor(active(p, 0, lifts));
    const sets = Object.fromEntries(session.slots.map((s) => [s.exercise, parseScheme(s.scheme).sets]));
    const walk = setOrder(session, sets);
    const seen = walk.map((w) => `${w.exercise}#${w.set}`);
    const expected = session.slots.flatMap((s) =>
      Array.from({ length: sets[s.exercise] }, (_, j) => `${s.exercise}#${j}`),
    );
    expect([...seen].sort()).toEqual([...expected].sort());
    for (const w of walk) expect(w.group).toBe(session.slots.find((s) => s.exercise === w.exercise)?.group);
    expect(walk.filter((w) => w.group === 'e').map((w) => w.atS)).toEqual([0, 60, 120, 180, 240, 300]);
    expect(walk.filter((w) => w.group === 'c' && w.restAfterS === 60)).toHaveLength(3);
    expect(walk.filter((w) => w.group === 'a' && w.restAfterS === 90)).toHaveLength(3);
    lifts = finishAll(p, lifts);
  }
});
