import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import { getPlan } from '../config/plans';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

beforeEach(() => useStore.setState({ ...initialState(), hydrated: true }));

const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));

test("full flow with Phrak's: Day A = chins, press, squat; session 1 = B with deadlift", async () => {
  renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
  press('setup-next');
  fireEvent.press(await screen.findByRole('radio', { name: /^Phrak/ }));
  press('setup-next');
  await screen.findByText('Week 1');
  press('start-training');
  expect((await screen.findAllByText('A')).length).toBeGreaterThan(0);
  const { program, nextSession, lifts } = useStore.getState();
  expect(program?.template).toBe('phrak');
  expect(nextSession).toBe(0);
  expect(program?.days.map((d) => d.name)).toEqual(['A', 'B']);
  expect(program?.days[1].slots.map((s) => [s.exercise, s.scheme]).at(-1)).toEqual(['DEADLIFT', '1x5+']);
  expect(lifts.DEADLIFT.weightKg).toBe(20);
  expect(lifts.CHINUPS).toBeUndefined();
  expect(screen.getAllByText('Chin-up').length).toBeGreaterThan(0);
});

test('base + curls: every day ends with curls 2xAMRAP', async () => {
  renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
  press('setup-next');
  fireEvent.press(await screen.findByRole('radio', { name: /^Greyskull LP/ }));
  fireEvent(screen.getByLabelText('Curls'), 'valueChange', true);
  press('setup-next');
  await screen.findByText('Week 1');
  press('start-training');
  await screen.findAllByText('Week 1');
  const { program } = useStore.getState();
  expect(
    program?.days.every((d) => d.slots.at(-1)?.exercise === 'CURLS' && d.slots.at(-1)?.scheme === '2xAMRAP'),
  ).toBe(true);
});

test('lb chosen in setup means 45 lb starting weights', async () => {
  renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
  fireEvent.press(await screen.findByRole('radio', { name: 'lb' }));
  press('setup-next');
  fireEvent.press(await screen.findByRole('radio', { name: /^Greyskull LP/ }));
  press('setup-next');
  await screen.findByText('Week 1');
  expect(screen.getAllByText('45 lb').length).toBeGreaterThan(0);
  press('start-training');
  expect((await screen.findAllByText('45 lb')).length).toBeGreaterThanOrEqual(2);
  expect(useStore.getState().unit).toBe('lb');
});

test('a starting weight can be changed on the review screen', async () => {
  renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
  press('setup-next');
  fireEvent.press(await screen.findByRole('radio', { name: /^Greyskull LP/ }));
  press('setup-next');
  await screen.findByText('Week 1');
  fireEvent.press(screen.getAllByRole('button', { name: /^Squat, change starting weight/ })[0]);
  for (let i = 0; i < 4; i++) fireEvent.press(await screen.findByLabelText('Increase')); // 20 → 30
  fireEvent.press(screen.getByText('Done'));
  press('start-training');
  await screen.findAllByText('Week 1');
  expect(useStore.getState().lifts.BARBELL_SQUAT).toMatchObject({ weightKg: 30, startKg: 30 });
});

test('from scratch: an empty day blocks Start training with an inline error', async () => {
  renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
  press('setup-next');
  fireEvent.press(await screen.findByRole('radio', { name: /^From scratch/ }));
  press('setup-next');
  expect(await screen.findByText('Day 1 has no exercises.')).toBeTruthy();
  expect(screen.getByTestId('start-training').props.accessibilityState.disabled).toBe(true);
});

test('experimental plans are labelled and StrongLifts goes through setup to a 5x5 Today', async () => {
  renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
  press('setup-next');
  expect(await screen.findByLabelText('StrongLifts 5×5, experimental')).toBeTruthy();
  expect(screen.getAllByText('Experimental').length).toBe(3);
  fireEvent.press(screen.getByRole('radio', { name: /^StrongLifts/ }));
  expect(screen.getByText(/Five sets of five/)).toBeTruthy();
  fireEvent.press(screen.getByText('Advanced rules'));
  expect(screen.queryByText('Double the jump at (reps)')).toBeNull();
  expect(screen.getByText('Fails before deload')).toBeTruthy();
  press('setup-next');
  await screen.findByText('Week 1');
  press('start-training');
  expect((await screen.findAllByText('5x5')).length).toBeGreaterThan(0);
  expect(useStore.getState().program?.rules.progression).toBe('linear');
});

