import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { builtInExercises } from '../catalog';
import { ThemeProvider } from '../design/theme';
import { EMPTY_FILTERS, filterExercises } from '../exerciseFilter';
import { initialState, useStore } from '../store';
import { ExercisePicker } from './ExercisePicker';

const ex = builtInExercises();

const picker = (props: Partial<React.ComponentProps<typeof ExercisePicker>> = {}) => {
  const onPick = jest.fn();
  const onClose = jest.fn();
  render(
    <ThemeProvider>
      <ExercisePicker visible exercises={ex} onPick={onPick} onClose={onClose} {...props} />
    </ThemeProvider>,
  );
  return { onPick, onClose };
};
const count = async (n: number) =>
  waitFor(() => expect(screen.getByText(new RegExp(`^${n} results?$`))).toBeTruthy());

beforeEach(() => useStore.setState({ ...initialState(), hydrated: true }));

test('a search narrows the list and a pick reports the exercise id', async () => {
  const { onPick } = picker();
  fireEvent.changeText(screen.getByLabelText('Search exercises'), 'hand pu');
  fireEvent.press(await screen.findByLabelText('Handstand push-up'));
  expect(onPick).toHaveBeenCalledWith('CAL_HSPU');
});

test('the equipment, muscle, pattern and timed filters use the library filter', async () => {
  picker();
  fireEvent.press(screen.getByLabelText('Timed'));
  const timed = Object.values(ex).filter((e) => e.timed && !e.archived).length;
  await count(timed);
  fireEvent.changeText(screen.getByLabelText('Search exercises'), 'plank');
  const planks = filterExercises(Object.values(ex), { ...EMPTY_FILTERS, query: 'plank', timed: true }).length;
  await count(planks);
  expect(await screen.findByLabelText('Plank')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Timed'));
  fireEvent.changeText(screen.getByLabelText('Search exercises'), '');
  fireEvent.press(screen.getByLabelText('Equipment'));
  fireEvent.press(await screen.findByRole('checkbox', { name: 'Rings' }));
  const rings = Object.values(ex).filter((e) => e.equipment?.includes('rings') && !e.archived).length;
  await count(rings);
});

test('exercises already in the day are not offered', async () => {
  picker({ exclude: ['DEADLIFT'] });
  fireEvent.changeText(screen.getByLabelText('Search exercises'), 'deadlift');
  await screen.findByLabelText('Deadlift with Bands');
  expect(screen.queryByLabelText('Deadlift')).toBeNull();
});

test('nothing matching offers to clear the filters', async () => {
  picker();
  fireEvent.changeText(screen.getByLabelText('Search exercises'), 'zzzzzz');
  expect(await screen.findByText('No exercises match.')).toBeTruthy();
  fireEvent.press(screen.getByText('Clear filters'));
  expect(await screen.findByLabelText('Air Bike')).toBeTruthy();
  expect(screen.getByLabelText('Search exercises').props.value).toBe('');
});

test('My equipment is offered only when the gym is set', () => {
  picker();
  expect(screen.queryByLabelText('My equipment')).toBeNull();
});

test('My equipment hides what the gym cannot do', async () => {
  useStore.setState({ equipment: ['barbell'] });
  picker();
  fireEvent.press(await screen.findByLabelText('My equipment'));
  fireEvent.changeText(screen.getByLabelText('Search exercises'), 'deadlift');
  await screen.findByLabelText('Deadlift');
  expect(screen.queryByLabelText('Cable Deadlifts')).toBeNull();
});

test('closing clears the search and filters', async () => {
  const { onClose } = picker();
  fireEvent.changeText(screen.getByLabelText('Search exercises'), 'zzzzzz');
  fireEvent.press(screen.getByLabelText('Timed'));
  fireEvent.press(screen.getByText('Cancel'));
  expect(onClose).toHaveBeenCalled();
  expect(screen.getByLabelText('Search exercises').props.value).toBe('');
});
