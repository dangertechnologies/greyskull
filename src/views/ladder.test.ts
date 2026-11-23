import { builtInExercises } from '../catalog';
import { getLadder } from '../domain';
import { easeSummary, ladderAt, topOf, unlockRule } from './ladder';

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
  expect(easeSummary({ gapDays: 30, lifts: { L: lift(0, 2) } }, { L: lift(0, 3) })).toBe(
    '30 days since you last trained · ladders one step back',
  );
  expect(easeSummary({ gapDays: 15, lifts: { L: lift(0, 3) } }, { L: { ...lift(0, 3), reps: 7 } })).toBe(
    '15 days since you last trained · rep targets back to the bottom of the range',
  );
});
