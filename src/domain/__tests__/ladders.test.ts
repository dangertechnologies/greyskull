import { active } from '../../__fixtures__/oneProgram';
import { builtInExercises } from '../../catalog';
import { getLadder, LADDERS } from '../ladders';
import { liftKeysOf, sessionFor, setTargets, tryParseScheme, validateProgram } from '../program';
import { HOLD_STEP_S, nextLift } from '../progression';
import {
  DEFAULT_INVENTORY,
  DEFAULT_RULES,
  type LiftState,
  type Program,
  type Scheme,
  type Slot,
} from '../types';

const ex = builtInExercises();
const inv = DEFAULT_INVENTORY;
const BANDS = [
  { id: 'heavy', label: 'Heavy band' },
  { id: 'medium', label: 'Medium band' },
  { id: 'light', label: 'Light band' },
];

const ladderSlot = (ladder: string, scheme: Scheme = '3x5-8'): Slot => ({
  exercise: getLadder(ladder)?.steps[0].exercise ?? ladder,
  scheme,
  ladder,
});
const program = (...slots: Slot[]): Program => ({
  template: 'custom',
  sessionsPerWeek: 3,
  rules: DEFAULT_RULES,
  days: [{ name: 'A', slots }],
});
const lift = (patch: Partial<LiftState> = {}): LiftState => ({ weightKg: 0, startKg: 0, fails: 0, ...patch });

/** Resolves the ladder slot for `state`, logs every set at `reps` ('hit' = the target), applies progression. */
function finish(
  ladder: string,
  state: LiftState,
  reps: number | 'hit',
  { scheme = '3x5-8' as Scheme, bands = BANDS, intensity = 1 } = {},
) {
  const [slot] = sessionFor(active(program(ladderSlot(ladder, scheme)), 0, { [ladder]: state })).slots;
  const sets = setTargets(slot.scheme, state.reps).map((target) => ({
    target,
    reps: reps === 'hit' ? (target ?? 0) : reps,
  }));
  const band = BANDS.find((b) => b.id === state.bandId);
  const result = {
    weightKg: state.weightKg,
    sets,
    step: slot.step,
    scheme: slot.scheme,
    ...(band ? { band } : {}),
  };
  const outcome = nextLift(state, result, DEFAULT_RULES, ex[slot.exercise], inv, 'kg', {
    ...slot,
    bands,
    intensity,
  });
  return { slot, ...outcome };
}

describe('ladder data', () => {
  test('every ladder resolves, every step exercise exists, timed steps have seconds schemes', () => {
    expect(LADDERS.length).toBeGreaterThan(0);
    for (const ladder of LADDERS) {
      expect(getLadder(ladder.id)).toBe(ladder);
      for (const step of ladder.steps) {
        expect(ex[step.exercise]).toBeDefined();
        if (step.scheme) expect(tryParseScheme(step.scheme)).not.toBeNull();
        if (ex[step.exercise].timed) expect(step.scheme && tryParseScheme(step.scheme)?.timed).toBe(true);
      }
    }
    expect(getLadder('nope')).toBeUndefined();
  });
});

describe('sessionFor resolves ladder slots', () => {
  type Row = [string, number | undefined, string, Scheme, number];
  const rows: Row[] = [
    ['no state starts at the first step', undefined, 'CAL_SCAPULAR_PULL', '3x5-8', 0],
    ['a step with its own scheme uses it', 1, 'CAL_ARCH_HANG', '3x10-30s', 1],
    ['a banded step', 3, 'CAL_PULLUP_BAND_ASSISTED', '3x5-8', 3],
    ['past the end clamps to the last step', 99, 'CAL_LSIT_PULLUP', '3x5-8', 5],
    ['below zero clamps to the first step', -2, 'CAL_SCAPULAR_PULL', '3x5-8', 0],
    ['a fractional step is cut to a whole one', 1.5, 'CAL_ARCH_HANG', '3x10-30s', 1],
    ['a step that is not a number starts at the first step', Number.NaN, 'CAL_SCAPULAR_PULL', '3x5-8', 0],
  ];
  test.each(rows)('%s', (_name, step, exercise, scheme, resolved) => {
    const lifts: Record<string, LiftState> = step === undefined ? {} : { rr_pullup: lift({ step }) };
    const [slot] = sessionFor(active(program(ladderSlot('rr_pullup')), 0, lifts)).slots;
    expect(slot).toMatchObject({
      exercise,
      scheme,
      step: resolved,
      lift: 'rr_pullup',
      progression: 'ladder',
    });
    expect(slot.ladder).toBe('rr_pullup');
  });

  test('the lift key is the ladder id', () => {
    expect(
      liftKeysOf(program(ladderSlot('rr_pullup'), { exercise: 'BARBELL_SQUAT', scheme: '2x5+' })),
    ).toEqual(['rr_pullup', 'BARBELL_SQUAT']);
  });
});

