import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import fixture from '../dev/v1-imperial.json';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
});

test('fresh install lands on setup', async () => {
  renderRouter(routes(), { initialUrl: '/' });
  expect(await screen.findByText('Get started')).toBeTruthy();
});

test('today lists the first session with bar-only plates', async () => {
  useStore.getState().setProgram(TEMPLATES.base);
  renderRouter(routes(), { initialUrl: '/' });
  expect((await screen.findAllByText('Day 1')).length).toBeGreaterThan(0);
  expect(screen.getByText('Week 1')).toBeTruthy();
  expect(screen.getAllByText('Overhead press').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Squat').length).toBeGreaterThan(0);
  expect(screen.getAllByText('20 kg').length).toBeGreaterThanOrEqual(2);
  expect(screen.getAllByText('bar only').length).toBeGreaterThanOrEqual(2);
  expect(screen.getByTestId('start-session')).toBeTruthy();
});

test('switching to lb shows 45 lb; ticking the 1.25 lb plate lowers the smallest jump', async () => {
  useStore.getState().setProgram(TEMPLATES.base);
  renderRouter(routes(), { initialUrl: '/settings' });
  expect(await screen.findByText('Smallest jump: 2.5 kg')).toBeTruthy();
  fireEvent.press(screen.getByRole('radio', { name: 'lb' }));
  expect(screen.getByText('Smallest jump: 5 lb')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('1.25'));
  expect(screen.getByText('Smallest jump: 2.5 lb')).toBeTruthy();
  act(() => router.navigate('/'));
  expect((await screen.findAllByText('45 lb')).length).toBeGreaterThanOrEqual(2);
});

test('the lift editor changes the weight and shows the plates', async () => {
  useStore.getState().setProgram(TEMPLATES.base);
  renderRouter(routes(), { initialUrl: '/lift/BENCH_PRESS' });
  expect((await screen.findAllByText('Working weight')).length).toBeGreaterThan(0);
  for (let i = 0; i < 17; i++) fireEvent.press(screen.getAllByLabelText('Increase')[0]); // 20 → 62.5 kg
  expect(useStore.getState().lifts.BENCH_PRESS.weightKg).toBe(62.5);
  expect(screen.getAllByText('per side: 20 + 1.25').length).toBeGreaterThan(0);
});

test('seeded v1 data goes through the confirm screen into history', async () => {
  await useStore.getState().importLegacy(JSON.stringify(fixture));
  renderRouter(routes(), { initialUrl: '/' });
  expect(await screen.findByText('Check your weights')).toBeTruthy();
  expect(screen.getByText('looks wrong')).toBeTruthy();
  expect(screen.getAllByText('45 lb').length).toBeGreaterThan(0);
  fireEvent.press(screen.getByTestId('confirm-weights'));
  expect(await screen.findByText('Recent')).toBeTruthy();
  expect(screen.getAllByText(/Imported/).length).toBeGreaterThan(0);
  expect(useStore.getState().needsWeightConfirm).toBe(false);
});

test('Reset in settings confirms, wipes the program and sends you to setup', async () => {
  useStore.getState().setProgram(TEMPLATES.base);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.style === 'destructive')?.onPress?.();
  });
  renderRouter(routes(), { initialUrl: '/settings' });
  fireEvent.press(await screen.findByLabelText('Reset'));
  expect(alert).toHaveBeenCalled();
  expect(useStore.getState().program).toBeNull();
  expect(await screen.findByText('Get started')).toBeTruthy();
  alert.mockRestore();
});

test('immersive session: warm-ups, sets, AMRAP, finish and celebration', async () => {
  const store = useStore.getState();
  store.setProgram(TEMPLATES.base);
  store.setLift('BARBELL_SQUAT', { weightKg: 100 });
  store.setSettings({ restSeconds: 0 });
  renderRouter(routes(), { initialUrl: '/session/0' });
  const done = () => fireEvent.press(screen.getByTestId('done-set'));

  expect(await screen.findByText('Warm-up 1 of 1')).toBeTruthy();
  expect(screen.getByText('Overhead press')).toBeTruthy();
  done();
  expect(screen.getByText('Set 1 of 2')).toBeTruthy();
  done();
  expect(screen.getByText('AMRAP')).toBeTruthy();
  for (let i = 0; i < 7; i++) fireEvent.press(screen.getByLabelText('Increase')); // 5 → 12
  done();

  expect(screen.getByText('Squat')).toBeTruthy();
  for (const label of ['Warm-up 1 of 4', 'Warm-up 2 of 4', 'Warm-up 3 of 4', 'Warm-up 4 of 4']) {
    expect(screen.getByText(label)).toBeTruthy();
    done();
  }
  done(); // set 1
  fireEvent.press(screen.getByLabelText('Decrease')); // AMRAP 5 → 4
  done();

  fireEvent.press(await screen.findByTestId('finish-workout'));
  expect(await screen.findByText('Workout complete')).toBeTruthy();
  expect(screen.getByText('Overhead press 20 kg → 22.5 kg')).toBeTruthy();
  expect(screen.getByText('↑↑ Double jump')).toBeTruthy();
  expect(screen.getByText('Squat 100 kg · 1 fail')).toBeTruthy();
  const { lifts, nextSession, draft } = useStore.getState();
  expect(lifts.MILITARY_PRESS.weightKg).toBe(22.5);
  expect(nextSession).toBe(1);
  expect(draft).toBeNull();

  fireEvent.press(screen.getByTestId('back-to-today'));
  expect((await screen.findAllByText('Day 2')).length).toBeGreaterThan(0);
  expect(screen.getAllByText('Bench press').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Deadlift').length).toBeGreaterThan(0);
});

test('a half-finished session shows Resume on Today and keeps its sets', async () => {
  const store = useStore.getState();
  store.setProgram(TEMPLATES.base);
  store.startSession(0);
  store.logSet('MILITARY_PRESS', 0, 5);
  renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByText('Resume workout'));
  expect(await screen.findByText('AMRAP')).toBeTruthy();
});

test('a logged set can be corrected from the set rail without starting a rest', async () => {
  const store = useStore.getState();
  store.setProgram(TEMPLATES.base);
  store.setSettings({ restSeconds: 90 });
  renderRouter(routes(), { initialUrl: '/session/0' });
  fireEvent.press(await screen.findByTestId('done-set')); // warm-up (no rest)
  fireEvent.press(screen.getByTestId('done-set')); // set 1 → rest starts
  expect(await screen.findByTestId('rest-remaining')).toBeTruthy();
  fireEvent.press(screen.getByTestId('rest-skip'));
  fireEvent.press(screen.getByTestId('set-pill-MILITARY_PRESS-1'));
  fireEvent.press(screen.getByLabelText('Increase')); // 5 → 6
  fireEvent.press(screen.getByTestId('done-set'));
  expect(useStore.getState().draft?.results.MILITARY_PRESS.sets[0].reps).toBe(6);
  expect(screen.queryByTestId('rest-remaining')).toBeNull();
});

describe('the design gallery (dev only)', () => {
  test('renders every primitive in both colour schemes', async () => {
    renderRouter(routes(), { initialUrl: '/gallery' });
    expect(await screen.findByText('dark theme')).toBeTruthy();
    expect(screen.getByText('light theme')).toBeTruthy();
    expect(screen.getAllByText('Start workout')).toHaveLength(2);
    expect(
      screen.getAllByTestId('exercise-icon-MILITARY_PRESS', { includeHiddenElements: true }),
    ).toHaveLength(2);
  });
});
