import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { AppState } from 'react-native';
import { createFileStorage, STATE_FILE, stateFile, UNREADABLE_FILE, WRITE_DELAY_MS } from './storage';

const files = (jest.requireMock('expo-file-system') as { __files: Map<string, string> }).__files;
const fileText = (name = STATE_FILE) => files.get(stateFile(name).uri);
const blob = (version: number, state: object = { n: version }) => JSON.stringify({ state, version });

beforeEach(async () => {
  files.clear();
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

test('a fresh install reads nothing and writes only once the store enables writes', async () => {
  const storage = createFileStorage({ version: 4 });
  expect(await storage.getItem('key')).toBeNull();
  // Reading alone never enables writes: the store does that after its migration and merge succeeded.
  await storage.setItem('key', blob(4, { early: true }));
  await storage.flush();
  expect(fileText()).toBeUndefined();
  storage.enableWrites();
  await storage.setItem('key', blob(4));
  await storage.flush();
  expect(fileText()).toBe(blob(4));
});

test('data from AsyncStorage is copied to the file and the key is kept', async () => {
  await AsyncStorage.setItem('key', blob(4));
  const storage = createFileStorage({ version: 4 });
  expect(await storage.getItem('key')).toBe(blob(4));
  expect(fileText()).toBe(blob(4));
  expect(await AsyncStorage.getItem('key')).toBe(blob(4));
});

test('data of an older version is copied once before it is migrated', async () => {
  await AsyncStorage.setItem('key', blob(3, { first: true }));
  const storage = createFileStorage({ version: 4 });
  await storage.getItem('key');
  expect(fileText('state.v3.json')).toBe(blob(3, { first: true }));
  files.set(stateFile().uri, blob(3, { second: true }));
  await storage.getItem('key');
  expect(fileText('state.v3.json')).toBe(blob(3, { first: true }));
});

test('the file wins over AsyncStorage', async () => {
  files.set(stateFile().uri, blob(4, { from: 'file' }));
  await AsyncStorage.setItem('key', blob(4, { from: 'async' }));
  expect(await createFileStorage({ version: 4 }).getItem('key')).toBe(blob(4, { from: 'file' }));
});

test('a finished temporary file left by a crash is used when the state file is missing', async () => {
  files.set(stateFile(`${STATE_FILE}.tmp`).uri, blob(4, { from: 'tmp' }));
  await AsyncStorage.setItem('key', blob(4, { from: 'async' }));
  expect(await createFileStorage({ version: 4 }).getItem('key')).toBe(blob(4, { from: 'tmp' }));
  expect(fileText()).toBe(blob(4, { from: 'tmp' }));
});

test.each([
  ['unparsable', '{"state": {'],
  ['not app data', '[1, 2]'],
  ['a null state', '{"state": null, "version": 4}'],
])('a %s file throws, and nothing is written afterwards', async (_name, raw) => {
  files.set(stateFile().uri, raw);
  const storage = createFileStorage({ version: 4 });
  await expect(storage.getItem('key')).rejects.toThrow();
  expect(storage.canWrite()).toBe(false);
  await storage.setItem('key', blob(4));
  await storage.flush();
  expect(fileText()).toBe(raw);
  await storage.allowWrites();
  expect(fileText(UNREADABLE_FILE)).toBe(raw);
  await storage.setItem('key', blob(4));
  await storage.flush();
  expect(fileText()).toBe(blob(4));
});

test('an unreadable AsyncStorage entry also blocks writes', async () => {
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
  const storage = createFileStorage({ version: 4 });
  await expect(storage.getItem('key')).rejects.toThrow('disk');
  await storage.setItem('key', blob(4));
  await storage.flush();
  expect(files.size).toBe(0);
});

test('a write that throws leaves the old file whole and is retried on the next flush', async () => {
  files.set(stateFile().uri, blob(4, { old: true }));
  const storage = createFileStorage({ version: 4 });
  await storage.getItem('key');
  storage.enableWrites();
  const write = jest.spyOn(File.prototype, 'write').mockRejectedValueOnce(new Error('disk full'));
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  await storage.setItem('key', blob(4, { new: true }));
  await storage.flush();
  expect(fileText()).toBe(blob(4, { old: true }));
  write.mockRestore();
  await storage.flush();
  expect(fileText()).toBe(blob(4, { new: true }));
});

test('writes are debounced, one at a time, and flushed when the app goes to the background', async () => {
  jest.useFakeTimers();
  let onChange: ((status: string) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    onChange = handler as (status: string) => void;
    return { remove: () => undefined };
  });
  try {
    const storage = createFileStorage({ version: 4 });
    await storage.getItem('key');
    storage.enableWrites();
    const write = jest.spyOn(File.prototype, 'write');
    await storage.setItem('key', blob(4, { v: 1 }));
    await storage.setItem('key', blob(4, { v: 2 }));
    await jest.advanceTimersByTimeAsync(WRITE_DELAY_MS - 1);
    expect(write).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(fileText()).toBe(blob(4, { v: 2 }));

    await storage.setItem('key', blob(4, { v: 3 }));
    onChange?.('background');
    await storage.flush();
    expect(fileText()).toBe(blob(4, { v: 3 }));
    expect(write).toHaveBeenCalledTimes(2);

    // The app switcher and incoming calls make the app inactive first; it may never reach the background.
    await storage.setItem('key', blob(4, { v: 4 }));
    onChange?.('inactive');
    await Promise.resolve();
    await storage.flush();
    expect(write).toHaveBeenCalledTimes(3);
    expect(fileText()).toBe(blob(4, { v: 4 }));
    await storage.setItem('key', blob(4, { v: 5 }));
    onChange?.('inactive');
    await jest.advanceTimersByTimeAsync(0);
    expect(fileText()).toBe(blob(4, { v: 5 }));
  } finally {
    jest.useRealTimers();
  }
});

test('a finished temporary file that cannot be moved is still used, and AsyncStorage never overwrites it', async () => {
  files.set(stateFile(`${STATE_FILE}.tmp`).uri, blob(4, { from: 'tmp' }));
  await AsyncStorage.setItem('key', blob(4, { from: 'async' }));
  jest.spyOn(File.prototype, 'move').mockRejectedValue(new Error('busy'));
  expect(await createFileStorage({ version: 4 }).getItem('key')).toBe(blob(4, { from: 'tmp' }));
  expect(fileText(`${STATE_FILE}.tmp`)).toBe(blob(4, { from: 'tmp' }));
  expect(fileText()).toBeUndefined();
});

test('a half-written temporary file falls back to AsyncStorage', async () => {
  files.set(stateFile(`${STATE_FILE}.tmp`).uri, '{"state": {"half');
  await AsyncStorage.setItem('key', blob(4, { from: 'async' }));
  expect(await createFileStorage({ version: 4 }).getItem('key')).toBe(blob(4, { from: 'async' }));
});

test('writes stay blocked when the unreadable file cannot be kept aside', async () => {
  files.set(stateFile().uri, '{broken');
  const storage = createFileStorage({ version: 4 });
  await expect(storage.getItem('key')).rejects.toThrow();
  jest.spyOn(File.prototype, 'copy').mockRejectedValueOnce(new Error('disk full'));
  await expect(storage.allowWrites()).rejects.toThrow('disk full');
  expect(storage.canWrite()).toBe(false);
  await storage.setItem('key', blob(4));
  await storage.flush();
  expect(fileText()).toBe('{broken');
});

test.each([
  ['the state file', (raw: string) => files.set(stateFile().uri, raw)],
  ['AsyncStorage', (raw: string) => AsyncStorage.setItem('key', raw)],
])('data saved by a newer version in %s is refused, not migrated', async (_where, put) => {
  await put(blob(5));
  const storage = createFileStorage({ version: 4 });
  await expect(storage.getItem('key')).rejects.toThrow('saved by a newer version of the app');
  expect(storage.canWrite()).toBe(false);
  expect(fileText('state.v5.json')).toBeUndefined();
});

test('when the first copy to the file fails, the AsyncStorage data is still used and saved later', async () => {
  await AsyncStorage.setItem('key', blob(4, { from: 'async' }));
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const write = jest.spyOn(File.prototype, 'write').mockRejectedValueOnce(new Error('disk full'));
  const storage = createFileStorage({ version: 4 });
  expect(await storage.getItem('key')).toBe(blob(4, { from: 'async' }));
  expect(await AsyncStorage.getItem('key')).toBe(blob(4, { from: 'async' }));
  write.mockRestore();
  storage.enableWrites();
  await storage.setItem('key', blob(4, { saved: true }));
  await storage.flush();
  expect(fileText()).toBe(blob(4, { saved: true }));
});

test('an old-version state file whose copy fails blocks the launch; AsyncStorage data tolerates it', async () => {
  files.set(stateFile().uri, blob(3, { from: 'file' }));
  const write = jest.spyOn(File.prototype, 'write').mockRejectedValue(new Error('disk full'));
  await expect(createFileStorage({ version: 4 }).getItem('key')).rejects.toThrow('disk full');
  write.mockReset();
  files.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  write.mockRejectedValue(new Error('disk full'));
  await AsyncStorage.setItem('key', blob(3, { from: 'async' }));
  expect(await createFileStorage({ version: 4 }).getItem('key')).toBe(blob(3, { from: 'async' }));
});
