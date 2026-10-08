import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { builtInExercises, CATALOG_VERSION, refreshCatalog } from './catalog';
import type {
  AppState,
  Exercise,
  ExerciseResult,
  LiftState,
  Outcome,
  PlateInventory,
  Program,
  SessionLog,
  Unit,
} from './domain';
import {
  DEFAULT_INVENTORY,
  DEFAULT_STEP,
  exerciseIdsOf,
  migrateV1,
  nextLift,
  roundForExercise,
  sessionFor,
  sessionWeightKg,
  setTargets,
  toKg,
  validateProgram,
} from './domain';

export const STORAGE_KEY = 'gslp-v2';
export const LEGACY_KEY = 'GSLP_STATE_18';

export const MAX_REST_SECONDS = 300;

export function initialState(): AppState {
  return {
    version: 2,
    unit: 'kg',
    inventory: JSON.parse(JSON.stringify(DEFAULT_INVENTORY)) as PlateInventory,
    minimalist: false,
    restSeconds: 90,
    exercises: builtInExercises(),
    program: null,
    lifts: {},
    sessions: [],
    nextSession: 0,
    draft: null,
    needsWeightConfirm: false,
    needsWeightConfirmSuspects: [],
    legacyChecked: false,
    catalogVersion: CATALOG_VERSION,
  };
}

interface Actions {
  setUnit(unit: Unit): void;
  setInventory(patch: Partial<PlateInventory>): void;
  setSettings(patch: { minimalist?: boolean; restSeconds?: number }): void;
  setProgram(program: Program): void;
  setLift(id: string, patch: Partial<LiftState>): void;
  startSession(n: number): SessionLog;
  logSet(exerciseId: string, setIndex: number, reps: number): void;
  setDraftWeight(exerciseId: string, kg: number): void;
  finishSession(): Record<string, Outcome>;
  skipSession(): void;
  editSession(n: number, results: Record<string, ExerciseResult>): void;
  upsertExercise(exercise: Exercise): void;
  deleteExercise(id: string): string[];
  confirmWeights(weights: Record<string, number>): void;
  exportJson(): string;
  reset(): void;
  /** Import v1 data from `raw`, or from the legacy key when omitted (read-only; the key is never written). */
  importLegacy(raw?: string): Promise<boolean>;
}

export type Store = AppState & { hydrated: boolean } & Actions;

const STATE_KEYS = Object.keys(initialState()) as (keyof AppState)[];

/** The persisted slice: all AppState fields, no actions, no `hydrated`. */
export function snapshot(s: AppState): AppState {
  const out: Partial<Record<keyof AppState, unknown>> = {};
  for (const k of STATE_KEYS) out[k] = s[k];
  return out as unknown as AppState;
}

const barKg = (inv: PlateInventory, unit: Unit): number => toKg(unit === 'kg' ? inv.barKg : inv.barLb, unit);

