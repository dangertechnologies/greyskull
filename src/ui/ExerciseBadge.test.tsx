import { render, screen } from '@testing-library/react-native';
import { builtInExercises } from '../catalog';
import { ExerciseBadge, pictogramFor } from './ExerciseBadge';
import { EXERCISE_ICONS, KIND_ICONS } from './exerciseIcons';
import { PICTOGRAMS } from './pictograms';

const base = { id: 'X', name: 'X', kind: 'bodyweight' } as const;

test('the lift-specific drawing wins, then the catalog pictogram, then the kind', () => {
  expect(pictogramFor({ ...base, id: 'DEADLIFT', pictogram: 'plank' }).icon).toBe(EXERCISE_ICONS.DEADLIFT);
  expect(pictogramFor({ ...base, pictogram: 'plank' })).toEqual({
    key: 'pictogram:plank',
    icon: PICTOGRAMS.plank,
  });
  expect(pictogramFor({ ...base, pictogram: 'no-such-drawing' }).icon).toBe(KIND_ICONS.bodyweight);
  expect(pictogramFor({ ...base, kind: 'kettlebell' }).key).toBe('kind:kettlebell');
});

test('every built-in resolves to a drawing', () => {
  for (const e of Object.values(builtInExercises())) expect(pictogramFor(e).icon.d.length).toBeGreaterThan(0);
});

test('a custom exercise with an abbreviation shows its letters even when it has a pictogram', () => {
  render(<ExerciseBadge exercise={{ ...base, custom: true, abbr: 'ab', pictogram: 'plank' }} size={160} />);
  expect(screen.getByText('AB', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByTestId('exercise-icon-pictogram:plank', { includeHiddenElements: true })).toBeNull();
});

test('a built-in catalog entry draws its pictogram at the large size', () => {
  render(<ExerciseBadge exercise={builtInExercises().CAL_PUSHUP} size={160} />);
  expect(screen.getByTestId('exercise-icon-pictogram:push-up', { includeHiddenElements: true })).toBeTruthy();
});
