import { render, screen } from '@testing-library/react-native';
import { builtInExercises } from '../catalog';
import { ThemeProvider } from '../design/theme';
import type { Program } from '../domain';
import { DEFAULT_RULES, MAX_SLOTS } from '../domain';
import { initialState, useStore } from '../store';
import { DaysEditor } from './DaysEditor';

const ids = Object.keys(builtInExercises()).filter((id) => builtInExercises()[id].kind === 'barbell');

const show = (slots: number) => {
  useStore.setState({ ...initialState(), hydrated: true });
  const program: Program = {
    template: 'custom',
    sessionsPerWeek: 3,
    rules: { ...DEFAULT_RULES },
    days: [
      { name: 'A', slots: ids.slice(0, slots).map((exercise) => ({ exercise, scheme: '3x5' as const })) },
    ],
  };
  render(
    <ThemeProvider>
      <DaysEditor program={program} onChange={jest.fn()} />
    </ThemeProvider>,
  );
};

test('a day with 20 exercises cannot take more', () => {
  show(MAX_SLOTS);
  expect(screen.getByRole('button', { name: 'Add exercise' }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Add alternating pair' }).props.accessibilityState.disabled).toBe(
    true,
  );
});

test('a day with 19 can', () => {
  show(MAX_SLOTS - 1);
  expect(screen.getByRole('button', { name: 'Add exercise' }).props.accessibilityState.disabled).toBe(false);
});
