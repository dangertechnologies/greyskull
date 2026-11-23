import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { AppState } from 'react-native';
import type { StateStorage } from 'zustand/middleware';

/** The app state lives in one file in the app's documents folder. */
export const STATE_FILE = 'state.json';
export const TMP_FILE = `${STATE_FILE}.tmp`;
/** The state as it was before the last save. */
export const PREV_FILE = 'state.prev.json';
/** Copies of data that could not be read, kept when the user restores a backup over it. Never overwritten. */
export const UNREADABLE_PREFIX = 'state.unreadable.';
/** Copies of the data a restore or a reset replaced. Never overwritten. */
export const BEFORE_RESTORE_PREFIX = 'state.before-restore.';
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
   * After a failed read, allow writes again (the user restores a backup). Every state file, and the AsyncStorage
   * entry when that was what could not be read, is first copied to a new `state.unreadable.<time>.<source>.json`;
   * when a copy fails, writes stay blocked and the promise rejects.
   */
  allowWrites(): Promise<void>;
  /**
   * Before a restore or a reset replaces the data: saves any pending change, then copies `state.json` to a new
   * `state.before-restore.<time>.json`. Rejects when the copy fails; the caller must then not replace anything.
   */
  keepBeforeRestore(): Promise<void>;
}

export const NEWER_VERSION_ERROR =
  'The data was saved by a newer version of the app. Update the app to open it.';
export const MISSING_FILE_ERROR =
  'The saved data file is missing or was only partly written. Export the copies kept on this device, or restore a backup.';

/** Throws unless `raw` is a persisted store blob (`{ state, version }`). */
function parsed(raw: string): { state: unknown; version?: unknown } {
  const value: unknown = JSON.parse(raw);
  const state =
    typeof value === 'object' && value !== null ? (value as { state?: unknown }).state : undefined;
  if (typeof state !== 'object' || state === null || Array.isArray(state))
    throw new Error('The saved data is not app data');
  return value as { state: unknown; version?: unknown };
}

const isWhole = (raw: string): boolean => {
  try {
    parsed(raw);
    return true;
  } catch {
    return false;
  }
};

/** Names of the files in the documents folder. Throws when the folder cannot be listed. */
const documentNames = (): string[] => Paths.document.list().map((entry) => entry.name);

const listKept = (prefix: string): File[] => {
  try {
    return documentNames()
      .filter((name) => name.startsWith(prefix))
      .sort()
      .reverse()
      .map((name) => stateFile(name));
  } catch {
    return [];
  }
};

/** The kept copies of unreadable data, newest first (empty when the folder cannot be listed). */
export const listUnreadable = (): File[] => listKept(UNREADABLE_PREFIX);
/** The kept copies of data a restore or reset replaced, newest first. */
export const listBeforeRestore = (): File[] => listKept(BEFORE_RESTORE_PREFIX);

/** Writes `source` (a file or text) to a new `<prefix><time>[.<label>].json`. Never overwrites a file. */
async function keepCopy(prefix: string, source: File | string, label?: string): Promise<void> {
  const time = new Date().toISOString().replace(/[:.]/g, '-');
  const to = stateFile(`${prefix}${time}${label ? `.${label}` : ''}.json`);
  if (to.exists) throw new Error(`A kept copy named ${to.uri} already exists`);
  if (typeof source === 'string') await to.write(source);
  else await source.copy(to);
}

