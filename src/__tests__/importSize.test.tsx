import { File } from 'expo-file-system';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import { MAX_BACKUP_BYTES } from '../backup';
import { importFromFile } from '../importFlow';
import { MAX_IMPORT_CHARS } from '../planShare';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

const picker = (jest.requireMock('expo-document-picker') as { getDocumentAsync: jest.Mock }).getDocumentAsync;
const files = (jest.requireMock('expo-file-system') as { __files: Map<string, string> }).__files;

/** The mock File has no size; the real one reports it in bytes. */
function fileSize(bytes: number) {
  Object.defineProperty(File.prototype, 'size', { get: () => bytes, configurable: true });
}

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
  files.set('file:///big.json', 'x');
  jest.spyOn(File.prototype, 'text');
});
afterEach(() => {
  delete (File.prototype as { size?: number }).size;
  jest.restoreAllMocks();
});

describe('a file over the size limit is refused before it is read', () => {
  test.each([
    ['the picker reports the size', { size: MAX_BACKUP_BYTES + 1 }, 0],
    ['the picker does not, so the file is asked', { size: undefined }, MAX_BACKUP_BYTES + 1],
  ])('backup import: %s', async (_n, asset, fileBytes) => {
    fileSize(fileBytes);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    picker.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///big.json', ...asset }] });
    await expect(importFromFile()).resolves.toBe(false);
    expect(alert).toHaveBeenCalledWith('Cannot import', expect.stringMatching(/too large.*20 MB/));
    expect(File.prototype.text).not.toHaveBeenCalled();
  });

  test('program import (builder): the picker does not report a size, so the file is asked', async () => {
    fileSize(MAX_IMPORT_CHARS * 4 + 1);
    picker.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///big.json' }] });
    await renderRouter(
      { ...routes(), 'builder/import': require('../../app/builder/import') },
      { initialUrl: '/builder/import' },
    );
    fireEvent.press(await screen.findByText('Choose a file'));
    expect(await screen.findByText(/too large to be a program/)).toBeTruthy();
    expect(File.prototype.text).not.toHaveBeenCalled();
  });
});
