import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import { program as current, lifts, programId, setLift, setProgram } from '../__fixtures__/oneProgram';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
  setProgram(TEMPLATES.base);
});

test('create a custom exercise, use it in Day 1, load 60 kg, delete is refused until removed', async () => {
  await renderRouter(routes(), { initialUrl: '/exercises/new' });
  expect((await screen.findByLabelText('Save')).props.accessibilityState.disabled).toBe(true);
  fireEvent.changeText(await screen.findByLabelText('Name'), 'Front squat');
  fireEvent.changeText(screen.getByLabelText('Good form'), 'Elbows up\n\nChest tall');
  fireEvent.changeText(screen.getByLabelText('Abbreviation'), 'fs');
  fireEvent.press(screen.getByLabelText('Save'));

  const created = useStore.getState().exercises.custom_front_squat;
  expect(created).toMatchObject({
    name: 'Front squat',
    shortName: 'Front',
    kind: 'barbell',
    custom: true,
    abbr: 'FS',
    increment: { kg: 2.5, lb: 5 },
    goodForm: ['Elbows up', 'Chest tall'],
  });

  // Add it to Day 1 through the program editor (the picker lists custom exercises).
  act(() => router.push(`/setup/days?edit=1&program=${programId()}`));
  fireEvent.press((await screen.findAllByText('Add exercise'))[0]);
  fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Front squat');
  fireEvent.press(await screen.findByLabelText('Front squat'));
  fireEvent.press(screen.getByText('Save'));
  expect((await screen.findAllByText('Front squat')).length).toBeGreaterThan(0);
  expect(lifts().custom_front_squat.weightKg).toBe(20);

  setLift('custom_front_squat', { weightKg: 60 });
  act(() => router.push(`/program/${programId()}`));
  expect((await screen.findAllByText('per side: 20')).length).toBeGreaterThan(0);

  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  act(() => router.push('/exercises/custom_front_squat?edit=1'));
  fireEvent.press(await screen.findByLabelText('Delete exercise'));
  expect(alert.mock.calls[0][1]).toMatch(/Day 1/);
  expect(useStore.getState().exercises.custom_front_squat).toBeDefined();

  const program = JSON.parse(JSON.stringify(current())) as ReturnType<typeof current>;
  program.days[0].slots = program.days[0].slots.filter((s) => s.exercise !== 'custom_front_squat');
  setProgram(program);
  fireEvent.press(screen.getByLabelText('Delete exercise'));
  expect(useStore.getState().exercises.custom_front_squat).toBeUndefined();
  alert.mockRestore();
});

test('the library lists every exercise, flags custom ones and those in the program, and searches by name', async () => {
  useStore.getState().upsertExercise({
    id: 'custom_x',
    name: 'X lift',
    shortName: 'X',
    kind: 'barbell',
    increment: { kg: 1, lb: 2 },
    custom: true,
  });
  await renderRouter(routes(), { initialUrl: '/exercises' });
  const total = Object.values(useStore.getState().exercises).length;
  expect(await screen.findByLabelText('Search exercises')).toBeTruthy();
  expect(screen.getByPlaceholderText(`Search ${total} exercises`)).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText('Search exercises'), 'overhead press');
  expect(await screen.findByLabelText(/^Overhead press, .*in your program/)).toBeTruthy();
  expect(screen.getAllByText('In program').length).toBeGreaterThan(0);

  fireEvent.changeText(screen.getByLabelText('Search exercises'), 'x lift');
  expect(await screen.findByText('1 result')).toBeTruthy();
  expect(screen.getByText('Custom')).toBeTruthy();
  expect(screen.getByLabelText(/^X lift/)).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText('Search exercises'), 'qqqq');
  expect(await screen.findByText('No exercises match')).toBeTruthy();
  fireEvent.press(screen.getByText('Clear filters'));
  expect(await screen.findByLabelText('Search exercises')).toHaveProp('value', '');
});

