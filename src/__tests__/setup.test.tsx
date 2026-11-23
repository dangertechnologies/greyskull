import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import {
  program as current,
  lifts,
  setLift,
  setPosition,
  setProgram,
  startSession,
} from '../__fixtures__/oneProgram';
import { getPlan, PLANS } from '../config/plans';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

beforeEach(() => useStore.setState({ ...initialState(), hydrated: true }));

const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));

test("full flow with Phrak's: Day A = chins, press, squat; session 1 = B with deadlift", async () => {
  await renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
  press('setup-next');
  fireEvent.press(await screen.findByRole('radio', { name: /^Phrak/ }));
  press('setup-next');
  await screen.findByTestId('start-training');
  press('start-training');
  expect(await screen.findByText('Next: A · Week 1')).toBeTruthy();
  const { nextSession } = useStore.getState();
  const program = current();
  const lifts = program.lifts;
  expect(program?.template).toBe('phrak');
  expect(nextSession).toBe(0);
  expect(program?.days.map((d) => d.name)).toEqual(['A', 'B']);
  expect(program?.days[1].slots.map((s) => [s.exercise, s.scheme]).at(-1)).toEqual(['DEADLIFT', '1x5+']);
  expect(lifts.DEADLIFT.weightKg).toBe(20);
  expect(lifts.CHINUPS).toMatchObject({ weightKg: 0, startKg: 0, fails: 0 });
  expect(screen.getAllByText(/Chin/).length).toBeGreaterThan(0);
});

test('base + curls: every day ends with curls 2xAMRAP', async () => {
  await renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
  press('setup-next');
  fireEvent.press(await screen.findByRole('radio', { name: /^Greyskull LP/ }));
  fireEvent(screen.getByLabelText('Curls'), 'valueChange', true);
  press('setup-next');
  await screen.findByTestId('start-training');
  press('start-training');
  await screen.findByText(/^Next:/);
  const program = current();
  expect(
    program?.days.every((d) => d.slots.at(-1)?.exercise === 'CURLS' && d.slots.at(-1)?.scheme === '2xAMRAP'),
  ).toBe(true);
});

test('lb chosen in setup means 45 lb starting weights', async () => {
  await renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
  fireEvent.press(await screen.findByRole('radio', { name: 'lb' }));
  press('setup-next');
  fireEvent.press(await screen.findByRole('radio', { name: /^Greyskull LP/ }));
  press('setup-next');
  await screen.findByTestId('start-training');
  expect(screen.getAllByText('45 lb').length).toBeGreaterThan(0);
  press('start-training');
  await screen.findByText(/^Next:/);
  act(() => router.push(`/program/${current().id}`));
  expect((await screen.findAllByText('45 lb')).length).toBeGreaterThanOrEqual(2);
  expect(useStore.getState().unit).toBe('lb');
});

test('a starting weight can be changed on the review screen', async () => {
  await renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
  press('setup-next');
  fireEvent.press(await screen.findByRole('radio', { name: /^Greyskull LP/ }));
  press('setup-next');
  await screen.findByTestId('start-training');
  fireEvent.press(screen.getAllByRole('button', { name: /^Squat, change starting weight/ })[0]);
  for (let i = 0; i < 4; i++) fireEvent.press(await screen.findByLabelText('Increase')); // 20 → 30
  fireEvent.press(screen.getByText('Done'));
  press('start-training');
  await screen.findByText(/^Next:/);
  expect(lifts().BARBELL_SQUAT).toMatchObject({ weightKg: 30, startKg: 30 });
});

test('from scratch: an empty day blocks Start training with an inline error', async () => {
  await renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
  press('setup-next');
  fireEvent.press(await screen.findByRole('radio', { name: /^From scratch/ }));
  press('setup-next');
  expect(await screen.findByText('Day 1 has no exercises.')).toBeTruthy();
  expect(screen.getByTestId('start-training').props.accessibilityState.disabled).toBe(true);
});

test('experimental plans are labelled and StrongLifts goes through setup to a 5x5 Today', async () => {
  await renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
  press('setup-next');
  expect(await screen.findByLabelText('StrongLifts 5×5, experimental')).toBeTruthy();
  expect(screen.getAllByText('Experimental').length).toBe(
    PLANS.filter((p) => p.status === 'experimental').length,
  );
  fireEvent.press(screen.getByRole('radio', { name: /^StrongLifts/ }));
  expect(screen.getByText(/Five sets of five/)).toBeTruthy();
  fireEvent.press(screen.getByText('Advanced rules'));
  expect(screen.queryByText('Double the jump at (reps)')).toBeNull();
  expect(screen.getByText('Fails before deload')).toBeTruthy();
  press('setup-next');
  await screen.findByTestId('start-training');
  press('start-training');
  await screen.findByText(/^Next:/);
  act(() => router.push(`/program/${current().id}`));
  expect((await screen.findAllByText('5x5')).length).toBeGreaterThan(0);
  expect(current().rules.progression).toBe('linear');
});