describe('ladder progression', () => {
  type Row = [string, string, Partial<LiftState>, number | 'hit', Partial<LiftState>, string];
  const rows: Row[] = [
    ['every set at the target adds a rep', 'rr_pullup', { step: 0 }, 'hit', { step: 0, reps: 6 }, 'reps'],
    [
      'a set below the target is a miss',
      'rr_pullup',
      { step: 0, reps: 7 },
      6,
      { step: 0, reps: 7, fails: 1 },
      'same',
    ],
    [
      'the top of the range moves to the next step',
      'rr_pullup',
      { step: 0, reps: 8 },
      'hit',
      { step: 1 },
      'up',
    ],
    [
      'a timed step adds 5 seconds',
      'rr_pullup',
      { step: 1 },
      'hit',
      { step: 1, reps: 10 + HOLD_STEP_S },
      'reps',
    ],
    [
      'the hold time is capped at the top',
      'rr_pullup',
      { step: 1, reps: 28 },
      'hit',
      { step: 1, reps: 30 },
      'reps',
    ],
    ['the top hold moves to the next step', 'rr_pullup', { step: 1, reps: 30 }, 'hit', { step: 2 }, 'up'],
    [
      'entering a banded step takes the heaviest band',
      'rr_pullup',
      { step: 2, reps: 8 },
      'hit',
      { step: 3, bandId: 'heavy' },
      'up',
    ],
    [
      'the top with a lighter band left moves to that band',
      'rr_pullup',
      { step: 3, reps: 8, bandId: 'heavy' },
      'hit',
      { step: 3, bandId: 'medium' },
      'up',
    ],
    [
      'the top with the lightest band moves to the next step and drops the band',
      'rr_pullup',
      { step: 3, reps: 8, bandId: 'light' },
      'hit',
      { step: 4 },
      'up',
    ],
    [
      'the top of the last step of a weighted ladder adds load',
      'rr_pullup',
      { step: 5, reps: 8 },
      'hit',
      { step: 5, weightKg: 2.5 },
      'up',
    ],
    [
      'added load keeps growing',
      'rr_dip',
      { step: 2, reps: 8, weightKg: 10 },
      'hit',
      { step: 2, weightKg: 12.5 },
      'up',
    ],
    [
      'the top of the last step of an unweighted ladder holds',
      'rr_squat',
      { step: 6, reps: 8 },
      'hit',
      { step: 6, reps: 8 },
      'same',
    ],
    [
      'a second miss deloads the target, never the step',
      'rr_pullup',
      { step: 4, reps: 7, fails: 1 },
      0,
      { step: 4, fails: 0 },
      'deload',
    ],
    [
      'a deload on a band step moves to the next heavier band',
      'rr_pullup',
      { step: 3, reps: 7, fails: 1, bandId: 'medium' },
      0,
      { step: 3, bandId: 'heavy', fails: 0 },
      'deload',
    ],
    [
      'a deload with the heaviest band keeps it',
      'rr_pullup',
      { step: 3, reps: 7, fails: 1, bandId: 'heavy' },
      0,
      { step: 3, bandId: 'heavy', fails: 0 },
      'deload',
    ],
    [
      'a deload on the weighted top step takes load off, rounded down to single plates',
      'rr_dip',
      { step: 2, reps: 7, fails: 1, weightKg: 20 },
      0,
      { step: 2, weightKg: 17.5, fails: 0 },
      'deload',
    ],
    [
      'a stale band at the top restarts at the heaviest band and keeps the step',
      'rr_pullup',
      { step: 3, reps: 8, bandId: 'deleted' },
      'hit',
      { step: 3, bandId: 'heavy' },
      'same',
    ],
    [
      'a band step without a band restarts at the heaviest band once bands exist',
      'rr_pullup',
      { step: 3, reps: 8 },
      'hit',
      { step: 3, bandId: 'heavy' },
      'same',
    ],
  ];
  test.each(rows)('%s', (_name, ladder, before, reps, after, change) => {
    const outcome = finish(ladder, lift(before), reps);
    expect(outcome.next).toEqual(lift(after));
    expect(outcome.change).toBe(change);
  });

  test('without bands, a banded step is done unassisted', () => {
    expect(finish('rr_pullup', lift({ step: 2, reps: 8 }), 'hit', { bands: [] }).next).toEqual(
      lift({ step: 3 }),
    );
    expect(finish('rr_pullup', lift({ step: 3, reps: 8 }), 'hit', { bands: [] }).next).toEqual(
      lift({ step: 4 }),
    );
  });

  test('a fixed scheme advances as soon as every set is met', () => {
    expect(finish('rr_squat', lift(), 'hit', { scheme: '3x5' }).next).toEqual(lift({ step: 1 }));
    const timed = nextLift(
      lift(),
      { weightKg: 0, sets: [30, 30, 30].map((reps) => ({ target: 30, reps })), step: 0, scheme: '3x30s' },
      DEFAULT_RULES,
      ex.CAL_PLANK,
      inv,
      'kg',
      { progression: 'ladder', ladder: 'rr_antiextension', step: 0, scheme: '3x30s' },
    );
    expect(timed.next).toEqual(lift({ step: 1 }));
  });

  test('a stored step that is fractional or not a number is made whole before climbing', () => {
    const climb = (step: number) =>
      nextLift(
        lift({ step, reps: 8 }),
        { weightKg: 0, sets: [8, 8, 8].map((reps) => ({ target: 8, reps })) },
        DEFAULT_RULES,
        ex.CAL_SCAPULAR_PULL,
        inv,
        'kg',
        { progression: 'ladder', ladder: 'rr_squat', scheme: '3x5-8' },
      ).next.step;
    expect(climb(1.5)).toBe(2);
    expect(climb(Number.NaN)).toBe(1);
    expect(climb(Number.POSITIVE_INFINITY)).toBe(1);
  });

  test('a ladder that is not in the catalog leaves the lift alone', () => {
    const state = lift({ weightKg: 10 });
    const o = nextLift(
      state,
      { weightKg: 10, sets: [8, 8, 8].map((reps) => ({ target: 5, reps })) },
      DEFAULT_RULES,
      ex.CAL_PULLUP,
      inv,
      'kg',
      { progression: 'ladder', ladder: 'nope', scheme: '3x5-8' },
    );
    expect(o).toEqual({ next: state, change: 'none' });
  });

  test('a light day never moves a ladder', () => {
    expect(finish('rr_pullup', lift({ step: 0, reps: 8 }), 'hit', { intensity: 0.8 }).change).toBe('none');
  });

  test('120 good sessions climb one step at a time and never skip one', () => {
    let state = lift();
    const steps = [0];
    for (let i = 0; i < 120; i++) {
      state = finish('rr_pullup', state, 'hit').next;
      const step = state.step ?? 0;
      expect(step - (steps.at(-1) ?? 0)).toBeLessThanOrEqual(1);
      steps.push(step);
    }
    expect(new Set(steps)).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    expect(state.weightKg).toBeGreaterThan(0);
  });
});