test('AllPro shows the light day and the current rep target on Today', async () => {
  useStore.getState().setProgram(getPlan('allpro')!.program);
  useStore.setState({ nextSession: 1 });
  renderRouter(routes(), { initialUrl: '/' });
  expect(await screen.findByText('Light day · 80 % of your working weights')).toBeTruthy();
  expect(screen.getAllByText('2×8 (8–12)').length).toBeGreaterThanOrEqual(5);
});

describe('editing the saved program', () => {
  test('add dips to day 2: history and weights stay', async () => {
    const store = useStore.getState();
    store.setProgram(TEMPLATES.base);
    store.setLift('BARBELL_SQUAT', { weightKg: 100 });
    store.startSession(0);
    store.logSet('MILITARY_PRESS', 0, 5);
    store.finishSession();
    renderRouter(routes(), { initialUrl: '/setup/days?edit=1' });
    expect(await screen.findByText('Edit program')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Add exercise')[1]);
    fireEvent.press(await screen.findByLabelText('Dips'));
    fireEvent.press(screen.getByText('Save'));
    expect((await screen.findAllByText('Day 2')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dips').length).toBeGreaterThan(0);
    const s = useStore.getState();
    expect(s.sessions).toHaveLength(1);
    expect(s.lifts.BARBELL_SQUAT.weightKg).toBe(100);
  });

  test('emptying a day shows the validation error and disables Save', async () => {
    useStore.getState().setProgram(TEMPLATES.base);
    renderRouter(routes(), { initialUrl: '/setup/days?edit=1' });
    await screen.findByText('Edit program');
    fireEvent.press(screen.getAllByLabelText('Remove exercise')[2]);
    fireEvent.press(screen.getAllByLabelText('Remove exercise')[2]);
    expect(await screen.findByText('Day 2 has no exercises.')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState.disabled).toBe(true);
  });

  test('the scheme sheet changes sets and reps', async () => {
    useStore.getState().setProgram(TEMPLATES.base);
    renderRouter(routes(), { initialUrl: '/setup/days?edit=1' });
    fireEvent.press((await screen.findAllByLabelText(/^Scheme 2x5\+/))[0]);
    fireEvent.press(await screen.findByRole('radio', { name: 'Fixed' }));
    for (let i = 0; i < 3; i++) fireEvent.press(screen.getAllByLabelText('Increase')[0]); // sets 2 → 5
    fireEvent.press(screen.getAllByRole('button', { name: 'Save' }).at(-1) as never); // the sheet's Save
    expect(await screen.findAllByLabelText(/^Scheme 5x5/)).toHaveLength(1);
    fireEvent.press(screen.getByRole('button', { name: 'Save' })); // the page's Save
    expect(useStore.getState().program?.days[0].slots[0].scheme).toBe('5x5');
  });

  test('saving during a workout asks before discarding it', async () => {
    useStore.getState().setProgram(TEMPLATES.base);
    useStore.getState().startSession(0);
    useStore.getState().logSet('MILITARY_PRESS', 0, 5);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderRouter(routes(), { initialUrl: '/setup/days?edit=1' });
    fireEvent.press(await screen.findByText('Save'));
    expect(alert).toHaveBeenCalledWith(
      'Discard the workout in progress?',
      expect.any(String),
      expect.any(Array),
    );
    expect(useStore.getState().draft).not.toBeNull();
    alert.mockRestore();
  });
});

test('Change plan keeps lifts and history and replaces the program', async () => {
  const store = useStore.getState();
  store.setProgram(TEMPLATES.base);
  store.setLift('BARBELL_SQUAT', { weightKg: 100 });
  store.startSession(0);
  store.finishSession();
  renderRouter(routes(), { initialUrl: '/' });
  act(() => router.push('/setup/plan?change=1'));
  fireEvent.press(await screen.findByRole('radio', { name: /^Starting Strength/ }));
  press('setup-next');
  await screen.findByText('Week 1');
  press('start-training');
  await screen.findAllByText('Week 1');
  const s = useStore.getState();
  expect(s.program?.template).toBe('starting-strength');
  expect(s.sessions).toHaveLength(1);
  expect(s.lifts.BARBELL_SQUAT.weightKg).toBeGreaterThanOrEqual(100);
  expect(s.nextSession).toBe(1);
});
