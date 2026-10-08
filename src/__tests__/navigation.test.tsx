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
  useStore.getState().setSettings({ restSeconds: 0 });
});

test('finishing a workout returns to the existing Home instead of stacking a new one', async () => {
  renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByText('Start'));
  await screen.findByText('Done');
  while (screen.queryByText('Done')) fireEvent.press(screen.getByText('Done'));
  fireEvent.press(await screen.findByText('Finish workout'));
  fireEvent.press(await screen.findByText('Back to home'));
  expect(await screen.findByText('Day 2 · Week 1')).toBeTruthy();
  expect(router.canGoBack()).toBe(false);
});

test('saving the program from Settings goes back to the existing Home', async () => {
  renderRouter(routes(), { initialUrl: '/' });
  await screen.findByText('Day 1 · Week 1');
  act(() => router.push('/settings'));
  fireEvent.press(await screen.findByText('Edit program'));
  fireEvent.press(await screen.findByText('Save'));
  expect(await screen.findByText('Day 1 · Week 1')).toBeTruthy();
  expect(router.canGoBack()).toBe(false);
});

test('editing the program during a workout warns before discarding logged sets', async () => {
  useStore.getState().startSession(0);
  useStore.getState().logSet('MILITARY_PRESS', 0, 5);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  renderRouter(routes(), { initialUrl: '/setup/days?edit=1' });
  fireEvent.press(await screen.findByText('Save'));
  expect(alert).toHaveBeenCalledWith('Discard the workout in progress?', expect.any(String), expect.any(Array));
  expect(useStore.getState().draft).not.toBeNull();
  alert.mockRestore();
});
