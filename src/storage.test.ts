import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { AppState } from 'react-native';
import {
  BEFORE_RESTORE_PREFIX,
  createFileStorage,
  listBeforeRestore,
  listUnreadable,
  MISSING_FILE_ERROR,
  PREV_FILE,
  STATE_FILE,
  stateFile,
  TMP_FILE,
  WRITE_DELAY_MS,
} from './storage';

const fs = jest.requireMock('expo-file-system') as {
  __files: Map<string, string>;
  File: { prototype: object; new (...parts: unknown[]): File };
  Paths: { document: { uri: string; list?: () => File[] } };
};
const files = fs.__files;
// The shared mock has no folder listing yet: list the documents folder from the in-memory files.
if (!Object.getOwnPropertyDescriptor(fs.File.prototype, 'name')) {
  Object.defineProperty(fs.File.prototype, 'name', {
    get(this: { uri: string }) {
      return this.uri.split('/').pop();
    },
  });
}
fs.Paths.document.list ??= () =>
  [...files.keys()]
    .filter((uri) => uri.startsWith(`${fs.Paths.document.uri}/`))
    .map((uri) => new fs.File(uri));

const fileText = (name = STATE_FILE) => files.get(stateFile(name).uri);
const put = (name: string, text: string) => files.set(stateFile(name).uri, text);
const blob = (version: number, state: object = { n: version }) => JSON.stringify({ state, version });
const kept = (list: File[]) => list.map((f) => files.get(f.uri));
const quiet = () => jest.spyOn(console, 'warn').mockImplementation(() => undefined);

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
  expect(kept(listUnreadable())).toEqual([raw]);
  expect(listUnreadable()[0].name).toMatch(/^state\.unreadable\..+\.state\.json$/);
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
  quiet();
  jest.spyOn(File.prototype, 'move').mockRejectedValue(new Error('busy'));
  expect(await createFileStorage({ version: 4 }).getItem('key')).toBe(blob(4, { from: 'tmp' }));
  expect(fileText(`${STATE_FILE}.tmp`)).toBe(blob(4, { from: 'tmp' }));
  expect(fileText()).toBeUndefined();
});

