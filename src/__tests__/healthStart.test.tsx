import { act } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import { startHealthSync } from '../health';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

jest.mock('../health', () => {
  const actual = jest.requireActual('../health');
  return { ...actual, startHealthSync: jest.fn() };
});

const start = startHealthSync as jest.MockedFunction<typeof startHealthSync>;

test('Health sync starts once the saved data has loaded and storage is healthy, and stops with it', async () => {
  const stop = jest.fn();
  start.mockReturnValue(stop);
  useStore.setState({ ...initialState(), hydrated: true });
  await renderRouter(routes(), { initialUrl: '/' });
  await screen.findByText('Get started');
  expect(start).toHaveBeenCalledTimes(1);
  expect(stop).not.toHaveBeenCalled();
  // The data can no longer be trusted: the sync stops, and starts again once storage is healthy.
  await act(async () => useStore.setState({ storageError: 'unreadable' }));
  expect(stop).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledTimes(1);
  await act(async () => useStore.setState({ storageError: null }));
  expect(start).toHaveBeenCalledTimes(2);
});