export function startingWeightKg(exercise: Exercise, inv: PlateInventory, unit: Unit): number {
  if (exercise.kind === 'barbell') return barKg(inv, unit);
  return toKg((exercise.step ?? DEFAULT_STEP)[unit], unit);
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState(),
      hydrated: false,

      setUnit: (unit) =>
        set((s) => {
          if (unit === s.unit) return {};
          // Weights are stored in kg, but a bar loaded in lb is not a whole number of kg: move every
          // working weight to the nearest weight that is loadable in the new unit.
          const snap = (id: string, kg: number): number => {
            const exercise = s.exercises[id];
            return exercise && kg > 0 ? roundForExercise(kg, exercise, 'nearest', s.inventory, unit) : kg;
          };
          const lifts = Object.fromEntries(
            Object.entries(s.lifts).map(([id, l]) => [
              id,
              { ...l, weightKg: snap(id, l.weightKg), startKg: snap(id, l.startKg) },
            ]),
          );
          const draft = s.draft && {
            ...s.draft,
            results: Object.fromEntries(
              Object.entries(s.draft.results).map(([id, r]) => [
                id,
                { ...r, weightKg: snap(id, r.weightKg) },
              ]),
            ),
          };
          return { unit, lifts, draft };
        }),
      setInventory: (patch) => set((s) => ({ inventory: { ...s.inventory, ...patch } })),
      setSettings: ({ minimalist, restSeconds }) =>
        set((s) => ({
          minimalist: minimalist ?? s.minimalist,
          restSeconds:
            restSeconds === undefined
              ? s.restSeconds
              : Math.min(MAX_REST_SECONDS, Math.max(0, Math.round(restSeconds))),
        })),

      setProgram: (program) => {
        const { exercises, lifts, inventory, unit } = get();
        const errors = validateProgram(program, exercises);
        if (errors.length > 0) throw new Error(errors.join('\n'));
        const next = { ...lifts };
        for (const id of exerciseIdsOf(program)) {
          const exercise = exercises[id];
          if (exercise.kind === 'bodyweight' || next[id]) continue;
          const kg = startingWeightKg(exercise, inventory, unit);
          next[id] = { weightKg: kg, startKg: kg, fails: 0 };
        }
        set({ program, lifts: next, draft: null });
      },

      setLift: (id, patch) => {
        if (patch.weightKg !== undefined && !(patch.weightKg > 0)) throw new Error('Weight must be positive');
        set((s) => {
          const existing = s.lifts[id];
          if (existing) return { lifts: { ...s.lifts, [id]: { ...existing, ...patch } } };
          const weightKg = patch.weightKg ?? barKg(s.inventory, s.unit);
          return { lifts: { ...s.lifts, [id]: { weightKg, startKg: weightKg, fails: 0, ...patch } } };
        });
      },

      startSession: (n) => {
        const { draft, program, lifts, exercises, inventory, unit } = get();
        if (draft?.n === n) return draft;
        if (!program) throw new Error('No program');
        const session = sessionFor(program, n);
        const results: Record<string, ExerciseResult> = {};
        for (const { exercise: id, scheme } of session.slots) {
          const exercise = exercises[id];
          const working = lifts[id]?.weightKg ?? barKg(inventory, unit);
          results[id] = {
            weightKg: exercise
              ? sessionWeightKg(working, session.intensity, exercise, inventory, unit)
              : working,
            sets: setTargets(scheme, lifts[id]?.reps).map((target) => ({ target, reps: 0 })),
          };
        }
        const created: SessionLog = {
          n,
          dayName: session.dayName,
          startedAt: new Date().toISOString(),
          results,
          order: session.slots.map((s) => s.exercise),
          ...(session.intensity < 1 ? { intensity: session.intensity } : {}),
        };
        set({ draft: created });
        return created;
      },

      logSet: (exerciseId, setIndex, reps) =>
        set((s) => {
          const result = s.draft?.results[exerciseId];
          if (!s.draft || !result?.sets[setIndex]) return {};
          const sets = result.sets.map((set_, i) =>
            i === setIndex ? { ...set_, reps: Math.max(0, Math.round(reps)) } : set_,
          );
          return {
            draft: { ...s.draft, results: { ...s.draft.results, [exerciseId]: { ...result, sets } } },
          };
        }),

      setDraftWeight: (exerciseId, kg) =>
        set((s) => {
          const result = s.draft?.results[exerciseId];
          if (!s.draft || !result || !(kg > 0)) return {};
          return {
            draft: { ...s.draft, results: { ...s.draft.results, [exerciseId]: { ...result, weightKg: kg } } },
          };
        }),

      finishSession: () => {
        const { draft, program, lifts, exercises, inventory, unit } = get();
        if (!draft) throw new Error('No session in progress');
        if (!program) throw new Error('No program');
        const outcomes: Record<string, Outcome> = {};
        const nextLifts = { ...lifts };
        const schemes = new Map(sessionFor(program, draft.n).slots.map((s) => [s.exercise, s.scheme]));
        for (const id of draft.order) {
          const exercise = exercises[id];
          const result = draft.results[id];
          if (!exercise || !result) continue;
          const lift = lifts[id] ?? { weightKg: result.weightKg, startKg: result.weightKg, fails: 0 };
          const outcome = nextLift(lift, result, program.rules, exercise, inventory, unit, {
            scheme: schemes.get(id),
            intensity: draft.intensity ?? 1,
          });
          outcomes[id] = outcome;
          if (outcome.change !== 'none') nextLifts[id] = outcome.next;
        }
        set((s) => ({
          sessions: [...s.sessions, { ...draft, finishedAt: new Date().toISOString() }],
          lifts: nextLifts,
          nextSession: draft.n + 1,
          draft: null,
        }));
        return outcomes;
      },

      skipSession: () =>
        set((s) => {
          const now = new Date().toISOString();
          const skipped: SessionLog = {
            n: s.nextSession,
            dayName: '',
            startedAt: now,
            finishedAt: now,
            results: {},
            order: [],
            skipped: true,
          };
          return { sessions: [...s.sessions, skipped], nextSession: s.nextSession + 1, draft: null };
        }),

      editSession: (n, results) =>
        set((s) => ({ sessions: s.sessions.map((log) => (log.n === n ? { ...log, results } : log)) })),

      upsertExercise: (exercise) => set((s) => ({ exercises: { ...s.exercises, [exercise.id]: exercise } })),

      deleteExercise: (id) => {
        const { exercises, program } = get();
        const exercise = exercises[id];
        if (!exercise) return [];
        if (!exercise.custom) throw new Error('Built-in exercises cannot be deleted');
        const using = (program?.days ?? []).filter((d) =>
          d.slots.some((slot) =>
            (typeof slot.exercise === 'string' ? [slot.exercise] : slot.exercise).includes(id),
          ),
        );
        if (using.length > 0) return using.map((d) => d.name);
        set((s) => {
          const { [id]: _removed, ...rest } = s.exercises;
          const { [id]: _lift, ...lifts } = s.lifts;
          return { exercises: rest, lifts };
        });
        return [];
      },

      confirmWeights: (weights) =>
        set((s) => {
          const lifts = { ...s.lifts };
          for (const [id, kg] of Object.entries(weights)) {
            if (!(kg > 0)) continue;
            lifts[id] = { ...(lifts[id] ?? { weightKg: kg, startKg: kg, fails: 0 }), weightKg: kg };
          }
          return { lifts, needsWeightConfirm: false, needsWeightConfirmSuspects: [] };
        }),

      exportJson: () => JSON.stringify(snapshot(get()), null, 2),

      reset: () => set({ ...initialState(), legacyChecked: true }),

      importLegacy: async (raw) => {
        const data = raw ?? (await AsyncStorage.getItem(LEGACY_KEY));
        const migrated = data === null ? null : migrateV1(data, get().exercises);
        if (!migrated) return false;
        set(migrated.patch);
        return true;
      },
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      skipHydration: true,
      partialize: (s) => snapshot(s),
    },
  ),
);

/** Load persisted state, import v1 data once if this is a first v2 launch, then mark the store hydrated. */
export async function initStore(): Promise<void> {
  try {
    await useStore.persist.rehydrate();
    const s = useStore.getState();
    if ((s.catalogVersion ?? 0) < CATALOG_VERSION) {
      useStore.setState({ exercises: refreshCatalog(s.exercises), catalogVersion: CATALOG_VERSION });
    }
    if (!s.legacyChecked && s.program === null && s.sessions.length === 0) {
      await s.importLegacy();
    }
  } catch {
    // Unreadable storage: start fresh rather than hanging on the splash screen.
  } finally {
    useStore.setState({ legacyChecked: true, hydrated: true });
  }
}

export const useUnit = (): Unit => useStore((s) => s.unit);
export const useInventory = (): PlateInventory => useStore((s) => s.inventory);
export const useLift = (id: string): LiftState | undefined => useStore((s) => s.lifts[id]);