test('AllPro shows the light day and the current rep target on Today', async () => {
  setProgram(getPlan('allpro')!.program);
  setPosition(1);
  await renderRouter(routes(), { initialUrl: `/program/${current().id}` });
  expect(await screen.findByText('Light day · 80 % of your working weights')).toBeTruthy();
  expect(screen.getAllByText('2×8 (8–12)').length).toBeGreaterThanOrEqual(5);
});

describe('editing the saved program', () => {
  test('add dips to day 2: history and weights stay', async () => {
    const store = useStore.getState();
    setProgram(TEMPLATES.base);
    setLift('BARBELL_SQUAT', { weightKg: 100 });
    startSession();
    store.logSet('MILITARY_PRESS', 0, 5);
    store.finishSession();
    await renderRouter(routes(), { initialUrl: '/setup/days?edit=1' });
    expect(await screen.findByText('Your history and current weights are kept.')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Add exercise')[1]);
    fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Dips');
    fireEvent.press(await screen.findByLabelText('Dips'));
    fireEvent.press(screen.getByText('Save'));
    expect(await screen.findByText(/^Next: Day 2/)).toBeTruthy();
    expect(screen.getAllByText(/Dips/).length).toBeGreaterThan(0);
    const s = useStore.getState();
    expect(s.sessions).toHaveLength(1);
    expect(lifts().BARBELL_SQUAT.weightKg).toBe(100);
  });

  test('emptying a day shows the validation error and disables Save', async () => {
    setProgram(TEMPLATES.base);
    await renderRouter(routes(), { initialUrl: '/setup/days?edit=1' });
    await screen.findByText('Your history and current weights are kept.');
    fireEvent.press(screen.getAllByLabelText('Remove exercise')[2]);
    fireEvent.press(screen.getAllByLabelText('Remove exercise')[2]);
    expect(await screen.findByText('Day 2 has no exercises.')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState.disabled).toBe(true);
  });

  test('the scheme sheet changes sets and reps', async () => {
    setProgram(TEMPLATES.base);
    await renderRouter(routes(), { initialUrl: '/setup/days?edit=1' });
    fireEvent.press((await screen.findAllByLabelText(/^Scheme 2x5\+/))[0]);
    fireEvent.press(await screen.findByRole('radio', { name: 'Fixed' }));
    for (let i = 0; i < 3; i++) fireEvent.press(screen.getAllByLabelText('Increase')[0]); // sets 2 → 5
    fireEvent.press(screen.getAllByRole('button', { name: 'Save' }).at(-1) as never); // the sheet's Save
    expect(await screen.findAllByLabelText(/^Scheme 5x5/)).toHaveLength(1);
    fireEvent.press(screen.getByRole('button', { name: 'Save' })); // the page's Save
    expect(current().days[0].slots[0].scheme).toBe('5x5');
  });

  test('saving during a workout asks before discarding it', async () => {
    setProgram(TEMPLATES.base);
    startSession();
    useStore.getState().logSet('MILITARY_PRESS', 0, 5);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderRouter(routes(), { initialUrl: '/setup/days?edit=1' });
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
  setProgram(TEMPLATES.base);
  setLift('BARBELL_SQUAT', { weightKg: 100 });
  startSession();
  store.finishSession();
  await renderRouter(routes(), { initialUrl: '/' });
  act(() => router.push(`/setup/plan?change=1&program=${current().id}`));
  fireEvent.press(await screen.findByRole('radio', { name: /^Starting Strength/ }));
  press('setup-next');
  await screen.findByTestId('start-training');
  press('start-training');
  await screen.findByText(/^Next:/);
  const s = useStore.getState();
  expect(s.programs).toHaveLength(1);
  expect(current().template).toBe('starting-strength');
  expect(s.sessions).toHaveLength(1);
  expect(lifts().BARBELL_SQUAT.weightKg).toBeGreaterThanOrEqual(100);
  expect(s.nextSession).toBe(1);
});

test('training days can be set to five in setup and changed while a workout is in progress', async () => {
  await renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
  press('setup-next');
  fireEvent.press(await screen.findByRole('radio', { name: /^Greyskull LP/ }));
  fireEvent(screen.getByLabelText('Training days per week'), 'accessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  });
  fireEvent(screen.getByLabelText('Training days per week'), 'accessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  });
  press('setup-next');
  await screen.findByTestId('start-training');
  expect(screen.getAllByRole('button', { name: /^Squat, change starting weight/ })).toHaveLength(1);
  press('start-training');
  await screen.findByText(/^Next:/);
  expect(current().sessionsPerWeek).toBe(5);
  act(() => {
    startSession();
    router.push(`/program/${current().id}`);
  });
  const draft = useStore.getState().draft;
  fireEvent(await screen.findByLabelText('Training days per week'), 'accessibilityAction', {
    nativeEvent: { actionName: 'decrement' },
  });
  expect(current().sessionsPerWeek).toBe(4);
  expect(useStore.getState().draft).toBe(draft);
});
