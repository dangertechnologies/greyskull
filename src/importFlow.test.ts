import { Alert } from 'react-native';
import * as backup from './backup';
import { confirmAndApply, importFromFile } from './importFlow';

test('an import that throws shows the damaged-backup message instead of crashing', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(backup, 'parseBackup').mockImplementation(() => {
    throw new TypeError("Cannot read properties of null (reading 'program')");
  });
  expect(confirmAndApply('{}')).toBe(false);
  expect(alert).toHaveBeenCalledWith('Cannot import', expect.stringMatching(/damaged/));
});

test('a backup file that cannot be read is explained, not left unhandled', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const picker = jest.requireMock('expo-document-picker') as { getDocumentAsync: jest.Mock };
  picker.getDocumentAsync.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///missing.json' }],
  });
  const { File } = jest.requireMock('expo-file-system') as {
    File: { prototype: { text(): Promise<string> } };
  };
  jest.spyOn(File.prototype, 'text').mockRejectedValueOnce(new Error('gone'));
  await expect(importFromFile()).resolves.toBe(false);
  expect(alert).toHaveBeenCalledWith('Cannot import', expect.stringMatching(/could not be read: gone/));
});

test('a restore whose copy of the current data fails says so, replaces nothing and does not finish', async () => {
  jest.restoreAllMocks();
  const { useStore, initialState } = jest.requireActual('./store') as typeof import('./store');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const { importBackup } = useStore.getState();
  useStore.setState({
    importBackup: jest.fn(
      async () => 'Your current data could not be kept aside, so nothing was replaced: disk full',
    ),
  });
  const done = jest.fn();
  expect(confirmAndApply(useStore.getState().exportJson(), done)).toBe(true);
  const buttons = alert.mock.calls[0][2] ?? [];
  buttons.find((b) => b.text === 'Replace')?.onPress?.();
  await new Promise((r) => setTimeout(r, 0));
  expect(alert).toHaveBeenLastCalledWith('Nothing was replaced', expect.stringMatching(/disk full/));
  expect(done).not.toHaveBeenCalled();
  expect(useStore.getState().storageError).toBeNull();
  useStore.setState({ ...initialState(), importBackup });
});
