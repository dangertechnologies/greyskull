import { customId } from './exerciseId';

test('slugifies and keeps ids unique', () => {
  expect(customId('Front squat', {})).toBe('custom_front_squat');
  expect(customId('  Frönt   Squat!! ', {})).toBe('custom_front_squat');
  expect(customId('Front squat', { custom_front_squat: 1 })).toBe('custom_front_squat_2');
  expect(customId('Front squat', { custom_front_squat: 1, custom_front_squat_2: 1 })).toBe(
    'custom_front_squat_3',
  );
  expect(customId('???', {})).toBe('custom_exercise');
});
