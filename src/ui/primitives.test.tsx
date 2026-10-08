import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Text as RNText } from 'react-native';
import { builtInExercises } from '../catalog';
import { Button } from './Button';
import { Chip } from './Chip';
import { ExerciseBadge } from './ExerciseBadge';
import { ListRow } from './ListRow';
import { PlateStack, plateStyle } from './PlateStack';
import { SegmentedControl } from './SegmentedControl';
import { Sheet } from './Sheet';
import { SnackbarProvider, useSnackbar } from './Snackbar';

test('Button presses, gives a light haptic and is disabled when asked', () => {
  const impact = jest.spyOn(Haptics, 'impactAsync').mockResolvedValue(undefined);
  const onPress = jest.fn();
  render(<Button title="Start" onPress={onPress} testID="b" />);
  fireEvent.press(screen.getByTestId('b'));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(impact).toHaveBeenCalled();
  render(<Button title="Nope" disabled onPress={onPress} />);
  expect(screen.getByRole('button', { name: 'Nope' }).props.accessibilityState.disabled).toBe(true);
});

test('Chip and SegmentedControl expose radio/checkbox state', () => {
  const onChange = jest.fn();
  render(
    <>
      <SegmentedControl
        accessibilityLabel="Unit"
        options={[
          { value: 'kg', label: 'kg' },
          { value: 'lb', label: 'lb' },
        ]}
        value="kg"
        onChange={onChange}
      />
      <Chip label="1.25" role="checkbox" selected onPress={onChange} />
    </>,
  );
  expect(screen.getByRole('radio', { name: 'kg' }).props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByRole('radio', { name: 'lb' }));
  expect(onChange).toHaveBeenCalledWith('lb');
  expect(screen.getByRole('checkbox', { name: '1.25' }).props.accessibilityState.checked).toBe(true);
});

test('ListRow shows title, subtitle and value, and routes presses', () => {
  const onPress = jest.fn();
  render(
    <ListRow title="Rest time" subtitle="Between sets" value="90 s" onPress={onPress} accessory="chevron" />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Rest time, Between sets, 90 s' }));
  expect(onPress).toHaveBeenCalled();
});

test('ExerciseBadge: a pictogram for built-ins, letters for custom exercises with an abbreviation', () => {
  const ex = builtInExercises();
  const custom = { id: 'custom_front_squat', name: 'Front squat', kind: 'barbell', custom: true } as const;
  render(
    <>
      <ExerciseBadge exercise={ex.MILITARY_PRESS} />
      <ExerciseBadge exercise={{ ...custom, abbr: 'fs' }} size={40} />
      <ExerciseBadge exercise={{ ...custom, id: 'custom_sled', kind: 'machine' }} size={40} />
    </>,
  );
  // Badges are decorative (hidden from screen readers), so query hidden elements too.
  const hidden = { includeHiddenElements: true };
  expect(screen.getByTestId('exercise-icon-MILITARY_PRESS', hidden)).toBeTruthy();
  expect(screen.getByText('FS', hidden)).toBeTruthy();
  expect(screen.getByTestId('exercise-icon-kind:machine', hidden)).toBeTruthy();
});

test('PlateStack draws one rect per plate and describes them in text', () => {
  render(<PlateStack kg={100} unit="kg" />);
  expect(screen.getByText('per side: 25 + 15')).toBeTruthy();
  expect(screen.getByLabelText('per side: 25 + 15')).toBeTruthy();
  render(<PlateStack kg={20} unit="kg" />);
  expect(screen.getByText('bar only')).toBeTruthy();
});

test('plate colours follow the IWF convention for kg and are neutral for lb', () => {
  expect(plateStyle(25, 'kg').color).toBe('#D32F2F');
  expect(plateStyle(20, 'kg').color).toBe('#1565C0');
  expect(plateStyle(15, 'kg').color).toBe('#F9A825');
  expect(plateStyle(10, 'kg').color).toBe('#2E7D32');
  expect(plateStyle(5, 'kg').height).toBeLessThan(plateStyle(10, 'kg').height);
  expect(plateStyle(0.5, 'kg').height).toBeLessThan(plateStyle(2.5, 'kg').height);
  expect(plateStyle(45, 'lb').height).toBe(100);
});

test('Sheet renders its content only while visible and closes from the backdrop', () => {
  const onClose = jest.fn();
  const { rerender } = render(
    <Sheet visible={false} onClose={onClose} title="Weight">
      <RNText>inside</RNText>
    </Sheet>,
  );
  expect(screen.queryByText('inside')).toBeNull();
  rerender(
    <Sheet visible onClose={onClose} title="Weight">
      <RNText>inside</RNText>
    </Sheet>,
  );
  expect(screen.getByText('inside')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close', { includeHiddenElements: true })); // hidden from screen readers on purpose
  expect(onClose).toHaveBeenCalled();
});

test('Snackbar shows a message with an action and goes away after it runs', () => {
  function Trigger({ onUndo }: { onUndo(): void }) {
    const snackbar = useSnackbar();
    return (
      <RNText
        onPress={() =>
          snackbar.show({ message: 'Workout skipped', action: { label: 'Undo', onPress: onUndo } })
        }
      >
        go
      </RNText>
    );
  }
  const onUndo = jest.fn();
  render(
    <SnackbarProvider>
      <Trigger onUndo={onUndo} />
    </SnackbarProvider>,
  );
  fireEvent.press(screen.getByText('go'));
  expect(screen.getByText('Workout skipped')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
  expect(onUndo).toHaveBeenCalled();
  expect(screen.queryByText('Workout skipped')).toBeNull();
});
