import type { Equipment, Exercise, Kind } from '../domain';
import { TEMPLATES } from '../domain';
import {
  CATEGORIES,
  categoryOf,
  equipmentFit,
  fitLabel,
  nameTaken,
  uniqueProgramName,
} from '../programPicker';

const ex = (id: string, kind: Kind, equipment?: Equipment[]): Exercise => ({
  id,
  name: id,
  shortName: id,
  kind,
  increment: { kg: 2.5, lb: 5 },
  equipment,
});
// The exercises of the Greyskull LP plan: three barbell lifts and a deadlift.
const exercises: Record<string, Exercise> = Object.fromEntries(
  [
    ex('MILITARY_PRESS', 'barbell', ['barbell']),
    ex('BENCH_PRESS', 'barbell', ['barbell', 'bench']),
    ex('BARBELL_SQUAT', 'barbell', ['barbell']),
    ex('DEADLIFT', 'barbell', ['barbell']),
  ].map((e) => [e.id, e]),
);

test('built-in plans have a category from the fixed list; unknown ids have none', () => {
  expect(categoryOf('base')).toBe('Strength');
  expect(categoryOf('allpro')).toBe('Hypertrophy');
  expect(categoryOf('shoulder-mobilex')).toBe('Mobility');
  expect(categoryOf('custom')).toBeNull();
  expect(CATEGORIES).toEqual(['Strength', 'Hypertrophy', 'Calisthenics', 'Skills', 'Mobility']);
});

describe('equipment fit', () => {
  test('is unknown while the user has not set their equipment', () => {
    expect(equipmentFit(TEMPLATES.base, exercises, [])).toEqual({ status: 'unknown' });
    expect(fitLabel({ status: 'unknown' })).toBe('Equipment not set');
  });

  test('a barbell plan needs a barbell', () => {
    const fit = equipmentFit(TEMPLATES.base, exercises, ['dumbbell']);
    expect(fit.status).toBe('missing');
    expect(fit.status === 'missing' && fit.missing).toContain('barbell');
    expect(fitLabel(fit)).toMatch(/^Missing: barbell/);
  });

  test('owning everything the plan lists fits', () => {
    expect(equipmentFit(TEMPLATES.base, exercises, ['barbell', 'bench']).status).toBe('fits');
  });

  test('"none" needs nothing and a tuple slot counts both exercises', () => {
    const program = {
      ...TEMPLATES.base,
      days: [
        {
          name: 'A',
          slots: [{ exercise: ['PUSH_UP', 'BENCH_PRESS'] as [string, string], scheme: '3x5' as const }],
        },
      ],
    };
    const own = { ...exercises, PUSH_UP: ex('PUSH_UP', 'bodyweight', ['none']) };
    expect(equipmentFit(program, own, ['dumbbell'])).toEqual({
      status: 'missing',
      missing: ['barbell', 'bench'],
    });
    expect(equipmentFit(program, own, ['barbell', 'bench']).status).toBe('fits');
  });

  test('an exercise without listed equipment needs what its kind implies', () => {
    const program = {
      ...TEMPLATES.base,
      days: [{ name: 'A', slots: [{ exercise: 'X', scheme: '3x5' as const }] }],
    };
    expect(equipmentFit(program, { X: ex('X', 'kettlebell') }, ['barbell'])).toEqual({
      status: 'missing',
      missing: ['kettlebell'],
    });
  });

  test('ladder steps count', () => {
    const program = {
      ...TEMPLATES.base,
      days: [{ name: 'A', slots: [{ exercise: 'CAL_PULLUP', scheme: '3x5' as const, ladder: 'rr_pullup' }] }],
    };
    const own = {
      CAL_PULLUP: ex('CAL_PULLUP', 'bodyweight', ['none']),
      CAL_ARCH_HANG: ex('CAL_ARCH_HANG', 'bodyweight', ['pull-up-bar']),
    };
    expect(equipmentFit(program, own, ['rings'])).toEqual({ status: 'missing', missing: ['pull-up-bar'] });
  });
});

describe('program names', () => {
  test('a taken name gets the next free number, ignoring case', () => {
    expect(uniqueProgramName('GSLP', [])).toBe('GSLP');
    expect(uniqueProgramName('GSLP', ['gslp'])).toBe('GSLP 2');
    expect(uniqueProgramName('GSLP', ['GSLP', 'GSLP 2', ' gslp 3 '])).toBe('GSLP 4');
    expect(nameTaken('  Mine ', ['mine'])).toBe(true);
    expect(nameTaken('Mine', ['Yours'])).toBe(false);
  });
});
