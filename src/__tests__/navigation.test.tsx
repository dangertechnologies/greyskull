import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
  useStore.getState().setProgram(TEMPLATES.base);
  useStore.getState().setSettings({ restSeconds: 0 });
});

test('finishing a workout returns to the existing Today instead of stacking a new one', async () => {
  const { getPathname } = renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('start-session'));
  await screen.findByTestId('done-set');
  while (screen.queryByTestId('done-set')) fireEvent.press(screen.getByTestId('done-set'));
  fireEvent.press(await screen.findByTestId('finish-workout'));
  fireEvent.press(await screen.findByTestId('back-to-today'));
  expect((await screen.findAllByText('Day 2')).length).toBeGreaterThan(0);
  expect(getPathname()).toBe('/');
  expect(router.canGoBack()).toBe(false);
});

test('saving the program from the Plan tab goes back to Today', async () => {
  const { getPathname } = renderRouter(routes(), { initialUrl: '/plan' });
  fireEvent.press(await screen.findByText('Days and exercises'));
  fireEvent.press(await screen.findByText('Save'));
  await screen.findAllByText('Day 1');
  expect(getPathname()).toBe('/');
  expect(router.canGoBack()).toBe(false);
});

test('Back on the session screen returns to Today and keeps the logged sets', async () => {
  renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('start-session'));
  fireEvent.press(await screen.findByTestId('done-set'));
  fireEvent.press(screen.getByLabelText('Back to Today'));
  expect(await screen.findByText('Resume workout')).toBeTruthy();
  expect(useStore.getState().draft).not.toBeNull();
});

test('editing the program during a workout warns before discarding logged sets', async () => {
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

test('the four tabs are reachable and switching between them keeps one Today', async () => {
  const { getPathname } = renderRouter(routes(), { initialUrl: '/' });
  await screen.findAllByText('Day 1');
  for (const path of ['/progress', '/plan', '/settings', '/']) {
    act(() => router.navigate(path as '/'));
    expect(getPathname()).toBe(path);
  }
  expect(router.canGoBack()).toBe(false);
});
