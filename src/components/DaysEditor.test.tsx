import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
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

test('removing a day keeps the later days as the same rows, not the same positions', () => {
  useStore.setState({ ...initialState(), hydrated: true });
  const day = (name: string) => ({ name, slots: [{ exercise: ids[0], scheme: '3x5' as const }] });
  const start: Program = {
    template: 'custom',
    sessionsPerWeek: 3,
    rules: { ...DEFAULT_RULES },
    days: [day('A'), day('B'), day('C')],
  };
  function Host() {
    const [program, setProgram] = useState(start);
    return <DaysEditor program={program} onChange={setProgram} />;
  }
  render(
    <ThemeProvider>
      <Host />
    </ThemeProvider>,
  );
  const third = screen.getByLabelText('Name of day 3');
  fireEvent.press(screen.getByLabelText('Remove B'));
  // Day C is now day 2, and it is still the row that was there before (a native text field keeps its focus).
  const moved = screen.getByLabelText('Name of day 2');
  expect(moved.props.value).toBe('C');
  expect(moved).toBe(third);
});
