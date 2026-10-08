import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { NumberStepper, REPEAT_MS } from './NumberStepper';

function Harness({ onChange, start = 10 }: { onChange?(v: number): void; start?: number }) {
  const [v, setV] = useState(start);
  return (
    <NumberStepper
      label="Reps"
      value={v}
      step={1}
      min={0}
      format={(x) => `${x} reps`}
      onChange={(x) => {
        setV(x);
        onChange?.(x);
      }}
    />
  );
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('a tap is exactly one step', () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);
  fireEvent.press(screen.getByLabelText('Increase'));
  expect(onChange.mock.calls).toEqual([[11]]);
  expect(screen.getByText('11 reps')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Decrease'));
  expect(screen.getByText('10 reps')).toBeTruthy();
});

test('a long press repeats every 150 ms until release', () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);
  const inc = screen.getByLabelText('Increase');
  fireEvent(inc, 'longPress');
  expect(onChange).toHaveBeenCalledTimes(1); // first step immediately
  act(() => void jest.advanceTimersByTime(REPEAT_MS * 3));
  expect(onChange).toHaveBeenCalledTimes(4);
  expect(onChange).toHaveBeenLastCalledWith(14);
  fireEvent(inc, 'pressOut');
  act(() => void jest.advanceTimersByTime(REPEAT_MS * 5));
  expect(onChange).toHaveBeenCalledTimes(4);
});

test('repeat stops at the limit and does not fire past it', () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} start={1} />);
  fireEvent(screen.getByLabelText('Decrease'), 'longPress');
  act(() => void jest.advanceTimersByTime(REPEAT_MS * 4));
  expect(onChange.mock.calls).toEqual([[0]]);
});

test('unmounting clears the repeat timer', () => {
  const onChange = jest.fn();
  const { unmount } = render(<Harness onChange={onChange} />);
  fireEvent(screen.getByLabelText('Increase'), 'longPress');
  unmount();
  act(() => void jest.advanceTimersByTime(REPEAT_MS * 5));
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('screen readers can adjust the value with increment/decrement actions', () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);
  const value = screen.getByRole('adjustable');
  fireEvent(value, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  fireEvent(value, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  expect(onChange.mock.calls).toEqual([[11], [10]]);
});
