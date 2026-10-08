import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { getPlan } from '../config/plans';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(() => useStore.setState({ ...initialState(), hydrated: true }));

const next = () => fireEvent.press(screen.getByText('Next'));

async function runSetup(choice: string, options?: () => void) {
  renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByText('Get started'));
  next(); // units
  fireEvent.press(await screen.findByText(choice));
  next(); // template
  expect(await screen.findByText('Options')).toBeTruthy();
  options?.();
  next(); // options
  expect(await screen.findByText('Your days')).toBeTruthy();
  next(); // days
  expect(await screen.findByText('Starting weights')).toBeTruthy();
  next(); // weights
  expect(await screen.findByText('Week 1')).toBeTruthy();
  fireEvent.press(screen.getByText('Start training'));
}

test("full flow with Phrak's: Day A = chins, press, squat; session 1 = B with deadlift", async () => {
  await runSetup("Phrak's GSLP");
  expect(await screen.findByText(/^A · Week 1/)).toBeTruthy();
  const { program, nextSession, lifts } = useStore.getState();
  expect(program?.template).toBe('phrak');
  expect(nextSession).toBe(0);
  expect(program?.days.map((d) => d.name)).toEqual(['A', 'B']);
  expect(program?.days[1].slots.map((s) => [s.exercise, s.scheme]).at(-1)).toEqual(['DEADLIFT', '1x5+']);
  expect(lifts.DEADLIFT.weightKg).toBe(20);
  expect(lifts.CHINUPS).toBeUndefined();
  expect(screen.getByText('Chin-up')).toBeTruthy();
});

test('base + curls: every day ends with curls 2xAMRAP; extras honour the unit chosen in setup', async () => {
  await runSetup('Greyskull LP', () => fireEvent(screen.getByLabelText('Curls'), 'valueChange', true));
  await screen.findAllByText(/Week 1/);
  const { program } = useStore.getState();
  expect(
    program?.days.every((d) => d.slots.at(-1)?.exercise === 'CURLS' && d.slots.at(-1)?.scheme === '2xAMRAP'),
  ).toBe(true);
});

test('lb chosen in setup means 45 lb starting weights', async () => {
  renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByText('Get started'));
  fireEvent.press(await screen.findByLabelText('lb'));
  next();
  fireEvent.press(await screen.findByText('Greyskull LP'));
  next();
  await screen.findByText('Options');
  next();
  await screen.findByText('Your days');
  next();
  await screen.findByText('Starting weights');
  expect(screen.getAllByText('45 lb').length).toBeGreaterThan(0);
  next();
  await screen.findByText('Week 1');
  fireEvent.press(screen.getByText('Start training'));
  expect((await screen.findAllByText('45 lb')).length).toBe(2);
  expect(useStore.getState().unit).toBe('lb');
});

test('from scratch: an empty day blocks Next with an inline error', async () => {
  renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByText('Get started'));
  next();
  fireEvent.press(await screen.findByText('From scratch'));
  next();
  await screen.findByText('Options');
  next();
  expect(await screen.findByText('Day 1 has no exercises.')).toBeTruthy();
  expect(screen.getByLabelText('Next').props.accessibilityState.disabled).toBe(true);
});

test('Edit program: add dips to day 2, history and weights stay', async () => {
  const store = useStore.getState();
  store.setProgram(TEMPLATES.base);
  store.setLift('BARBELL_SQUAT', { weightKg: 100 });
  store.startSession(0);
  store.logSet('MILITARY_PRESS', 0, 5);
  store.finishSession();
  renderRouter(routes(), { initialUrl: '/setup/days?edit=1' });
  expect(await screen.findByText('Edit program')).toBeTruthy();
  fireEvent.press(screen.getAllByText('Add exercise')[1]);
  fireEvent.press(await screen.findByLabelText('Tricep dips'));
  fireEvent.press(screen.getByText('Save'));
  expect(await screen.findByText('Day 2 · Week 1')).toBeTruthy();
  expect(screen.getByText('Tricep dips')).toBeTruthy();
  const s = useStore.getState();
  expect(s.sessions).toHaveLength(1);
  expect(s.lifts.BARBELL_SQUAT.weightKg).toBe(100);
});

test('emptying a day in the editor shows the validation error and disables Save', async () => {
  useStore.getState().setProgram(TEMPLATES.base);
  renderRouter(routes(), { initialUrl: '/setup/days?edit=1' });
  await screen.findByText('Edit program');
  const remove = screen.getAllByLabelText('Remove exercise');
  fireEvent.press(remove[2]);
  fireEvent.press(screen.getAllByLabelText('Remove exercise')[2]);
  expect(await screen.findByText('Day 2 has no exercises.')).toBeTruthy();
  expect(screen.getByLabelText('Save').props.accessibilityState.disabled).toBe(true);
});

test('experimental plans are labelled and StrongLifts goes through setup to a 5x5 Home', async () => {
  renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByText('Get started'));
  next();
  expect(await screen.findByLabelText('StrongLifts 5×5, experimental')).toBeTruthy();
  expect(screen.getAllByText('Experimental').length).toBe(3);
  fireEvent.press(screen.getByText('StrongLifts 5×5'));
  expect(screen.getByText(/Five sets of five/)).toBeTruthy();
  next();
  await screen.findByText('Options');
  expect(screen.queryByText('Double the jump at (reps)')).toBeNull();
  next();
  await screen.findByText('Your days');
  next();
  await screen.findByText('Starting weights');
  next();
  await screen.findByText('Week 1');
  fireEvent.press(screen.getByText('Start training'));
  expect(await screen.findByText('A · Week 1')).toBeTruthy();
  expect(screen.getAllByText('5x5')).toHaveLength(3);
  expect(useStore.getState().program?.rules.progression).toBe('linear');
});

test('AllPro shows the light day and the current rep target on Home', async () => {
  const plan = getPlan('allpro')!.program;
  useStore.getState().setProgram(plan);
  useStore.setState({ nextSession: 1 });
  renderRouter(routes(), { initialUrl: '/' });
  expect(await screen.findByText('Light day · 80 % of your working weights')).toBeTruthy();
  expect(screen.getAllByText('2×8 (8–12)').length).toBe(5);
});
