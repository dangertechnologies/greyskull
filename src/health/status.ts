import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** `unavailable`: this device has no Health (iPad without Health, Health Connect missing, web). */
export type Permission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export interface HealthStatus {
  /** When sync was switched on (ISO). Only workouts finished after it are written on their own; older ones go with Export. */
  since: string | null;
  /** Sessions already written that were edited since: written again with a higher version. */
  dirty: number[];
  /** After a failure: how many failures in a row, and when the next automatic try may start (ms since epoch). */
  retry: { attempts: number; at: number } | null;
  /** Version of the last write per session number: the next write goes higher, even if the clock went back. */
  versions: Record<number, number>;
  lastSyncAt: string | null;
  lastError: { at: string; message: string } | null;
  /** Last answer from the system. Not persisted: it is asked again on every launch. */
  permission: Permission | 'unknown';
}

export const initialHealthStatus = (): HealthStatus => ({
  since: null,
  dirty: [],
  retry: null,
  versions: {},
  lastSyncAt: null,
  lastError: null,
  permission: 'unknown',
});

/** Sync bookkeeping kept on the device in its own key; never part of the workout data or its backups. */
export const useHealthStatus = create<HealthStatus>()(
  persist(initialHealthStatus, {
    name: 'greyskull-health-v1',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: ({ permission: _permission, ...rest }) => rest as HealthStatus,
  }),
);