/**
 * A zustand `StateStorage` over a file.
 *
 * Saving: write `state.json.tmp`, move `state.json` to `state.prev.json`, move the temporary file to
 * `state.json`. At every moment one whole copy exists: the temporary file once it is written, else
 * `state.json`, else `state.prev.json`. Writes are debounced and run one at a time.
 *
 * Reading: a whole `state.json.tmp` (the move after it never happened, so it is the newest), else `state.json`,
 * else `state.prev.json`. Only when none of these is whole and no state file was ever written does it fall back
 * to the AsyncStorage entry `name` from before the files existed (copied to the file, the entry is kept), else
 * nothing (a fresh install). Otherwise, and whenever a read fails, it throws: the recovery screen shows instead.
 * Writes stay blocked from the start of every read until the store calls `enableWrites`, so the defaults of a
 * failed launch never replace stored data, and a failed preservation step (copy, backup, move) never enables an
 * overwrite. Nothing here deletes a file other than what a move replaces.
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
  /** The AsyncStorage text the last read refused, so `allowWrites` can keep a copy of it. */
  let refusedLegacy: string | null = null;

  /** Moves the written temporary file into place, keeping the current file as the previous one. */
  const promote = async () => {
    const main = stateFile();
    if (main.exists) await main.move(stateFile(PREV_FILE), { overwrite: true });
    // No overwrite: `state.json` was just moved away, and a move never deletes a file to make room.
    await stateFile(TMP_FILE).move(stateFile());
  };

  const writeAtomically = async (value: string) => {
    await stateFile(TMP_FILE).write(value);
    await promote();
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

  /**
   * True when a state file holds anything beyond the AsyncStorage entry `legacy`: data was saved to the files
   * after it, so falling back to the entry would bring back old data. A copy of the entry, or the start of one
   * whose write was cut off (the first copy to the file), holds nothing newer.
   */
  const savedSinceLegacy = async (legacy: string | null): Promise<boolean> => {
    for (const name of documentNames()) {
      if (!name.startsWith('state.')) continue;
      const text = await stateFile(name).text();
      if (legacy === null || text === '' || !legacy.startsWith(text)) return true;
    }
    return false;
  };

  const read = async (name: string): Promise<string | null> => {
    const tmp = stateFile(TMP_FILE);
    if (tmp.exists) {
      const raw = await tmp.text();
      // A half-written temporary file is a save that never finished: the files below are whole.
      if (isWhole(raw)) {
        check(raw);
        await keepOldVersion(raw);
        try {
          await promote();
        } catch (e) {
          // The data is whole and stays in the temporary file until the next save moves it.
          console.warn('Could not move the saved data into place', e);
        }
        return raw;
      }
    }
    for (const file of [stateFile(), stateFile(PREV_FILE)]) {
      if (!file.exists) continue;
      const raw = await file.text();
      check(raw);
      await keepOldVersion(raw);
      return raw;
    }
    const legacy = await AsyncStorage.getItem(name);
    if (await savedSinceLegacy(legacy)) throw new Error(MISSING_FILE_ERROR);
    if (legacy === null) return null;
    try {
      check(legacy);
    } catch (e) {
      refusedLegacy = legacy;
      throw e;
    }
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
        // A whole copy is still on disk; keep the change for the next write unless a newer one arrived.
        if (pending === null) pending = value;
        console.warn('Saving failed; will retry on the next change', e);
      }
    });
    return chain;
  };

  /** Runs `step` after every queued write; the queue continues whether it fails or not. */
  const queue = (step: () => Promise<void>): Promise<void> => {
    const done = chain.then(step);
    chain = done.catch(() => undefined);
    return done;
  };

  return {
    async getItem(name) {
      // A read replaces the state in memory: changes queued before it are stale.
      writable = false;
      pending = null;
      refusedLegacy = null;
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
    allowWrites: () =>
      queue(async () => {
        // The next saves replace all three files, so each is kept, whatever it holds.
        for (const [file, label] of [
          [STATE_FILE, 'state'],
          [TMP_FILE, 'tmp'],
          [PREV_FILE, 'prev'],
        ] as const) {
          const source = stateFile(file);
          if (source.exists) await keepCopy(UNREADABLE_PREFIX, source, label);
        }
        if (refusedLegacy !== null) await keepCopy(UNREADABLE_PREFIX, refusedLegacy, 'asyncstorage');
        writable = true;
      }),
    keepBeforeRestore() {
      void flush();
      return queue(async () => {
        const main = stateFile();
        // ponytail: one full copy per restore or reset, never pruned; the files are small.
        if (main.exists) await keepCopy(BEFORE_RESTORE_PREFIX, main);
      });
    },
  };
}
