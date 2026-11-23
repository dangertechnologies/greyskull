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
