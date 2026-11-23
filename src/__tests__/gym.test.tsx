import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import { moveBand, newBandId } from '../components/GymEquipment';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

const withCredits = () => ({ ...routes(), credits: require('../../app/credits') });
const state = () => useStore.getState();

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
  state().addProgram({ ...TEMPLATES.base, name: 'Test program' });
});

test('band ids are the smallest free number and moving keeps the others in order', () => {
  expect(newBandId([])).toBe('band_1');
  expect(newBandId([{ id: 'band_1', label: 'a' }])).toBe('band_2');
  expect(newBandId([{ id: 'band_2', label: 'a' }])).toBe('band_1');
  const list = ['a', 'b', 'c'].map((id) => ({ id, label: id }));
  expect(moveBand(list, 0, 2).map((b) => b.id)).toEqual(['b', 'c', 'a']);
  expect(moveBand(list, 1, -1)).toBe(list);
  expect(moveBand(list, 2, 3)).toBe(list);
});

test('settings: tick equipment, and bands and kettlebells appear when ticked', async () => {
  await renderRouter(routes(), { initialUrl: '/settings' });
  const rings = await screen.findByRole('checkbox', { name: 'Rings' });
  expect(rings.props.accessibilityState.checked).toBe(false);
  expect(screen.queryByRole('header', { name: 'Resistance bands' })).toBeNull();
  expect(screen.queryByText('Kettlebells')).toBeNull();
  fireEvent.press(rings);
  fireEvent.press(screen.getByRole('checkbox', { name: 'Resistance bands' }));
  fireEvent.press(screen.getByRole('checkbox', { name: 'Kettlebell' }));
  expect(state().equipment).toEqual(['rings', 'bands', 'kettlebell']);
  expect(screen.getByRole('header', { name: 'Resistance bands' })).toBeTruthy();
  expect(screen.getByText('Kettlebells')).toBeTruthy();
  fireEvent.press(screen.getByRole('checkbox', { name: 'Rings' }));
  expect(state().equipment).toEqual(['bands', 'kettlebell']);
});

test('settings: add, rename, reorder and delete bands; ids stay put', async () => {
  state().setEquipment(['bands']);
  await renderRouter(routes(), { initialUrl: '/settings' });
  fireEvent.press(await screen.findByText('Add band'));
  fireEvent.press(screen.getByText('Add band'));
  expect(state().bands).toEqual([
    { id: 'band_1', label: 'Band 1' },
    { id: 'band_2', label: 'Band 2' },
  ]);
  fireEvent.changeText(screen.getByLabelText('Band 1 name'), 'Red');
  fireEvent.press(screen.getByLabelText('Move Red down'));
  expect(state().bands).toEqual([
    { id: 'band_2', label: 'Band 2' },
    { id: 'band_1', label: 'Red' },
  ]);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.style === 'destructive')?.onPress?.();
  });
  fireEvent.press(screen.getByLabelText('Delete Red'));
  expect(state().bands).toEqual([{ id: 'band_2', label: 'Band 2' }]);
  alert.mockRestore();
  fireEvent.press(screen.getByText('Add band'));
  expect(state().bands.map((b) => b.id)).toEqual(['band_2', 'band_1']); // a freed id may be reused, never a taken one
});

test('settings: kettlebell sizes toggle and a new size is added in order', async () => {
  state().setEquipment(['kettlebell']);
  await renderRouter(routes(), { initialUrl: '/settings' });
  fireEvent.press(await screen.findByRole('checkbox', { name: '16 kg' }));
  expect(state().inventory.kettlebellsKg).toEqual([8, 12, 20, 24, 28, 32]);
  fireEvent.press(screen.getByRole('checkbox', { name: '+ Add' }));
  const up = (await screen.findAllByLabelText('Increase'))[0]; // the sheet comes before the rest-time stepper
  fireEvent.press(up);
  fireEvent.press(up);
  fireEvent.press(screen.getByText('Add'));
  expect(state().inventory.kettlebellsKg).toEqual([8, 12, 14, 20, 24, 28, 32]);
});

test('settings: the ease-back switch writes breakDeload', async () => {
  await renderRouter(routes(), { initialUrl: '/settings' });
  const sw = await screen.findByLabelText('Ease back after a break');
  expect(state().breakDeload).toBe(true);
  fireEvent(sw, 'valueChange', false);
  expect(state().breakDeload).toBe(false);
});

test('setup: the gym step has the equipment checklist', async () => {
  useStore.setState({ ...initialState(), hydrated: true });
  await renderRouter(routes(), { initialUrl: '/setup/gym' });
  fireEvent.press(await screen.findByRole('checkbox', { name: 'Pull-up bar' }));
  expect(state().equipment).toEqual(['pull-up-bar']);
  expect(screen.getByText('Ease back after a break')).toBeTruthy();
});

test('credits name free-exercise-db and its licence, and say descriptions are generated', async () => {
  await renderRouter(withCredits(), { initialUrl: '/credits' });
  expect(await screen.findByText('free-exercise-db')).toBeTruthy();
  expect(screen.getByText('Unlicense')).toBeTruthy();
  expect(screen.getByText(/generated from those facts/)).toBeTruthy();
  act(() => router.back());
});
