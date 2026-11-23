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
  /** False until the store enables writes, and again from the start of every read. */
  canWrite(): boolean;
  /**
   * Allow writes. The store calls this only once the data it read has been migrated and merged: reading alone
   * never enables writes, so a failed migration cannot save the defaults over the file.
   */
  enableWrites(): void;
  /**
   * After a failed read, allow writes again (the user restores a backup). The unreadable file is copied aside
   * first; when that copy fails, writes stay blocked and the promise rejects.
   */
  allowWrites(): Promise<void>;
}

export const NEWER_VERSION_ERROR =
  'The data was saved by a newer version of the app. Update the app to open it.';

/** Throws unless `raw` is a persisted store blob (`{ state, version }`). */
function parsed(raw: string): { state: unknown; version?: unknown } {
  const value: unknown = JSON.parse(raw);
  const state =
    typeof value === 'object' && value !== null ? (value as { state?: unknown }).state : undefined;
  if (typeof state !== 'object' || state === null || Array.isArray(state))
    throw new Error('The saved data is not app data');
  return value as { state: unknown; version?: unknown };
}

/**
 * A zustand `StateStorage` over a file. Writes go to `state.json.tmp` and are then moved over `state.json`,
 * so a crash mid-write leaves the previous file whole. Writes are debounced and run one at a time.
 *
 * Reading: `state.json`, else a finished `state.json.tmp` (a crash between removing the old file and moving
 * the new one), else the AsyncStorage entry `name` from before the file existed (copied to the file, the
 * entry is kept), else nothing (a fresh install). A read that fails throws. Writes stay blocked from the start
 * of every read until the store calls `enableWrites`, so the defaults of a failed launch never replace stored
 * data, and a failed preservation step (copy, backup, move) never enables an overwrite.
 *
 * `version`: data stored by an older store version is copied once to `state.v<old>.json` before the store
 * migrates it (for the file this copy must succeed; AsyncStorage keeps its own original). Data from a newer
 * version is refused.
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

  /** Throws when `raw` is not app data or comes from a newer store version (it must not be migrated). */
  const check = (raw: string): number | undefined => {
    const stored = parsed(raw).version;
    if (typeof stored === 'number' && stored > version) throw new Error(NEWER_VERSION_ERROR);
    return typeof stored === 'number' ? stored : undefined;
  };

  const keepOldVersion = async (raw: string) => {
    const old = check(raw);
    if (old === undefined || old >= version) return;
    const copy = stateFile(`state.v${old}.json`);
    if (!copy.exists) await copy.write(raw);
  };

  const read = async (name: string): Promise<string | null> => {
    const main = stateFile();
    if (main.exists) {
      const raw = await main.text();
      check(raw);
      await keepOldVersion(raw);
      return raw;
    }
    const tmp = stateFile(TMP_FILE);
    if (tmp.exists) {
      const raw = await tmp.text();
      let whole = true;
      try {
        parsed(raw);
      } catch {
        // A first write that never finished: the AsyncStorage entry below is still the latest data.
        whole = false;
      }
      if (whole) {
        check(raw);
        await keepOldVersion(raw);
        try {
          await tmp.move(main, { overwrite: true });
        } catch (e) {
          // The data is whole; the next save writes both files again.
          console.warn('Could not move the saved data into place', e);
        }
        return raw;
      }
    }
    const legacy = await AsyncStorage.getItem(name);
    if (legacy === null) return null;
    check(legacy);
    // The AsyncStorage entry is never written, so it stays the original whatever happens to these copies.
    try {
      await keepOldVersion(legacy);
      await writeAtomically(legacy);
    } catch (e) {
      console.warn('Could not copy the saved data to a file yet; the next save tries again', e);
    }
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
          if (status === 'background' || status === 'inactive') void flush();
        });
      }
      return read(name);
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
    enableWrites() {
      writable = true;
    },
    allowWrites() {
      const copied = chain.then(async () => {
        const main = stateFile();
        if (main.exists) await main.copy(stateFile(UNREADABLE_FILE), { overwrite: true });
        writable = true;
      });
      chain = copied.catch(() => undefined);
      return copied;
    },
  };
}
