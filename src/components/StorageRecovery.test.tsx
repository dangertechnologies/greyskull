import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { Alert, type AlertButton } from 'react-native';
import { setProgram, startSession } from '../__fixtures__/oneProgram';
import { ThemeProvider } from '../design/theme';
import { TEMPLATES } from '../domain';
import { listUnreadable, PREV_FILE, stateFile } from '../storage';
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

describe('ways back into the app', () => {
  const doc = (state: object) => JSON.stringify({ state, version: 4 });
  const confirm = async (alert: jest.SpyInstance, title: string, button: string) => {
    await waitFor(() => expect(alert).toHaveBeenCalledWith(title, expect.any(String), expect.any(Array)));
    const call = alert.mock.calls.find((c) => c[0] === title);
    ((call?.[2] ?? []) as AlertButton[]).find((b) => b.text === button)?.onPress?.();
  };
  beforeEach(() => {
    files.clear();
    useStore.setState({ storageError: 'damaged' });
  });

  test('Start fresh asks first, keeps every data file as a copy, then opens the app empty', async () => {
    files.set(stateFile().uri, '{"broken');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    show();
    fireEvent.press(screen.getByText('Start fresh'));
    expect(useStore.getState().storageError).toBe('damaged');
    await confirm(alert, 'Start fresh?', 'Start fresh');
    await waitFor(() => expect(useStore.getState().storageError).toBeNull());
    expect(useStore.getState().programs).toEqual([]);
    expect(listUnreadable().map((f) => files.get(f.uri))).toEqual(['{"broken']);
  });

  test('Use the previous save shows only when that file is whole, and restores it after asking', async () => {
    files.set(stateFile().uri, '');
    files.set(stateFile(PREV_FILE).uri, '{"half');
    show();
    await waitFor(() => expect(screen.queryByText('Use the previous save')).toBeNull());
    screen.unmount();

    setProgram(TEMPLATES.base);
    const previous = doc(JSON.parse(useStore.getState().exportJson()));
    useStore.setState({ ...initialState(), storageError: 'damaged' });
    files.set(stateFile(PREV_FILE).uri, previous);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    show();
    fireEvent.press(await screen.findByText('Use the previous save'));
    await confirm(alert, 'Replace your data?', 'Replace');
    await waitFor(() => expect(useStore.getState().storageError).toBeNull());
    expect(useStore.getState().programs[0].template).toBe('base');
    expect(
      listUnreadable()
        .map((f) => files.get(f.uri))
        .sort(),
    ).toEqual(['', previous].sort());
  });

  test('every kept copy is offered for export: before a restore, before an upgrade, unreadable', () => {
    for (const name of ['state.before-restore.1.json', 'state.v3.json', 'state.unreadable.2.state.json'])
      files.set(stateFile(name).uri, '{}');
    show();
    for (const name of ['state.before-restore.1.json', 'state.v3.json', 'state.unreadable.2.state.json'])
      expect(screen.getByText(`Export ${name}`)).toBeTruthy();
  });
});
