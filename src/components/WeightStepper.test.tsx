import { fireEvent, render, screen } from '@testing-library/react-native';
import { builtInExercises } from '../catalog';
import { DEFAULT_INVENTORY } from '../domain';
import { WeightStepper } from './WeightStepper';

const ex = builtInExercises();

function stepFrom(id: string, kg: number, dir: 'Increase' | 'Decrease'): number {
  const onChange = jest.fn();
  render(
    <WeightStepper exercise={ex[id]} kg={kg} onChange={onChange} unit="kg" inventory={DEFAULT_INVENTORY} />,
  );
  fireEvent.press(screen.getByLabelText(dir));
  return onChange.mock.calls[0]?.[0];
}

test('an EZ-bar lift steps through totals on its own 10 kg bar', () => {
  expect(stepFrom('EZ_BAR_CURL', 10, 'Increase')).toBe(12.5);
});

test('a kettlebell lift steps to the next owned bell', () => {
  expect(stepFrom('ALTERNATING_FLOOR_PRESS', 16, 'Increase')).toBe(20);
  expect(stepFrom('ALTERNATING_FLOOR_PRESS', 16, 'Decrease')).toBe(12);
});

test('bodyweight steps added load in single plates and back down to none', () => {
  expect(stepFrom('DIPS', 0, 'Increase')).toBe(1.25);
  expect(stepFrom('DIPS', 1.25, 'Decrease')).toBe(0);
  render(<WeightStepper exercise={ex.DIPS} kg={10} onChange={jest.fn()} unit="kg" />);
  expect(screen.getByText('+10.0 kg')).toBeTruthy();
});
