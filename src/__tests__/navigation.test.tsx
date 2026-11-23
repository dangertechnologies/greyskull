import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import { programId, setProgram, startSession } from '../__fixtures__/oneProgram';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
  setProgram(TEMPLATES.base);
  useStore.getState().setSettings({ restSeconds: 0 });
});

test('finishing a workout returns to the existing Today instead of stacking a new one', async () => {
  const { getPathname } = await renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId(`start-${programId()}`));
  await screen.findByTestId('done-set');
  while (screen.queryByTestId('done-set')) fireEvent.press(screen.getByTestId('done-set'));
  fireEvent.press(await screen.findByTestId('finish-workout'));
  fireEvent.press(await screen.findByTestId('back-to-today'));
  expect(await screen.findByText(/^Next: Day 2/)).toBeTruthy();
  expect(getPathname()).toBe('/');
  expect(router.canGoBack()).toBe(false);
});

test('saving the program from its screen goes back to Today', async () => {
  const { getPathname } = await renderRouter(routes(), { initialUrl: '/' });
  await screen.findByText(/^Next: Day 1/);
  act(() => router.push(`/program/${programId()}`));
  fireEvent.press(await screen.findByText('Days and exercises'));
  fireEvent.press(await screen.findByText('Save'));
  await screen.findByText(/^Next: Day 1/);
  expect(getPathname()).toBe('/');
  expect(router.canGoBack()).toBe(false);
});

test('Back on the session screen returns to Today and keeps the logged sets', async () => {
  await renderRouter(routes(), { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId(`start-${programId()}`));
  fireEvent.press(await screen.findByTestId('done-set'));
  fireEvent.press(screen.getByLabelText('Back to Today'));
  expect(await screen.findByText('Resume workout')).toBeTruthy();
  expect(useStore.getState().draft).not.toBeNull();
});

test('editing the program during a workout warns before discarding logged sets', async () => {
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

test('the four tabs are reachable and switching between them keeps one Today', async () => {
  const { getPathname } = await renderRouter(routes(), { initialUrl: '/' });
  await screen.findByText(/^Next: Day 1/);
  for (const path of ['/progress', '/plan', '/settings', '/']) {
    act(() => router.navigate(path as '/'));
    expect(getPathname()).toBe(path);
  }
  expect(router.canGoBack()).toBe(false);
});
