import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { type PersistStorage, persist } from 'zustand/middleware';
import type { TimerAnchor, TimerPlan } from './clock';

/** What the app-level owner needs to word a block's alerts and Live Activity without the session screen. */
export interface TimerBlock {
  kind: 'emom' | 'interval';
  plan: TimerPlan;
  /** One per step: "Minute 4 of 10" / "Round 2 of 4", the exercise and its target. */
  steps: { label: string; name: string; target: string }[];
}

/**
 * The anchors of the open workout's EMOM and interval timers, by group id, kept apart from the main state so the
 * workout log keeps its shape (the cost: the two are not saved together, and the anchors are not in backups).
 * Only one workout is open at a time: anchors of another session id are dropped when a timer of a new one
 * starts, and cleared when the workout is finished or discarded (see ./owner).
 */
interface TimerState {
  n: number | null;
  anchors: Record<string, TimerAnchor>;
  blocks: Record<string, TimerBlock>;
  /** "Notifications are off" was said once already. */
  toldDenied: boolean;
  setAnchor(n: number, group: string, anchor: TimerAnchor, block?: TimerBlock): void;
  setToldDenied(): void;
  /** Forget every timer (the workout they belong to is gone). */
  clear(): void;
}

type Persisted = Pick<TimerState, 'n' | 'anchors' | 'blocks' | 'toldDenied'>;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** A stored anchor with the right shape, or null (anything else is dropped: no timer rather than a crash). */
export function validAnchor(v: unknown): TimerAnchor | null {
  if (!isObject(v) || !finite(v.startedAt) || !finite(v.skipMs) || !Array.isArray(v.pauses)) return null;
  if (v.endedAt !== undefined && !finite(v.endedAt)) return null;
  const pauses = v.pauses as unknown[];
  if (!pauses.every((p) => isObject(p) && finite(p.from) && (p.to === undefined || finite(p.to))))
    return null;
  return {
    startedAt: v.startedAt,
    skipMs: v.skipMs,
    pauses: pauses.map((p) => {
      const { from, to } = p as { from: number; to?: number };
      return to === undefined ? { from } : { from, to };
    }),
    ...(v.endedAt === undefined ? {} : { endedAt: v.endedAt }),
  };
}

function validBlock(v: unknown): TimerBlock | null {
  if (!isObject(v) || (v.kind !== 'emom' && v.kind !== 'interval') || !isObject(v.plan)) return null;
  const { steps, workS, restS } = v.plan;
  if (!finite(steps) || !finite(workS) || !finite(restS) || !Array.isArray(v.steps)) return null;
  const list = v.steps as unknown[];
  if (!list.every((s) => isObject(s) && ['label', 'name', 'target'].every((k) => typeof s[k] === 'string')))
    return null;
  return { kind: v.kind, plan: { steps, workS, restS }, steps: list as TimerBlock['steps'] };
}

const keep = <T>(v: unknown, valid: (x: unknown) => T | null): Record<string, T> =>
  isObject(v)
    ? Object.fromEntries(Object.entries(v).flatMap(([k, x]) => (valid(x) ? [[k, valid(x) as T]] : [])))
    : {};

/** The stored timers, keeping only what has the right shape. */
export function validTimers(v: unknown): Persisted {
  if (!isObject(v)) return { n: null, anchors: {}, blocks: {}, toldDenied: false };
  return {
    n: finite(v.n) ? v.n : null,
    anchors: keep(v.anchors, validAnchor),
    blocks: keep(v.blocks, validBlock),
    toldDenied: v.toldDenied === true,
  };
}

/** AsyncStorage that never throws: a failed or corrupt read is no timers, so hydration always finishes. */
const storage: PersistStorage<Persisted> = {
  getItem: async (name) => {
    try {
      const raw = await AsyncStorage.getItem(name);
      return raw ? (JSON.parse(raw) as { state: Persisted; version: number }) : null;
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await AsyncStorage.setItem(name, JSON.stringify(value));
    } catch {
      // A timer that is not saved restarts from its last saved anchor (or from Start) after a relaunch.
    }
  },
  removeItem: async (name) => {
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      // Nothing to remove.
    }
  },
};

const EMPTY = { n: null, anchors: {}, blocks: {} };

export const useTimers = create<TimerState>()(
  persist(
    (set) => ({
      ...EMPTY,
      toldDenied: false,
      setAnchor: (n, group, anchor, block) =>
        set((s) => {
          const same = s.n === n;
          return {
            n,
            anchors: { ...(same ? s.anchors : {}), [group]: anchor },
            blocks: block ? { ...(same ? s.blocks : {}), [group]: block } : same ? s.blocks : {},
          };
        }),
      setToldDenied: () => set({ toldDenied: true }),
      clear: () => set(EMPTY),
    }),
    {
      name: 'greyskull-timers',
      version: 1,
      storage,
      // Every stored shape goes through `merge`, which keeps only valid anchors.
      migrate: (stored) => stored as Persisted,
      partialize: ({ n, anchors, blocks, toldDenied }) => ({ n, anchors, blocks, toldDenied }),
      merge: (persisted, current) => {
        try {
          return { ...current, ...validTimers(persisted) };
        } catch {
          return current;
        }
      },
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