test('filter chips open a sheet; picked values show as removable pills with a result count', async () => {
  await renderRouter(routes(), { initialUrl: '/exercises' });
  fireEvent.press(await screen.findByRole('checkbox', { name: 'Equipment' }));
  fireEvent.press(await screen.findByRole('checkbox', { name: 'Pull-up bar' }));
  fireEvent.press(screen.getByText('Done'));
  const first = await screen.findByLabelText('Remove filter Pull-up bar');
  expect(first).toBeTruthy();
  const count = screen.getByText(/· \d+ results?/);
  const n = Number(/(\d+)/.exec(count.props.children.join(''))?.[1]);
  expect(n).toBeGreaterThan(5);
  expect(n).toBeLessThan(Object.keys(useStore.getState().exercises).length / 2);

  fireEvent.press(screen.getByRole('checkbox', { name: 'Timed' }));
  expect(await screen.findByText(/· \d+ results?/)).toBeTruthy();
  fireEvent.press(first);
  expect(screen.queryByLabelText('Remove filter Pull-up bar')).toBeNull();
});

test('"My equipment" appears once the gym is set and hides what the gym cannot do', async () => {
  await renderRouter(routes(), { initialUrl: '/exercises' });
  await screen.findByLabelText('Search exercises');
  expect(screen.queryByRole('checkbox', { name: 'My equipment' })).toBeNull();
  act(() => useStore.getState().setEquipment(['rings']));
  fireEvent.press(await screen.findByRole('checkbox', { name: 'My equipment' }));
  fireEvent.changeText(screen.getByLabelText('Search exercises'), 'bench press');
  expect(await screen.findByText('No exercises match')).toBeTruthy();
});

test('the detail screen shows the pictogram, muscles, description and a form video link', async () => {
  await renderRouter(routes(), { initialUrl: '/exercises/BENCH_PRESS' });
  const e = useStore.getState().exercises.BENCH_PRESS;
  expect((await screen.findAllByText(e.name)).length).toBeGreaterThan(0);
  expect(screen.getByTestId('exercise-icon-BENCH_PRESS', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByText('Chest')).toBeTruthy();
  expect(screen.getByText(e.description as string)).toBeTruthy();
  expect(screen.getByLabelText(`Watch a form video: ${e.name}`)).toBeTruthy();
  fireEvent.press(screen.getByLabelText(`Edit ${e.name}`));
  expect(await screen.findByText('Short name')).toBeTruthy();
});

test('editing a built-in changes only the allowed fields and shows its shipped text as read-only', async () => {
  await renderRouter(routes(), { initialUrl: '/exercises/CAL_PUSHUP?edit=1' });
  const shipped = useStore.getState().exercises.CAL_PUSHUP;
  expect(await screen.findByText('Short name')).toBeTruthy();
  expect(screen.queryByLabelText('Description')).toBeNull();
  expect(screen.getByText(shipped.description as string)).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Name'), 'Floor push-up');
  fireEvent.press(screen.getByRole('checkbox', { name: 'Rings' }));
  fireEvent.press(screen.getByLabelText('Save'));
  const saved = useStore.getState().exercises.CAL_PUSHUP;
  expect(saved.name).toBe('Floor push-up');
  expect(saved.equipment).toEqual([...(shipped.equipment ?? []), 'rings']);
  expect(saved.description).toBe(shipped.description);
  expect(saved.goodForm).toEqual(shipped.goodForm);
});

test('a bodyweight exercise keeps an editable added-weight step', async () => {
  await renderRouter(routes(), { initialUrl: '/exercises/new' });
  fireEvent.changeText(await screen.findByLabelText('Name'), 'Ring dip');
  fireEvent.press(screen.getByRole('radio', { name: 'Bodyweight' }));
  expect(screen.getByText('Added weight')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Save'));
  expect(useStore.getState().exercises.custom_ring_dip).toMatchObject({
    kind: 'bodyweight',
    equipment: ['none'],
    increment: { kg: 2.5, lb: 5 },
  });
});

test('built-in exercises cannot be deleted from the editor', async () => {
  await renderRouter(routes(), { initialUrl: '/exercises/BENCH_PRESS?edit=1' });
  await screen.findByText('Short name');
  expect(screen.queryByLabelText('Delete exercise')).toBeNull();
});
