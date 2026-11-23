import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { Alert, type AlertButton } from 'react-native';
import { setProgram, startSession } from '../__fixtures__/oneProgram';
import { ThemeProvider } from '../design/theme';
import { TEMPLATES } from '../domain';
import { stateFile } from '../storage';
import { initialState, initStore, useStore } from '../store';
import { StorageRecovery } from './StorageRecovery';

jest.mock('../store', () => ({
  ...jest.requireActual('../store'),
  initStore: jest.fn(async () => undefined),
}));

const files = (jest.requireMock('expo-file-system') as { __files: Map<string, string> }).__files;
const shareAsync = Sharing.shareAsync as jest.Mock;
const pick = (jest.requireMock('expo-document-picker') as { getDocumentAsync: jest.Mock }).getDocumentAsync;

const show = () =>
  render(
    <ThemeProvider>
      <StorageRecovery error="The saved data is damaged: the history is damaged" />
    </ThemeProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({ ...initialState(), hydrated: true });
});
afterEach(() => jest.restoreAllMocks());

test('it says why the data could not be loaded and Try again loads it again', async () => {
  show();
  expect(screen.getByText('Your data could not be loaded')).toBeTruthy();
  expect(screen.getByText(/history is damaged/)).toBeTruthy();
  fireEvent.press(screen.getByText('Try again'));
  await waitFor(() => expect(initStore).toHaveBeenCalledTimes(1));
});

test('Export the data file shares the raw file untouched, or says there is none', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  show();
  fireEvent.press(screen.getByText('Export the data file'));
  await waitFor(() => expect(alert).toHaveBeenCalledWith('No data file', expect.any(String)));
  expect(shareAsync).not.toHaveBeenCalled();
  files.set(stateFile().uri, '{"broken');
  fireEvent.press(screen.getByText('Export the data file'));
  await waitFor(() => expect(shareAsync).toHaveBeenCalledWith(stateFile().uri, expect.anything()));
  expect(files.get(stateFile().uri)).toBe('{"broken');
});

test('Restore a backup asks first, then replaces the data with the picked file', async () => {
  setProgram(TEMPLATES.base);
  const draft = startSession();
  for (const id of draft.order) useStore.getState().logSet(id, 0, 5);
  useStore.getState().finishSession();
  files.set('file:///backup.json', useStore.getState().exportJson());
  await useStore.getState().reset();
  expect(useStore.getState().sessions).toHaveLength(0);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  pick.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///backup.json' }] });
  show();
  fireEvent.press(screen.getByText('Restore a backup'));
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith('Replace your data?', expect.any(String), expect.any(Array)),
  );
  expect(useStore.getState().sessions).toHaveLength(0);
  const buttons = alert.mock.calls[0][2] as AlertButton[];
  buttons.find((b) => b.text === 'Replace')?.onPress?.();
  await waitFor(() => expect(useStore.getState().sessions).toHaveLength(1));
});