test('a half-written temporary file with no other state file throws instead of falling back', async () => {
  // Before this file layout, a crash during the move could leave exactly this: the state file gone.
  put(TMP_FILE, '{"state": {"half');
  await AsyncStorage.setItem('key', blob(4, { from: 'async' }));
  const storage = createFileStorage({ version: 4 });
  await expect(storage.getItem('key')).rejects.toThrow(MISSING_FILE_ERROR);
  await AsyncStorage.removeItem('key');
  await expect(storage.getItem('key')).rejects.toThrow(MISSING_FILE_ERROR);
  expect(storage.canWrite()).toBe(false);
  await storage.setItem('key', blob(4));
  await storage.flush();
  expect(fileText(TMP_FILE)).toBe('{"state": {"half');
  expect(fileText()).toBeUndefined();
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
  ['the temporary file', (raw: string) => files.set(stateFile(TMP_FILE).uri, raw)],
  ['the previous file', (raw: string) => files.set(stateFile(PREV_FILE).uri, raw)],
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

test('a save keeps the previous state and leaves no temporary file', async () => {
  const storage = createFileStorage({ version: 4 });
  await storage.getItem('key');
  storage.enableWrites();
  for (const v of [1, 2, 3]) {
    await storage.setItem('key', blob(4, { v }));
    await storage.flush();
  }
  expect(fileText()).toBe(blob(4, { v: 3 }));
  expect(fileText(PREV_FILE)).toBe(blob(4, { v: 2 }));
  expect(fileText(TMP_FILE)).toBeUndefined();
});

describe('a save cut off at each step still loads the newest whole copy', () => {
  const realMove = File.prototype.move;
  /** Saves `{ v: 2 }` over `{ v: 1 }`, failing the `failAt`-th move of that save. */
  const cutOff = async (failAt: number) => {
    const storage = createFileStorage({ version: 4 });
    await storage.getItem('key');
    storage.enableWrites();
    await storage.setItem('key', blob(4, { v: 1 }));
    await storage.flush();
    await storage.setItem('key', blob(4, { v: 1, saved: true }));
    await storage.flush();
    quiet();
    const move = jest.spyOn(File.prototype, 'move');
    for (let i = 1; i < failAt; i++) move.mockImplementationOnce(realMove);
    move.mockRejectedValueOnce(new Error('power lost'));
    await storage.setItem('key', blob(4, { v: 2 }));
    await storage.flush();
    move.mockRestore();
  };

  test('writing the temporary file: the state file is whole', async () => {
    const storage = createFileStorage({ version: 4 });
    await storage.getItem('key');
    storage.enableWrites();
    await storage.setItem('key', blob(4, { v: 1 }));
    await storage.flush();
    // Power lost halfway through writing the temporary file.
    put(TMP_FILE, blob(4, { v: 2 }).slice(0, 12));
    expect(await createFileStorage({ version: 4 }).getItem('key')).toBe(blob(4, { v: 1 }));
  });

  test('moving the state file aside: the whole temporary file wins over the state file', async () => {
    await cutOff(1);
    expect(fileText()).toBe(blob(4, { v: 1, saved: true }));
    expect(fileText(TMP_FILE)).toBe(blob(4, { v: 2 }));
    expect(await createFileStorage({ version: 4 }).getItem('key')).toBe(blob(4, { v: 2 }));
    // The read finished the save.
    expect(fileText()).toBe(blob(4, { v: 2 }));
    expect(fileText(PREV_FILE)).toBe(blob(4, { v: 1, saved: true }));
    expect(fileText(TMP_FILE)).toBeUndefined();
  });

  test('moving the temporary file into place: the state file is missing, the temporary file is used', async () => {
    await cutOff(2);
    expect(fileText()).toBeUndefined();
    expect(fileText(PREV_FILE)).toBe(blob(4, { v: 1, saved: true }));
    await AsyncStorage.setItem('key', blob(3, { from: 'async' }));
    expect(await createFileStorage({ version: 4 }).getItem('key')).toBe(blob(4, { v: 2 }));
  });

  test('the temporary file half-written and the state file moved aside: the previous file is used', async () => {
    await cutOff(2);
    put(TMP_FILE, '{"state":{"v":');
    await AsyncStorage.setItem('key', blob(3, { from: 'async' }));
    expect(await createFileStorage({ version: 4 }).getItem('key')).toBe(blob(4, { v: 1, saved: true }));
  });
});

test.each([
  ['an old-version copy that differs from AsyncStorage', 'state.v3.json', blob(3, { other: true })],
  ['a kept unreadable copy', `${'state.unreadable.'}2026-01-01T00-00-00-000Z.state.json`, '{broken'],
  ['a kept copy from before a restore', `${BEFORE_RESTORE_PREFIX}2026-01-01T00-00-00-000Z.json`, blob(4)],
  ['an empty temporary file', TMP_FILE, ''],
])('AsyncStorage is never used once a state file existed: %s', async (_name, file, text) => {
  put(file, text);
  await AsyncStorage.setItem('key', blob(3, { from: 'async' }));
  const storage = createFileStorage({ version: 4 });
  await expect(storage.getItem('key')).rejects.toThrow(MISSING_FILE_ERROR);
  expect(fileText()).toBeUndefined();
  // A fresh install (no AsyncStorage entry) does not start empty either.
  await AsyncStorage.clear();
  await expect(storage.getItem('key')).rejects.toThrow(MISSING_FILE_ERROR);
});

test('files that hold only the AsyncStorage entry, or the start of it, do not block it', async () => {
  const legacy = blob(3, { from: 'async' });
  await AsyncStorage.setItem('key', legacy);
  put('state.v3.json', legacy);
  // The first copy to the file was cut off.
  put(TMP_FILE, legacy.slice(0, 10));
  expect(await createFileStorage({ version: 4 }).getItem('key')).toBe(legacy);
  expect(fileText()).toBe(legacy);
});

test('a refused temporary file and AsyncStorage entry are kept before a restore replaces them', async () => {
  put(TMP_FILE, blob(5, { newer: true }));
  const storage = createFileStorage({ version: 4 });
  await expect(storage.getItem('key')).rejects.toThrow('newer version');
  await storage.allowWrites();
  expect(kept(listUnreadable())).toEqual([blob(5, { newer: true })]);
  await storage.setItem('key', blob(4, { restored: true }));
  await storage.flush();
  expect(fileText()).toBe(blob(4, { restored: true }));

  files.clear();
  await AsyncStorage.setItem('key', blob(5, { async: true }));
  const second = createFileStorage({ version: 4 });
  await expect(second.getItem('key')).rejects.toThrow('newer version');
  await second.allowWrites();
  expect(kept(listUnreadable())).toEqual([blob(5, { async: true })]);
  expect(listUnreadable()[0].name).toMatch(/\.asyncstorage\.json$/);
});

test('kept copies are never overwritten: each failed load adds one, newest first', async () => {
  const iso = jest.spyOn(Date.prototype, 'toISOString');
  put(STATE_FILE, '{first');
  const storage = createFileStorage({ version: 4 });
  await expect(storage.getItem('key')).rejects.toThrow();
  iso.mockReturnValueOnce('2026-01-01T00:00:00.000Z');
  await storage.allowWrites();
  put(STATE_FILE, '{second');
  await expect(storage.getItem('key')).rejects.toThrow();
  iso.mockReturnValueOnce('2026-02-01T00:00:00.000Z');
  await storage.allowWrites();
  expect(kept(listUnreadable())).toEqual(['{second', '{first']);

  // The same name again: the copy fails, nothing is overwritten and writes stay blocked.
  put(STATE_FILE, '{third');
  await expect(storage.getItem('key')).rejects.toThrow();
  iso.mockReturnValueOnce('2026-02-01T00:00:00.000Z');
  await expect(storage.allowWrites()).rejects.toThrow('already exists');
  expect(storage.canWrite()).toBe(false);
  expect(kept(listUnreadable())).toEqual(['{second', '{first']);
  expect(fileText()).toBe('{third');
});

test('every state file present at a failed load is kept, the previous one too', async () => {
  put(STATE_FILE, '{broken');
  put(PREV_FILE, blob(4, { older: true }));
  put(TMP_FILE, '{"state": {"half');
  const storage = createFileStorage({ version: 4 });
  await expect(storage.getItem('key')).rejects.toThrow();
  await storage.allowWrites();
  expect(kept(listUnreadable()).sort()).toEqual(
    ['{"state": {"half', '{broken', blob(4, { older: true })].sort(),
  );
});

test('a restore or reset first keeps the current data, with the change still waiting to be saved', async () => {
  const storage = createFileStorage({ version: 4 });
  await storage.getItem('key');
  // Nothing saved yet: nothing to keep.
  await storage.keepBeforeRestore();
  expect(listBeforeRestore()).toEqual([]);
  storage.enableWrites();
  await storage.setItem('key', blob(4, { v: 1 }));
  await storage.keepBeforeRestore();
  expect(kept(listBeforeRestore())).toEqual([blob(4, { v: 1 })]);
  expect(listBeforeRestore()[0].name.startsWith(BEFORE_RESTORE_PREFIX)).toBe(true);

  jest.spyOn(Date.prototype, 'toISOString').mockReturnValueOnce('2026-03-01T00:00:00.000Z');
  jest.spyOn(File.prototype, 'copy').mockRejectedValueOnce(new Error('disk full'));
  await expect(storage.keepBeforeRestore()).rejects.toThrow('disk full');
  expect(listBeforeRestore()).toHaveLength(1);
});

test('the kept-copy lists are empty when the folder cannot be listed', () => {
  const list = jest.spyOn(fs.Paths.document, 'list').mockImplementation(() => {
    throw new Error('no access');
  });
  expect(listUnreadable()).toEqual([]);
  list.mockRestore();
});

test('a load that cannot list the folder throws instead of falling back to AsyncStorage', async () => {
  await AsyncStorage.setItem('key', blob(4));
  jest.spyOn(fs.Paths.document, 'list').mockImplementation(() => {
    throw new Error('no access');
  });
  await expect(createFileStorage({ version: 4 }).getItem('key')).rejects.toThrow('no access');
});
