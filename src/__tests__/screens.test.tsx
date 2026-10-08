import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import fixture from '../dev/v1-imperial.json';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
});

test('fresh install lands on setup', async () => {
  renderRouter(routes(), { initialUrl: '/' });
  expect(await screen.findByText('Get started', {}, { timeout: 4000 })).toBeTruthy();
});

test('home lists the first session with bar-only plates', async () => {
  useStore.getState().setProgram(TEMPLATES.base);
  renderRouter(routes(), { initialUrl: '/' });
  expect(await screen.findByText('Day 1 · Week 1')).toBeTruthy();
  expect(screen.getByText('Overhead press')).toBeTruthy();
  expect(screen.getAllByText('20 kg').length).toBe(2);
  expect(screen.getAllByText('bar only').length).toBe(2);
});

test('switching to lb shows 45 lb; ticking the 1.25 lb plate lowers the smallest jump', async () => {
  useStore.getState().setProgram(TEMPLATES.base);
  renderRouter(routes(), { initialUrl: '/settings' });
  expect(await screen.findByText('Smallest jump: 2.5 kg')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('lb'));
  expect(screen.getByText('Smallest jump: 5 lb')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('1.25'));
  expect(screen.getByText('Smallest jump: 2.5 lb')).toBeTruthy();
  act(() => router.replace('/'));
  expect((await screen.findAllByText('45 lb')).length).toBe(2);
});

test('lift editor changes the weight shown on Home', async () => {
  useStore.getState().setProgram(TEMPLATES.base);
  renderRouter(routes(), { initialUrl: '/lift/BENCH_PRESS' });
  expect(await screen.findByText('Working weight')).toBeTruthy();
  for (let i = 0; i < 17; i++) fireEvent.press(screen.getAllByLabelText('Increase')[0]); // 20 → 62.5 kg
  expect(useStore.getState().lifts.BENCH_PRESS.weightKg).toBe(62.5);
  expect(screen.getByText('per side: 20 + 1.25')).toBeTruthy();
});

test('seeded v1 data goes through the confirm screen into history', async () => {
  await useStore.getState().importLegacy(JSON.stringify(fixture));
  renderRouter(routes(), { initialUrl: '/' });
  expect(await screen.findByText('Check your weights')).toBeTruthy();
  expect(screen.getByText('looks wrong')).toBeTruthy();
  expect(screen.getAllByText('45 lb').length).toBeGreaterThan(0);
  fireEvent.press(screen.getByText('Confirm'));
  expect(await screen.findByText('History')).toBeTruthy();
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

  expect(await screen.findByText('Warm-up 1 of 1')).toBeTruthy();
  expect(screen.getByText('Overhead press')).toBeTruthy();
  fireEvent.press(screen.getByText('Done'));
  expect(screen.getByText('Set 1 of 2')).toBeTruthy();
  fireEvent.press(screen.getByText('Done'));
  expect(screen.getByText('AMRAP')).toBeTruthy();
  for (let i = 0; i < 7; i++) fireEvent.press(screen.getByLabelText('Increase')); // 5 → 12
  fireEvent.press(screen.getByText('Done'));

  expect(screen.getByText('Barbell Squat')).toBeTruthy();
  for (const label of ['Warm-up 1 of 4', 'Warm-up 2 of 4', 'Warm-up 3 of 4', 'Warm-up 4 of 4']) {
    expect(screen.getByText(label)).toBeTruthy();
    fireEvent.press(screen.getByText('Done'));
  }
  fireEvent.press(screen.getByText('Done')); // set 1
  fireEvent.press(screen.getByLabelText('Decrease')); // AMRAP 5 → 4
  fireEvent.press(screen.getByText('Done'));

  fireEvent.press(await screen.findByText('Finish workout'));
  expect(await screen.findByText('Overhead press 20 → 22.5 kg ↑↑')).toBeTruthy();
  expect(screen.getByText('Barbell Squat 100 → 100 kg (1 fail)')).toBeTruthy();
  const { lifts, nextSession, draft } = useStore.getState();
  expect(lifts.MILITARY_PRESS.weightKg).toBe(22.5);
  expect(nextSession).toBe(1);
  expect(draft).toBeNull();

  fireEvent.press(screen.getByText('Back to home'));
  expect(await screen.findByText('Day 2 · Week 1')).toBeTruthy();
  expect(screen.getByText('Bench-press')).toBeTruthy();
  expect(screen.getByText('Deadlift')).toBeTruthy();
});

test('a half-finished session shows Resume on Home and keeps its sets', async () => {
  const store = useStore.getState();
  store.setProgram(TEMPLATES.base);
  store.startSession(0);
  store.logSet('MILITARY_PRESS', 0, 5);
  renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByText('Resume'));
  expect(await screen.findByText('AMRAP')).toBeTruthy();
});