describe('validateProgram with ladders', () => {
  test('a ladder program is valid', () => {
    expect(validateProgram(program(ladderSlot('rr_pullup'), ladderSlot('rr_squat')), ex)).toEqual([]);
  });
  type Row = [string, Slot[], RegExp];
  const rows: Row[] = [
    ['unknown ladder', [{ exercise: 'CAL_PULLUP', scheme: '3x5-8', ladder: 'nope' }], /unknown ladder nope/],
    [
      'the slot exercise is not the first step',
      [{ exercise: 'CAL_PULLUP', scheme: '3x5-8', ladder: 'rr_pullup' }],
      /must start at CAL_SCAPULAR_PULL/,
    ],
    ['two ladders share a step exercise', [ladderSlot('rr_pushup'), ladderSlot('six_pushup')], /share/],
    [
      'a ladder step repeats another slot of the day',
      [ladderSlot('rr_dip'), { exercise: 'DIPS', scheme: '3x5' }],
      /share|appears twice/,
    ],
    ['a zero-second hold', [{ exercise: 'CAL_PLANK', scheme: '3x0s' as Scheme }], /unknown scheme 3x0s/],
    ['a reversed hold range', [{ exercise: 'CAL_PLANK', scheme: '3x30-10s' as Scheme }], /unknown scheme/],
    [
      'ladder progression without a ladder',
      [{ exercise: 'CAL_PULLUP', scheme: '3x5-8', progression: 'ladder' }],
      /needs a ladder/,
    ],
    [
      'a ladder with another progression model',
      [{ ...ladderSlot('rr_pullup'), progression: 'linear' }],
      /ladder progression/,
    ],
  ];
  test.each(rows)('%s', (_name, slots, error) => {
    expect(validateProgram(program(...slots), ex).join('\n')).toMatch(error);
  });
});
