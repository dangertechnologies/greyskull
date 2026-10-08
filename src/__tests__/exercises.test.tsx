import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
  useStore.getState().setProgram(TEMPLATES.base);
});

test('create a custom exercise, use it in Day 1, load 60 kg, delete is refused until removed', async () => {
  renderRouter(routes(), { initialUrl: '/exercises/new' });
  expect(screen.getByLabelText('Save').props.accessibilityState.disabled).toBe(true);
  fireEvent.changeText(await screen.findByLabelText('Name'), 'Front squat');
  fireEvent.changeText(screen.getByLabelText('Good form'), 'Elbows up\n\nChest tall');
  fireEvent.press(screen.getByLabelText('Icon squat'));
  fireEvent.press(screen.getByLabelText('Save'));

  const created = useStore.getState().exercises.custom_front_squat;
  expect(created).toMatchObject({
    name: 'Front squat',
    shortName: 'Front',
    kind: 'barbell',
    custom: true,
    icon: 'squat',
    increment: { kg: 2.5, lb: 5 },
    goodForm: ['Elbows up', 'Chest tall'],
  });

  // Add it to Day 1 through the program editor (the picker lists custom exercises).
  act(() => router.push('/setup/days?edit=1'));
  fireEvent.press((await screen.findAllByText('Add exercise'))[0]);
  fireEvent.press(await screen.findByLabelText('Front squat'));
  fireEvent.press(screen.getByText('Save'));
  expect(await screen.findByText('Front squat')).toBeTruthy();
  expect(useStore.getState().lifts.custom_front_squat.weightKg).toBe(20);

  useStore.getState().setLift('custom_front_squat', { weightKg: 60 });
  expect(await screen.findByText('per side: 20')).toBeTruthy();

  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  act(() => router.push('/exercises/custom_front_squat'));
  fireEvent.press(await screen.findByLabelText('Delete'));
  expect(alert.mock.calls[0][1]).toMatch(/Day 1/);
  expect(useStore.getState().exercises.custom_front_squat).toBeDefined();

  const program = JSON.parse(JSON.stringify(useStore.getState().program)) as NonNullable<
    ReturnType<typeof useStore.getState>['program']
  >;
  program.days[0].slots = program.days[0].slots.filter((s) => s.exercise !== 'custom_front_squat');
  useStore.getState().setProgram(program);
  fireEvent.press(screen.getByLabelText('Delete'));
  expect(useStore.getState().exercises.custom_front_squat).toBeUndefined();
  alert.mockRestore();
});

test('the exercise list separates custom from built-in and flags those in the program', async () => {
  useStore.getState().upsertExercise({
    id: 'custom_x',
    name: 'X lift',
    shortName: 'X',
    icon: 'muscle',
    kind: 'barbell',
    increment: { kg: 1, lb: 2 },
    custom: true,
  });
  renderRouter(routes(), { initialUrl: '/exercises' });
  expect(await screen.findByText('X lift')).toBeTruthy();
  expect(screen.getByText('Squat')).toBeTruthy();
  expect(screen.getAllByText('in program').length).toBeGreaterThan(0);
});

test('built-in exercises cannot be deleted from the editor', async () => {
  renderRouter(routes(), { initialUrl: '/exercises/BENCH_PRESS' });
  await screen.findByText('Edit exercise');
  expect(screen.queryByLabelText('Delete')).toBeNull();
});
