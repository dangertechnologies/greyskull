import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import { defaultBandLabel, moveBand, newBandId } from '../components/GymEquipment';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

const withCredits = () => ({ ...routes(), credits: require('../../app/credits') });
const state = () => useStore.getState();

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
  state().addProgram({ ...TEMPLATES.base, name: 'Test program' });
});

test('a new band id is never one that was used before; moving keeps the others in order', () => {
  const seen = new Set<string>();
  let list: { id: string; label: string }[] = [];
  for (let i = 0; i < 50; i++) {
    const id = newBandId(list);
    expect(seen.has(id)).toBe(false);
    seen.add(id);
    list = [...list, { id, label: `b${i}` }];
    if (i % 2 === 0) list = list.slice(1); // deleting never frees an id
  }
  expect(newBandId([{ id: 'band_1', label: 'old' }])).not.toBe('band_1'); // ids from before stay as they are
  expect(defaultBandLabel([])).toBe('Band 1');
  expect(
    defaultBandLabel([
      { id: 'x', label: 'Band 1' },
      { id: 'y', label: 'band 3' },
    ]),
  ).toBe('Band 2');
  const moving = ['a', 'b', 'c'].map((id) => ({ id, label: id }));
  expect(moveBand(moving, 0, 2).map((b) => b.id)).toEqual(['b', 'c', 'a']);
  expect(moveBand(moving, 1, -1)).toBe(moving);
  expect(moveBand(moving, 2, 3)).toBe(moving);
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

test('settings: add, rename, reorder and delete bands; a deleted band id is not reused', async () => {
  state().setEquipment(['bands']);
  await renderRouter(routes(), { initialUrl: '/settings' });
  fireEvent.press(await screen.findByText('Add band'));
  fireEvent.press(screen.getByText('Add band'));
  const [first, second] = state().bands;
  expect([first.label, second.label]).toEqual(['Band 1', 'Band 2']);
  expect(first.id).not.toBe(second.id);

  fireEvent.changeText(screen.getByLabelText('Band 1 name'), '  Red ');
  expect(state().bands[0].label).toBe('Red');
  fireEvent.changeText(screen.getByLabelText('Band 1 name'), '   ');
  expect(state().bands[0].label).toBe('Red'); // an empty name is never stored
  fireEvent(screen.getByLabelText('Band 1 name'), 'blur');
  expect(screen.getByLabelText('Band 1 name').props.value).toBe('Red');

  fireEvent.press(screen.getByLabelText('Move Red down'));
  expect(state().bands.map((b) => b.id)).toEqual([second.id, first.id]);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.style === 'destructive')?.onPress?.();
  });
  fireEvent.press(screen.getByLabelText('Delete Red'));
  expect(state().bands).toEqual([second]);
  alert.mockRestore();
  fireEvent.press(screen.getByText('Add band'));
  const added = state().bands[1];
  expect(added.id).not.toBe(first.id);
  expect(added.label).toBe('Band 1');
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

test('credits: dataset declares the Unlicense, no photos ship, backgrounds are credited separately and honestly', async () => {
  await renderRouter(withCredits(), { initialUrl: '/credits' });
  expect(await screen.findByText('free-exercise-db')).toBeTruthy();
  expect(screen.getByText('Unlicense')).toBeTruthy();
  expect(screen.getByText(/declares the Unlicense/)).toBeTruthy();
  expect(screen.queryByText(/public domain/)).toBeNull();
  expect(screen.getByText(/generated from those facts/)).toBeTruthy();
  expect(screen.getByText(/No exercise photos ship/)).toBeTruthy();
  expect(screen.getByText(/earlier versions of this app/)).toBeTruthy();
  expect(screen.queryByText(/its own/)).toBeNull();
  expect(screen.getByText('Screen backgrounds')).toBeTruthy();
  expect(screen.getByText(/not documented yet/)).toBeTruthy();
  act(() => router.back());
});
