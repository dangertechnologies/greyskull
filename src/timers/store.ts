import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TimerAnchor } from './clock';

/**
 * The anchors of the open workout's EMOM and interval timers, by group id, kept apart from the main state so the
 * workout log keeps its shape. Only one workout is open at a time: anchors of another session id are dropped
 * when a timer of a new one starts, and never read.
 */
interface TimerState {
  n: number | null;
  anchors: Record<string, TimerAnchor>;
  /** "Notifications are off" was said once already. */
  toldDenied: boolean;
  setAnchor(n: number, group: string, anchor: TimerAnchor): void;
  setToldDenied(): void;
}

export const useTimers = create<TimerState>()(
  persist(
    (set) => ({
      n: null,
      anchors: {},
      toldDenied: false,
      setAnchor: (n, group, anchor) =>
        set((s) => ({ n, anchors: { ...(s.n === n ? s.anchors : {}), [group]: anchor } })),
      setToldDenied: () => set({ toldDenied: true }),
    }),
    {
      name: 'greyskull-timers',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ n, anchors, toldDenied }) => ({ n, anchors, toldDenied }),
    },
  ),
);

/** The anchor of `group` in session `n`, if its timer was started. */
export const anchorOf = (
  s: Pick<TimerState, 'n' | 'anchors'>,
  n: number,
  group: string,
): TimerAnchor | undefined => (s.n === n ? s.anchors[group] : undefined);

/** Whether the anchors were read back from storage (a timer screen waits for this before it decides). */
export function useTimersHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useTimers.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return undefined;
    if (useTimers.persist.hasHydrated()) setHydrated(true);
    return useTimers.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);
  return hydrated;
}
