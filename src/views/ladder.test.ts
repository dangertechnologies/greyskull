import { builtInExercises } from '../catalog';
import { getLadder } from '../domain';
import { easeSummary, ladderAt, ladderMove, topOf, unlockRule } from './ladder';

const pull = getLadder('rr_pullup')!;
const lift = (weightKg: number, step?: number) => ({ weightKg, startKg: 0, fails: 0, step });

test('a ladder key resolves to its step exercise, with the stored step made whole', () => {
  const at = ladderAt('rr_pullup', { step: 1.5 }, builtInExercises());
  expect(at?.step).toBe(1);
  expect(at?.exercise?.id).toBe('CAL_ARCH_HANG');
  expect(ladderAt('BENCH_PRESS', undefined, builtInExercises())).toBeUndefined();
});

test('the top of a scheme in reps or seconds', () => {
  expect(topOf('3x5-8')).toBe('3×8');
  expect(topOf('3x10-30s')).toBe('3×30 s');
  expect(topOf('3x5')).toBe('3×5');
  expect(topOf('3xAMRAP')).toBeUndefined();
});

test('the unlock rule names what moves the lift on', () => {
  expect(unlockRule(pull, 0, '3x5-8')).toBe('3×8 to move on');
  expect(unlockRule(pull, 1, '3x5-8')).toBe('3×30 s to move on');
  expect(unlockRule(pull, 3, '3x5-8')).toBe('3×8 with the lightest band to move on');
  expect(unlockRule(pull, pull.steps.length - 1, '3x5-8')).toBe('3×8, then add load');
});

test('the ease banner says what the ease changed', () => {
  expect(easeSummary({ gapDays: 23, lifts: { A: lift(90) } }, { A: lift(100) })).toBe(
    '23 days since you last trained · weights eased back 10 %',
  );
  // Each lift's own drop from the real weights: 10 % on 100 kg, 25 % on +10 kg added load rounded to plates.
  expect(
    easeSummary({ gapDays: 30, lifts: { A: lift(90), D: lift(7.5) } }, { A: lift(100), D: lift(10) }),
  ).toBe('30 days since you last trained · weights eased back up to 25 %');
  expect(easeSummary({ gapDays: 30, lifts: { L: lift(0, 2) } }, { L: lift(0, 3) })).toBe(
    '30 days since you last trained · ladders one step back',
  );
  expect(easeSummary({ gapDays: 15, lifts: { L: lift(0, 3) } }, { L: { ...lift(0, 3), reps: 7 } })).toBe(
    '15 days since you last trained · rep targets back to the bottom of the range',
  );
});

test('the celebration names a step up, or a band change by the band order', () => {
  const bands = [
    { id: 'black', label: 'Black' },
    { id: 'red', label: 'Red' },
    { id: 'green', label: 'Green' },
  ];
  const ex = builtInExercises();
  const at = (step: number, bandId?: string) => ({ ...lift(0, step), ...(bandId ? { bandId } : {}) });
  expect(ladderMove(at(2), at(3, 'black'), pull, bands, ex)).toEqual({ step: 'Band-assisted pull-up' });
  expect(ladderMove(at(3, 'black'), at(3, 'red'), pull, bands, ex)).toEqual({
    band: { label: 'Red', change: 'lighter' },
  });
  expect(ladderMove(at(3, 'red'), at(3, 'black'), pull, bands, ex)).toEqual({
    band: { label: 'Black', change: 'heavier' },
  });
  expect(ladderMove(at(3), at(3, 'black'), pull, bands, ex)).toEqual({
    band: { label: 'Black', change: 'start' },
  });
  expect(ladderMove(at(3, 'red'), at(3, 'red'), pull, bands, ex)).toEqual({});
});
