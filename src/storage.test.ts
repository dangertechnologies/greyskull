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

test('a fresh install reads nothing and then writes the file', async () => {
  const storage = createFileStorage({ version: 4 });
  expect(await storage.getItem('key')).toBeNull();
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
  } finally {
    jest.useRealTimers();
  }
});
