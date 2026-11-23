import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { AppState } from 'react-native';
import type { StateStorage } from 'zustand/middleware';

/** The app state lives in one file in the app's documents folder. */
export const STATE_FILE = 'state.json';
const TMP_FILE = `${STATE_FILE}.tmp`;
/** Where the unreadable file is kept when the user replaces it with a backup. */
export const UNREADABLE_FILE = 'state.unreadable.json';
/** Changes are written at most this often; going to the background writes at once. */
export const WRITE_DELAY_MS = 500;

export const stateFile = (name = STATE_FILE): File => new File(Paths.document, name);

export interface FileStorage extends StateStorage {
  /** Write the latest change now. Resolves once it is on disk (or the write failed and stays pending). */
  flush(): Promise<void>;
  /** False until a read succeeds, and after a failed one: nothing is written then. */
  canWrite(): boolean;
  /**
   * After a failed read, allow writes again (the user restores a backup). The unreadable file is copied aside
   * first; later writes wait for the copy.
   */
  allowWrites(): Promise<void>;
}

/** Throws unless `raw` is a persisted store blob (`{ state, version }`). */
function parsed(raw: string): { state: unknown; version?: unknown } {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || typeof (value as { state?: unknown }).state !== 'object')
    throw new Error('The saved data is not app data');
  return value as { state: unknown; version?: unknown };
}

/**
 * A zustand `StateStorage` over a file. Writes go to `state.json.tmp` and are then moved over `state.json`,
 * so a crash mid-write leaves the previous file whole. Writes are debounced and run one at a time.
 *
 * Reading: `state.json`, else a finished `state.json.tmp` (a crash between removing the old file and moving
 * the new one), else the AsyncStorage entry `name` from before the file existed (copied to the file, the
 * entry is kept), else nothing (a fresh install). A read that fails throws and leaves writes blocked, so the
 * defaults of a failed launch never replace stored data.
 *
 * `version`: data stored by an older store version is copied once to `state.v<old>.json` before the store
 * migrates it.
 */
export function createFileStorage({ version }: { version: number }): FileStorage {
  let writable = false;
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  let listening = false;

  const writeAtomically = async (value: string) => {
    const tmp = stateFile(TMP_FILE);
    await tmp.write(value);
    await tmp.move(stateFile(), { overwrite: true });
  };

  const keepOldVersion = async (raw: string) => {
    const old = parsed(raw).version;
    if (typeof old !== 'number' || old >= version) return;
    const copy = stateFile(`state.v${old}.json`);
    if (!copy.exists) await copy.write(raw);
  };

  const read = async (name: string): Promise<string | null> => {
    const main = stateFile();
    if (main.exists) {
      const raw = await main.text();
      parsed(raw);
      await keepOldVersion(raw);
      return raw;
    }
    const tmp = stateFile(TMP_FILE);
    if (tmp.exists) {
      const raw = await tmp.text();
      try {
        parsed(raw);
        await tmp.move(main, { overwrite: true });
        return raw;
      } catch {
        // A first write that never finished: the AsyncStorage entry below is still the latest data.
      }
    }
    const legacy = await AsyncStorage.getItem(name);
    if (legacy === null) return null;
    parsed(legacy);
    await keepOldVersion(legacy);
    await writeAtomically(legacy);
    return legacy;
  };

  const flush = (): Promise<void> => {
    if (timer) clearTimeout(timer);
    timer = null;
    chain = chain.then(async () => {
      if (pending === null || !writable) return;
      const value = pending;
      pending = null;
      try {
        await writeAtomically(value);
      } catch (e) {
        // The old file is untouched; keep the change for the next write unless a newer one arrived.
        if (pending === null) pending = value;
        console.warn('Saving failed; will retry on the next change', e);
      }
    });
    return chain;
  };

  return {
    async getItem(name) {
      // A read replaces the state in memory: changes queued before it are stale.
      writable = false;
      pending = null;
      if (timer) clearTimeout(timer);
      timer = null;
      if (!listening) {
        listening = true;
        AppState.addEventListener('change', (status) => {
          if (status === 'background') void flush();
        });
      }
      const raw = await read(name);
      writable = true;
      return raw;
    },
    setItem(_name, value) {
      if (!writable) return;
      pending = value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), WRITE_DELAY_MS);
    },
    removeItem() {
      // Never deletes stored data: a reset writes the fresh state instead.
    },
    flush,
    canWrite: () => writable,
    allowWrites() {
      writable = true;
      chain = chain.then(async () => {
        const main = stateFile();
        try {
          if (main.exists) await main.copy(stateFile(UNREADABLE_FILE), { overwrite: true });
        } catch {
          // Best effort: the user already chose to replace it.
        }
      });
      return chain;
    },
  };
}
