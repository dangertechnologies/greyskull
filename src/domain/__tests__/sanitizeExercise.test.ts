import { sanitizeExercise } from '../sanitizeExercise';
import type { Exercise } from '../types';

const front: Exercise = {
  id: 'custom_front_squat',
  name: 'Front squat',
  shortName: 'Front',
  kind: 'barbell',
  increment: { kg: 2.5, lb: 5 },
  custom: true,
  equipment: ['barbell'],
  muscles: ['quadriceps'],
  goodForm: ['Elbows up'],
  url: 'https://example.com/front',
};

test('a clean custom exercise comes back unchanged', () => {
  expect(sanitizeExercise(front)).toEqual({ ok: true, exercise: front });
});

test('unknown fields and archived are dropped, links that are not http(s) are dropped', () => {
  for (const url of [
    'javascript:alert(1)',
    'file:///etc/passwd',
    'data:text/html,x',
    'intent://x#Intent;end',
  ])
    for (const key of ['url', 'video'] as const) {
      const r = sanitizeExercise({ ...front, [key]: url, archived: true, secret: 1, pictogram: 'x' });
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.exercise[key]).toBeUndefined();
      expect(r.exercise).not.toHaveProperty('archived');
      expect(r.exercise).not.toHaveProperty('secret');
      expect(r.exercise).not.toHaveProperty('pictogram');
    }
});

test('NaN, Infinity, negative, huge and prototype names are refused with the reason', () => {
  for (const bad of [
    { increment: { kg: Number.NaN, lb: 5 } },
    { increment: { kg: Number.POSITIVE_INFINITY, lb: 5 } },
    { increment: { kg: -1, lb: 5 } },
    { increment: { kg: 1e9, lb: 5 } },
    { step: { kg: 0.1, lb: 1 } },
    { barKg: { kg: -20, lb: 45 } },
    { barKg: { kg: 1e9, lb: 45 } },
    { barKg: { kg: 20, lb: Number.NaN } },
    { name: 'x'.repeat(101) },
    { description: 'x'.repeat(2001) },
    { goodForm: Array.from({ length: 21 }, () => 'tip') },
    { badForm: ['x'.repeat(301)] },
    { equipment: ['constructor'] },
    { muscles: ['__proto__'] },
    { secondary: ['toString'] },
    { pattern: 'hasOwnProperty' },
    { level: 'valueOf' },
    { kind: 'constructor' },
    { id: '' },
  ]) {
    const r = sanitizeExercise({ ...front, ...bad }, 'Exercise 3');
    expect([bad, r.ok]).toEqual([bad, false]);
  }
  expect(sanitizeExercise(null, 'Exercise 3')).toEqual({
    ok: false,
    error: 'Exercise 3 is not an exercise.',
  });
});
