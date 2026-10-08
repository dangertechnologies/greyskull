import { router } from 'expo-router';
import { Alert } from 'react-native';
import { act } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import fixture from '../domain/__tests__/fixtures/v1-imperial.json';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/** The real route modules, mounted in an in-memory router. */
const routes = () => ({
  _layout: require('../../app/_layout'),
  index: require('../../app/index'),
  settings: require('../../app/settings'),
  'setup/index': require('../../app/setup/index'),
  'setup/confirm': require('../../app/setup/confirm'),
  'lift/[id]': require('../../app/lift/[id]'),
});

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
});

test('fresh install lands on setup', async () => {
  renderRouter(routes(), { initialUrl: '/' });
  expect(await screen.findByText(/Setup coming/, {}, { timeout: 4000 })).toBeTruthy();
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
  expect(await screen.findByText(/Setup coming/)).toBeTruthy();
  alert.mockRestore();
});
