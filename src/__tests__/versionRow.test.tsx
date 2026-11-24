import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

const mocked = Updates as unknown as {
  isEnabled: boolean;
  checkForUpdateAsync: jest.Mock;
  fetchUpdateAsync: jest.Mock;
  reloadAsync: jest.Mock;
  useUpdates: jest.Mock;
};

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
  mocked.isEnabled = true;
  mocked.checkForUpdateAsync.mockReset().mockResolvedValue({ isAvailable: false });
  mocked.fetchUpdateAsync.mockReset().mockResolvedValue({ isNew: true });
  mocked.reloadAsync.mockClear();
  mocked.useUpdates.mockReturnValue({ isUpdatePending: false });
});

const open = async () => {
  await renderRouter(routes(), { initialUrl: '/settings' });
  return screen.findByLabelText('Version 1.1.0. Check for updates');
};

test('the version shows in Settings and tapping it checks for an update', async () => {
  const row = await open();
  expect(screen.getByText('1.1.0')).toBeTruthy();
  fireEvent.press(row);
  expect(await screen.findByText("You're up to date")).toBeTruthy();
  expect(mocked.checkForUpdateAsync).toHaveBeenCalledTimes(1);
});

test('a downloaded update asks to restart, and restarts only when confirmed', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mocked.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
  fireEvent.press(await open());
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith('Restart to update?', expect.any(String), expect.any(Array)),
  );
  expect(mocked.reloadAsync).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
  buttons.find((b) => b.text === 'Restart')?.onPress?.();
  expect(mocked.reloadAsync).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('Update ready. Tap to restart')).toBeTruthy();
});

test('an update downloaded earlier is offered straight away, without another check', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mocked.useUpdates.mockReturnValue({ isUpdatePending: true });
  fireEvent.press(await open());
  expect(alert).toHaveBeenCalledWith('Restart to update?', expect.any(String), expect.any(Array));
  expect(mocked.checkForUpdateAsync).not.toHaveBeenCalled();
});

test('a failed check says so, and a build without updates says that', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  mocked.checkForUpdateAsync.mockRejectedValue(new Error('offline'));
  fireEvent.press(await open());
  expect(await screen.findByText("Couldn't check. Try again later")).toBeTruthy();
});

test('where updates are off the row says so', async () => {
  mocked.isEnabled = false;
  fireEvent.press(await open());
  expect(await screen.findByText('Updates are off in this build')).toBeTruthy();
});
