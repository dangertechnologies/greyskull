import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { builtInExercises, CATALOG_VERSION, refreshCatalog } from './catalog';
import { getPlan } from './config/plans';
import type {
  ActiveProgram,
  AppState,
  CustomPlan,
  Equipment,
  Exercise,
  ExerciseResult,
  LiftState,
  Outcome,
  PlateInventory,
  Program,
  Rules,
  SessionLog,
  SetResult,
  Unit,
} from './domain';
import {
  DEFAULT_INVENTORY,
  easeBack,
  exerciseOfLift,
  fiveThreeOneSets,
  gapDays,
  getLadder,
  lastTrained,
  liftKeysOf,
  migrateV1,
  nextLift,
  roundForExercise,
  sessionFor,
  sessionWeightKg,
  setTargets,
  startingWeightKg,
  toKg,
  touchedSince,
  tryParseScheme,
  validateProgram,
} from './domain';
import { isEdited, userFieldsOf, withUserFields } from './domain/exerciseFields';
import { createFileStorage } from './storage';

/** AsyncStorage entry the state lived in before it moved to a file (read once, then kept untouched). */
export const STORAGE_KEY = 'gslp-v2';
export const LEGACY_KEY = 'GSLP_STATE_18';

export const MAX_REST_SECONDS = 300;

/** Bump when the persisted shape changes and teach `migratePersisted` the step. */
export const STORE_VERSION = 4;

export const storage = createFileStorage({ version: STORE_VERSION });
/** zustand reports a failed hydration to `onRehydrateStorage` instead of rejecting. */
let hydrationError: unknown = null;
/** Counts `initStore` calls, so only the latest one reports how loading went. */
let loads = 0;

export function initialState(): AppState {
  return {
    version: 3,
    unit: 'kg',
    inventory: JSON.parse(JSON.stringify(DEFAULT_INVENTORY)) as PlateInventory,
    minimalist: false,
    restSeconds: 90,
    exercises: builtInExercises(),
    programs: [],
    customPlans: [],
    equipment: [],
    bands: [],
    breakDeload: true,
    healthSync: false,
    sessions: [],
    nextSession: 0,
    draft: null,
    needsWeightConfirm: false,
    needsWeightConfirmSuspects: [],
    legacyChecked: false,
    appearance: 'system',
    hapticsEnabled: true,
    dynamicColor: false,
    catalogVersion: CATALOG_VERSION,
  };
}

interface Actions {
  setUnit(unit: Unit): void;
  setInventory(patch: Partial<PlateInventory>): void;
  setSettings(patch: {
    minimalist?: boolean;
    restSeconds?: number;
    appearance?: AppState['appearance'];
    hapticsEnabled?: boolean;
    dynamicColor?: boolean;
  }): void;
  /** Start running a program; returns its id. */
  addProgram(input: Program & { name: string }): string;
  /** Replace a program's days and rules. The same plan keeps its position and lifts; ends its workout. */
  updateProgram(id: string, program: Program): void;
  removeProgram(id: string): void;
  pauseProgram(id: string, paused: boolean): void;
  renameProgram(id: string, name: string): void;
  /** Change progression rules in place (keeps the workout in progress, unlike `updateProgram`). */
  updateRules(id: string, rules: Rules): void;
  setSessionsPerWeek(id: string, days: number): void;
  setLift(programId: string, key: string, patch: Partial<LiftState>): void;
  setLiftStep(programId: string, key: string, step: number): void;
  /** The program's workout: the open one when it belongs to this program, else a new one. */
  startSession(programId: string): SessionLog;
  /** Take back the ease after a break: rebuild the workout from the stored lifts (only before any set is logged). */
  undoEase(): void;
  /** Drop the workout in progress without logging it (its session id stays used). */
  discardDraft(): void;
  logSet(exerciseId: string, setIndex: number, reps: number): void;
  setDraftWeight(exerciseId: string, kg: number): void;
  finishSession(): Record<string, Outcome>;
  skipSession(programId: string): void;
  /** Take back the program's last skip (only while it is still the latest entry of the history). */
  undoSkip(programId: string): void;
  editSession(n: number, results: Record<string, ExerciseResult>): void;
  saveCustomPlan(plan: CustomPlan): void;
  deleteCustomPlan(id: string): void;
  setEquipment(list: Equipment[]): void;
  setBands(list: { id: string; label: string }[]): void;
  setBreakDeload(on: boolean): void;
  setHealthSync(on: boolean): void;
  setHealthId(n: number, id: string): void;
  upsertExercise(exercise: Exercise): void;
  deleteExercise(id: string): string[];
  /** Weights checked after importing the first version's data (first program unless `programId`). */
  confirmWeights(weights: Record<string, number>, programId?: string): void;
  exportJson(): string;
  /** Replace everything with a validated backup (see `parseBackup`). */
  importBackup(state: AppState): Promise<void>;
  reset(): void;
  /** Import v1 data from `raw`, or from the legacy key when omitted (read-only; the key is never written). */
  importLegacy(raw?: string): Promise<boolean>;
}

export type Store = AppState & {
  hydrated: boolean;
  /** Set when stored data could not be read; nothing is written until the user recovers. */
  storageError: string | null;
} & Actions;

const STATE_KEYS = Object.keys(initialState()) as (keyof AppState)[];

/** The persisted slice: all AppState fields, no actions, no `hydrated`. */
export function snapshot(s: AppState): AppState {
  const out: Partial<Record<keyof AppState, unknown>> = {};
  for (const k of STATE_KEYS) out[k] = s[k];
  return out as unknown as AppState;
}

const SHIPPED = builtInExercises();
const editedCache = new WeakMap<Exercise, boolean>();

/**
 * What is stored of the exercises: custom ones whole, built-ins only when the user changed one of their user
 * fields, and then only those fields (a field turned off is stored as `null`). The shipped catalog fills in
 * the rest on launch.
 */
export function persistedExercises(exercises: Record<string, Exercise>): Record<string, Exercise> {
  const out: Record<string, Exercise> = {};
  for (const [id, e] of Object.entries(exercises)) {
    const shipped = SHIPPED[id];
    if (!shipped) {
      out[id] = e;
      continue;
    }
    let edited = editedCache.get(e);
    if (edited === undefined) {
      edited = isEdited(e, shipped);
      editedCache.set(e, edited);
    }
    if (edited) out[id] = userFieldsOf(e, shipped);
  }
  return out;
}

/** The full exercise map from stored entries: shipped built-ins with the user's fields on top, plus custom ones. */
export function restoreExercises(stored: Record<string, Exercise> | undefined): Record<string, Exercise> {
  for (const [id, e] of Object.entries(stored ?? {})) {
    if (!isRecord(e)) throw new Error(`The saved exercise ${id} is damaged`);
  }
  const out: Record<string, Exercise> = { ...stored };
  for (const [id, shipped] of Object.entries(builtInExercises())) {
    const entry = stored?.[id];
    out[id] = entry ? withUserFields(shipped, entry as unknown as Record<string, unknown>) : shipped;
  }
  return out;
}

/** Persisted snapshot: the state with exercises cut down to what the catalog cannot rebuild. */
export const persisted = (s: AppState): AppState => ({
  ...snapshot(s),
  exercises: persistedExercises(s.exercises),
});

const barKg = (inv: PlateInventory, unit: Unit): number => toKg(unit === 'kg' ? inv.barKg : inv.barLb, unit);

export { startingWeightKg };

/** Lift keys of ladder slots (the ladder ids): they track a step, not a weight, and start at 0 kg. */
const ladderKeys = (p: Program): Set<string> =>
  new Set(p.days.flatMap((d) => d.slots.flatMap((s) => (s.ladder ? [s.ladder] : []))));

/** Lifts a program needs that `existing` lacks, at their starting weights. */
function startingLifts(
  program: Program,
  exercises: Record<string, Exercise>,
  inv: PlateInventory,
  unit: Unit,
  existing: Record<string, LiftState> = {},
): Record<string, LiftState> {
  const out = { ...existing };
  const touchedAt = new Date().toISOString();
  const ladders = ladderKeys(program);
  for (const key of liftKeysOf(program)) {
    if (out[key]) continue;
    const exercise = exercises[exerciseOfLift(key)];
    const kg = ladders.has(key) || !exercise ? 0 : startingWeightKg(exercise, inv, unit);
    out[key] = { weightKg: kg, startKg: kg, fails: 0, touchedAt };
  }
  return out;
}

/**
 * The draft once the user changed lift `key` of `programId` (now in `programs`): that lift is no longer eased, so
 * the change wins at finish. Before any set is logged the workout is rebuilt to use it, as `undoEase` does.
 */
function withoutEase(
  s: AppState,
  programs: ActiveProgram[],
  programId: string,
  key: string,
): SessionLog | null {
  const d = s.draft;
  if (d?.programId !== programId || !d.eased?.lifts[key]) return d;
  const { [key]: _dropped, ...lifts } = d.eased.lifts;
  const { eased, ...rest } = d;
  const kept: SessionLog = Object.keys(lifts).length > 0 ? { ...rest, eased: { ...eased, lifts } } : rest;
  const program = programs.find((p) => p.id === programId);
  if (!program || Object.values(d.results).some((r) => r.sets.some((x) => x.reps !== 0))) return kept;
  const at = { ...program, position: d.position ?? program.position };
  const rebuilt = draftFor(s, at, { ...program.lifts, ...lifts }, d.n, Date.parse(d.startedAt));
  return kept.eased ? { ...rebuilt, eased: kept.eased } : rebuilt;
}

/** Bodyweight and ladder lifts are unweighted: 0 kg is a valid weight for them. */
function unweighted(program: ActiveProgram | undefined, key: string, exercises: Record<string, Exercise>) {
  return exercises[exerciseOfLift(key)]?.kind === 'bodyweight' || (!!program && ladderKeys(program).has(key));
}

const planName = (template: string): string => getPlan(template)?.name ?? 'Custom program';

function newProgramId(template: string, programs: ActiveProgram[]): string {
  const base = `${template}-${Date.now().toString(36)}`;
  let id = base;
  for (let i = 2; programs.some((p) => p.id === id); i++) id = `${base}-${i}`;
  return id;
}

/** State as stored before several programs could run at once (one program, one set of lifts). */
export type OneProgramState = Omit<AppState, 'version' | 'programs'> & {
  version: 2;
  program: Program | null;
  lifts: Record<string, LiftState>;
};

/**
 * One-program state → several programs. The program becomes the first (and only) active program with the old
 * lifts; its position is the number of sessions since it started. Old logs keep no program id (the user could
 * switch plans, so they may belong to an earlier one). An open draft is tied to the program with its exercises
 * resolved now, and its session id stays reserved. Everything missing gets its default.
 */
export function upgradeOneProgramState(old: Partial<OneProgramState>): AppState {
  const base = initialState();
  const { program, lifts, version: _version, ...rest } = old;
  const nextSession = rest.nextSession ?? 0;
  const programs: ActiveProgram[] = [];
  let draft = rest.draft ?? null;
  let next = nextSession;
  if (program) {
    const startN = program.startN ?? 0;
    // `startN` is kept so history from before this version can be matched to the program.
    const active: ActiveProgram = {
      ...program,
      startN,
      id: newProgramId(program.template, []),
      name: planName(program.template),
      position: Math.max(0, nextSession - startN),
      lifts: { ...lifts },
    };
    programs.push(active);
    if (draft) {
      const position = Math.max(0, draft.n - startN);
      draft = {
        ...draft,
        programId: active.id,
        programName: active.name,
        position,
        slots: sessionFor({ ...active, position }).slots,
      };
      next = Math.max(next, draft.n + 1);
    }
  } else {
    // A workout without a program can never be finished.
    draft = null;
  }
  return {
    ...base,
    ...rest,
    version: 3,
    inventory: { ...base.inventory, ...rest.inventory },
    // This version stored every built-in exercise whole, content included: refresh the content from the bundle,
    // and the abbreviation too (it was replaced on every refresh then), so only the user's own changes to the
    // other user fields carry over.
    exercises: rest.exercises ? refreshCatalog(rest.exercises, ['abbr']) : base.exercises,
    programs,
    customPlans: rest.customPlans ?? [],
    nextSession: next,
    draft,
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
/** An object that is not an array. */
const isRecord = (v: unknown): v is Record<string, unknown> => isObject(v) && !Array.isArray(v);

function programProblem(p: unknown, label: string): string | null {
  if (!isRecord(p)) return `${label} is not a program`;
  if (!isRecord(p.rules)) return `${label} has no rules`;
  if (
    !Array.isArray(p.days) ||
    p.days.some((d) => !isRecord(d) || !Array.isArray(d.slots) || d.slots.some((slot) => !isRecord(slot)))
  )
    return `${label} has damaged days`;
  return null;
}

/**
 * What is structurally wrong with stored or backed-up state (one-program or several-program shape), or null.
 * Loading refuses such data instead of replacing the broken parts with defaults.
 */
export function stateProblem(s: Record<string, unknown>): string | null {
  if (s.sessions !== undefined && (!Array.isArray(s.sessions) || s.sessions.some((l) => !isRecord(l))))
    return 'the history is damaged';
  if (
    s.exercises !== undefined &&
    (!isRecord(s.exercises) || Object.values(s.exercises).some((e) => !isRecord(e)))
  )
    return 'an exercise is damaged';
  if (s.program !== undefined && s.program !== null) {
    const problem = programProblem(s.program, 'the program');
    if (problem) return problem;
  }
  if (s.lifts !== undefined && !isRecord(s.lifts)) return 'the lifts are damaged';
  if (s.programs !== undefined) {
    if (!Array.isArray(s.programs)) return 'the programs are damaged';
    for (const [i, p] of s.programs.entries()) {
      const problem = programProblem(p, `program ${i + 1}`);
      if (problem) return problem;
      const { id, position, lifts } = p as Record<string, unknown>;
      if (
        typeof id !== 'string' ||
        !Number.isInteger(position) ||
        (position as number) < 0 ||
        !isRecord(lifts)
      )
        return `program ${i + 1} is damaged`;
    }
  }
  if (s.customPlans !== undefined) {
    if (!Array.isArray(s.customPlans)) return 'the saved plans are damaged';
    for (const [i, plan] of s.customPlans.entries()) {
      if (!isRecord(plan) || typeof plan.id !== 'string') return `saved plan ${i + 1} is damaged`;
      const problem = programProblem(plan.program, `saved plan ${i + 1}`);
      if (problem) return problem;
    }
  }
  return null;
}

const assertState = (s: Record<string, unknown>): void => {
  const problem = stateProblem(s);
  if (problem) throw new Error(`The saved data is damaged: ${problem}`);
};

/**
 * Bring a persisted snapshot from any earlier store version up to date. Up to version 3 the state held one
 * program (see `upgradeOneProgramState`); version 4 holds several. Fields added later default via
 * `initialState`.
 */
export function migratePersisted(persistedState: unknown, fromVersion: number): AppState {
  if (!isRecord(persistedState)) throw new Error('The saved data is damaged: it is not app data');
  const old = persistedState;
  assertState(old);
  if (fromVersion < 4) return upgradeOneProgramState(old as Partial<OneProgramState>);
  if (!Array.isArray(old.programs)) throw new Error('The saved data is damaged: the programs are missing');
  const base = initialState();
  const state = old as Partial<AppState>;
  return {
    ...base,
    ...state,
    version: 3,
    inventory: { ...base.inventory, ...state.inventory },
    exercises: state.exercises ?? {},
  };
}

const mapProgram = (
  programs: ActiveProgram[],
  id: string,
  change: (p: ActiveProgram) => ActiveProgram,
): ActiveProgram[] => programs.map((p) => (p.id === id ? change(p) : p));

/** Keeps `sessions` in ascending id order (a draft's id is reserved earlier than later skips'). */
const insertLog = (sessions: SessionLog[], log: SessionLog): SessionLog[] => {
  const at = sessions.findIndex((s) => s.n > log.n);
  return at === -1 ? [...sessions, log] : [...sessions.slice(0, at), log, ...sessions.slice(at)];
};

/** A new workout of `program` at its position, built from `lifts` (the stored states, or eased ones). */
function draftFor(
  s: AppState,
  program: ActiveProgram,
  lifts: Record<string, LiftState>,
  n: number,
  startedAt: number,
): SessionLog {
  const { exercises, inventory, unit, bands } = s;
  const session = sessionFor(program, lifts);
  const results: Record<string, ExerciseResult> = {};
  for (const { exercise: id, lift, scheme, progression, week, step } of session.slots) {
    const exercise = exercises[id];
    const state = lifts[lift];
    const working = state?.weightKg ?? (exercise ? startingWeightKg(exercise, inventory, unit) : 0);
    const sets: SetResult[] =
      progression === '531' && exercise
        ? fiveThreeOneSets(working, week ?? 0, exercise, inventory, unit)
        : setTargets(scheme, state?.reps).map((target) => ({ target, reps: 0 }));
    const band = bands.find((b) => b.id === state?.bandId);
    results[id] = {
      weightKg:
        progression === '531'
          ? Math.max(...sets.map((s) => s.kg ?? 0))
          : exercise
            ? sessionWeightKg(working, session.intensity, exercise, inventory, unit)
            : working,
      sets,
      ...(lift !== id ? { lift } : {}),
      ...(progression === '531' ? { tmKg: working } : {}),
      ...(tryParseScheme(scheme)?.timed || exercise?.timed ? { timed: true as const } : {}),
      // A ladder's step and scheme change over time; charts need both to place the result on the ladder.
      ...(step !== undefined ? { step, scheme } : {}),
      ...(band ? { band: { id: band.id, label: band.label } } : {}),
    };
  }
  return {
    n,
    dayName: session.dayName,
    startedAt: new Date(startedAt).toISOString(),
    results,
    order: session.slots.map((s) => s.exercise),
    ...(session.intensity < 1 ? { intensity: session.intensity } : {}),
    programId: program.id,
    programName: program.name,
    position: program.position,
    slots: session.slots,
  };
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState(),
      hydrated: false,
      storageError: null,

      setUnit: (unit) =>
        set((s) => {
          if (unit === s.unit) return {};
          // Weights are stored in kg, but a bar loaded in lb is not a whole number of kg: move every
          // working weight to the nearest weight that is loadable in the new unit.
          // A ladder key names no exercise; its load is added load, which every bodyweight step rounds alike.
          const snap = (id: string, kg: number): number => {
            const ladder = getLadder(id);
            const exercise =
              s.exercises[ladder ? ladder.steps[ladder.steps.length - 1].exercise : exerciseOfLift(id)];
            return exercise && kg > 0 ? roundForExercise(kg, exercise, 'nearest', s.inventory, unit) : kg;
          };
          const snapLifts = (lifts: Record<string, LiftState>) =>
            Object.fromEntries(
              Object.entries(lifts).map(([id, l]) => [
                id,
                { ...l, weightKg: snap(id, l.weightKg), startKg: snap(id, l.startKg) },
              ]),
            );
          const programs = s.programs.map((p) => ({ ...p, lifts: snapLifts(p.lifts) }));
          const draft = s.draft && {
            ...s.draft,
            ...(s.draft.eased ? { eased: { ...s.draft.eased, lifts: snapLifts(s.draft.eased.lifts) } } : {}),
            results: Object.fromEntries(
              Object.entries(s.draft.results).map(([id, r]) => [
                id,
                {
                  ...r,
                  weightKg: snap(id, r.weightKg),
                  sets: r.sets.map((set) => (set.kg === undefined ? set : { ...set, kg: snap(id, set.kg) })),
                },
              ]),
            ),
          };
          return { unit, programs, draft };
        }),
      setInventory: (patch) => set((s) => ({ inventory: { ...s.inventory, ...patch } })),
      setSettings: ({ minimalist, restSeconds, appearance, hapticsEnabled, dynamicColor }) =>
        set((s) => ({
          minimalist: minimalist ?? s.minimalist,
          appearance: appearance ?? s.appearance,
          hapticsEnabled: hapticsEnabled ?? s.hapticsEnabled,
          dynamicColor: dynamicColor ?? s.dynamicColor,
          restSeconds:
            restSeconds === undefined
              ? s.restSeconds
              : Math.min(MAX_REST_SECONDS, Math.max(0, Math.round(restSeconds))),
        })),

      addProgram: ({ name, startN: _startN, ...input }) => {
        const { exercises, inventory, unit, programs } = get();
        const errors = validateProgram(input, exercises);
        if (errors.length > 0) throw new Error(errors.join('\n'));
        const id = newProgramId(input.template, programs);
        const program: ActiveProgram = {
          ...input,
          id,
          name: name.trim() || planName(input.template),
          position: 0,
          lifts: startingLifts(input, exercises, inventory, unit),
        };
        set({ programs: [...programs, program] });
        return id;
      },

      updateProgram: (id, { template, days, sessionsPerWeek, rules }) => {
        const input: Program = { template, days, sessionsPerWeek, rules };
        const { exercises, inventory, unit, programs, draft } = get();
        const current = programs.find((p) => p.id === id);
        if (!current) throw new Error('No program');
        const errors = validateProgram(input, exercises);
        if (errors.length > 0) throw new Error(errors.join('\n'));
        const same = current.template === input.template;
        // Another plan starts at its first day; lifts it shares with the old plan keep their weights.
        const program: ActiveProgram = {
          ...current,
          ...input,
          startN: same ? current.startN : undefined,
          name: same ? current.name : planName(input.template),
          position: same ? current.position : 0,
          lifts: startingLifts(input, exercises, inventory, unit, current.lifts),
        };
        set({
          programs: mapProgram(programs, id, () => program),
          draft: draft?.programId === id ? null : draft,
        });
      },

      removeProgram: (id) =>
        set((s) => ({
          programs: s.programs.filter((p) => p.id !== id),
          draft: s.draft?.programId === id ? null : s.draft,
        })),

      pauseProgram: (id, paused) =>
        set((s) => ({ programs: mapProgram(s.programs, id, (p) => ({ ...p, paused })) })),

      renameProgram: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) throw new Error('Name the program');
        set((s) => ({ programs: mapProgram(s.programs, id, (p) => ({ ...p, name: trimmed })) }));
      },

      updateRules: (id, rules) =>
        set((s) => ({ programs: mapProgram(s.programs, id, (p) => ({ ...p, rules })) })),

      setSessionsPerWeek: (id, days) => {
        if (!Number.isInteger(days) || days < 1 || days > 7)
          throw new Error('Training days must be between 1 and 7');
        set((s) => ({ programs: mapProgram(s.programs, id, (p) => ({ ...p, sessionsPerWeek: days })) }));
      },

      setLift: (programId, key, patch) => {
        const { programs, exercises } = get();
        const program = programs.find((p) => p.id === programId);
        if (!program) throw new Error('No program');
        const zeroOk = unweighted(program, key, exercises);
        const kg = patch.weightKg;
        if (kg !== undefined && !(kg > 0) && !(kg === 0 && zeroOk))
          throw new Error('Weight must be positive');
        const touchedAt = new Date().toISOString();
        set((s) => {
          const programs = mapProgram(s.programs, programId, (p) => {
            const existing = p.lifts[key];
            if (existing) return { ...p, lifts: { ...p.lifts, [key]: { ...existing, ...patch, touchedAt } } };
            const exercise = s.exercises[exerciseOfLift(key)];
            const start = exercise
              ? startingWeightKg(exercise, s.inventory, s.unit)
              : barKg(s.inventory, s.unit);
            const weightKg = patch.weightKg ?? (zeroOk ? 0 : start);
            return {
              ...p,
              lifts: { ...p.lifts, [key]: { weightKg, startKg: weightKg, fails: 0, ...patch, touchedAt } },
            };
          });
          return { programs, draft: withoutEase(s, programs, programId, key) };
        });
      },

      setLiftStep: (programId, key, step) => {
        if (!Number.isInteger(step) || step < 0) throw new Error('Invalid step');
        const touchedAt = new Date().toISOString();
        set((s) => {
          const programs = mapProgram(s.programs, programId, (p) => ({
            ...p,
            lifts: {
              ...p.lifts,
              [key]: { ...(p.lifts[key] ?? { weightKg: 0, startKg: 0, fails: 0 }), step, touchedAt },
            },
          }));
          return { programs, draft: withoutEase(s, programs, programId, key) };
        });
      },

      startSession: (programId) => {
        const state = get();
        const { draft, programs, exercises, inventory, unit, bands, sessions, nextSession } = state;
        if (draft) {
          if (draft.programId === programId) return draft;
          throw new Error('Another workout is in progress');
        }
        const program = programs.find((p) => p.id === programId);
        if (!program) throw new Error('No program');
        const now = Date.now();
        // After a break the session starts from eased lift states; the stored ones change only on finish.
        const eased: Record<string, LiftState> = {};
        let gap = 0;
        if (state.breakDeload)
          for (const slot of sessionFor(program).slots) {
            const lift = program.lifts[slot.lift];
            const exercise = exercises[slot.exercise];
            const last = lastTrained(sessions, slot.lift);
            // A state set since the last training (a new program, a retest, an earlier eased session) is current.
            if (!lift || !exercise || !last || eased[slot.lift] || touchedSince(lift, last)) continue;
            const days = gapDays(last, now);
            const next = easeBack(lift, days, { ...slot, exercise, inv: inventory, unit, bands });
            if (!next) continue;
            eased[slot.lift] = next;
            gap = Math.max(gap, days);
          }
        const created = draftFor(state, program, { ...program.lifts, ...eased }, nextSession, now);
        if (Object.keys(eased).length > 0) created.eased = { gapDays: gap, lifts: eased };
        set({ draft: created, nextSession: nextSession + 1 });
        return created;
      },

      undoEase: () =>
        set((s) => {
          const d = s.draft;
          if (!d?.eased || Object.values(d.results).some((r) => r.sets.some((x) => x.reps !== 0))) return {};
          const program = s.programs.find((p) => p.id === d.programId);
          if (!program) return {};
          const at = { ...program, position: d.position ?? program.position };
          return { draft: draftFor(s, at, program.lifts, d.n, Date.parse(d.startedAt)) };
        }),

      discardDraft: () => set({ draft: null }),

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
          if (!s.draft || !result || result.sets.some((set) => set.kg !== undefined)) return {};
          const program = s.programs.find((p) => p.id === s.draft?.programId);
          const zeroOk = unweighted(program, result.lift ?? exerciseId, s.exercises);
          if (!(kg > 0) && !(kg === 0 && zeroOk)) return {};
          return {
            draft: { ...s.draft, results: { ...s.draft.results, [exerciseId]: { ...result, weightKg: kg } } },
          };
        }),

      finishSession: () => {
        const { draft, programs, exercises, inventory, unit, bands } = get();
        if (!draft) throw new Error('No session in progress');
        const program = programs.find((p) => p.id === draft.programId);
        if (!program) throw new Error('No program');
        const { lifts } = program;
        const outcomes: Record<string, Outcome> = {};
        const nextLifts = { ...lifts };
        const finishedAt = new Date().toISOString();
        // Drafts carry their resolved exercises; only a draft from before that was stored lacks them.
        const slots =
          draft.slots ?? sessionFor({ ...program, position: draft.position ?? program.position }).slots;
        for (const slot of slots) {
          const id = slot.exercise;
          const exercise = exercises[id];
          const result = draft.results[id];
          if (!exercise || !result) continue;
          const key = slot.lift;
          // The lift state progression starts from: the eased one after a break, else the stored one.
          const eased = draft.eased?.lifts[key];
          const base = eased ?? lifts[key];
          const lift = base ?? { weightKg: result.weightKg, startKg: result.weightKg, fails: 0 };
          const outcome = nextLift(lift, result, program.rules, exercise, inventory, unit, {
            ...slot,
            intensity: draft.intensity ?? 1,
            bands,
          });
          outcomes[id] = outcome;
          if (!eased) {
            if (outcome.change !== 'none') nextLifts[key] = outcome.next;
            continue;
          }
          // An eased lift is stored only once the user trained it; then it keeps its eased state even when the
          // session does not move it (a 5/3/1 week or a light day), so a lowered training max does not spring
          // back, and `touchedAt` marks the ease as applied.
          if (!result.sets.some((set) => set.reps > 0)) continue;
          nextLifts[key] = { ...(outcome.change === 'none' ? eased : outcome.next), touchedAt: finishedAt };
        }
        const { slots: _slots, ...log } = draft;
        set((s) => ({
          sessions: insertLog(s.sessions, { ...log, finishedAt }),
          programs: mapProgram(s.programs, program.id, (p) => ({
            ...p,
            lifts: nextLifts,
            position: (draft.position ?? p.position) + 1,
          })),
          nextSession: Math.max(s.nextSession, draft.n + 1),
          draft: null,
        }));
        return outcomes;
      },

      skipSession: (programId) =>
        set((s) => {
          const program = s.programs.find((p) => p.id === programId);
          if (!program) return {};
          const now = new Date().toISOString();
          // Skipping the last week-3 session of a lift still ends its 5/3/1 cycle: the template raises the
          // training max whatever happens in that session, so do it here and keep the old state for Undo.
          const lifts = { ...program.lifts };
          const restore: Record<string, LiftState> = {};
          for (const slot of sessionFor(program).slots) {
            const lift = program.lifts[slot.lift];
            const exercise = s.exercises[slot.exercise];
            if (slot.progression !== '531' || !slot.lastInWeek || slot.week !== 2 || !lift || !exercise)
              continue;
            const sets = [5, 3, 1].map((reps, i) => ({ target: i === 2 ? null : reps, reps }));
            lifts[slot.lift] = nextLift(
              lift,
              { weightKg: lift.weightKg, sets },
              program.rules,
              exercise,
              s.inventory,
              s.unit,
              { ...slot, bands: s.bands },
            ).next;
            restore[slot.lift] = lift;
          }
          const skipped: SessionLog = {
            n: s.nextSession,
            dayName: '',
            startedAt: now,
            finishedAt: now,
            results: {},
            order: [],
            skipped: true,
            programId,
            programName: program.name,
            position: program.position,
            ...(Object.keys(restore).length > 0 ? { restore } : {}),
          };
          return {
            sessions: insertLog(s.sessions, skipped),
            programs: mapProgram(s.programs, programId, (p) => ({ ...p, lifts, position: p.position + 1 })),
            nextSession: s.nextSession + 1,
            draft: s.draft?.programId === programId ? null : s.draft,
          };
        }),

      undoSkip: (programId) =>
        set((s) => {
          const last = s.sessions[s.sessions.length - 1];
          // A workout of this program started after the skip sits on the next day: leave both alone.
          if (!last?.skipped || last.programId !== programId || s.draft?.programId === programId) return {};
          return {
            sessions: s.sessions.slice(0, -1),
            programs: mapProgram(s.programs, programId, (p) => ({
              ...p,
              lifts: { ...p.lifts, ...last.restore },
              position: Math.max(0, p.position - 1),
            })),
          };
        }),

      editSession: (n, results) =>
        set((s) => ({ sessions: s.sessions.map((log) => (log.n === n ? { ...log, results } : log)) })),

      saveCustomPlan: (plan) => {
        const name = plan.name.trim();
        if (!plan.id || !name) throw new Error('A plan needs an id and a name');
        const errors = validateProgram(plan.program, get().exercises);
        if (errors.length > 0) throw new Error(errors.join('\n'));
        set((s) => {
          const saved = { ...plan, name };
          const exists = s.customPlans.some((p) => p.id === plan.id);
          return {
            customPlans: exists
              ? s.customPlans.map((p) => (p.id === plan.id ? saved : p))
              : [...s.customPlans, saved],
          };
        });
      },

      deleteCustomPlan: (id) => set((s) => ({ customPlans: s.customPlans.filter((p) => p.id !== id) })),

      setEquipment: (list) => set({ equipment: [...new Set(list)] }),
      setBands: (list) => set({ bands: list }),
      setBreakDeload: (on) => set({ breakDeload: on }),
      setHealthSync: (on) => set({ healthSync: on }),
      setHealthId: (n, id) =>
        set((s) => ({ sessions: s.sessions.map((log) => (log.n === n ? { ...log, healthId: id } : log)) })),

      upsertExercise: (exercise) => set((s) => ({ exercises: { ...s.exercises, [exercise.id]: exercise } })),

      deleteExercise: (id) => {
        const { exercises, programs, customPlans } = get();
        const exercise = exercises[id];
        if (!exercise) return [];
        if (!exercise.custom) throw new Error('Built-in exercises cannot be deleted');
        const uses = (p: Program) =>
          p.days.filter((d) =>
            d.slots.some((slot) =>
              (typeof slot.exercise === 'string' ? [slot.exercise] : slot.exercise).includes(id),
            ),
          );
        const using = [
          ...programs.flatMap((p) =>
            uses(p).map((d) => (programs.length > 1 ? `${p.name}: ${d.name}` : d.name)),
          ),
          ...customPlans.flatMap((plan) => uses(plan.program).map((d) => `${plan.name}: ${d.name}`)),
        ];
        if (using.length > 0) return using;
        set((s) => {
          // Also drops tier keys such as `<id>@T2`.
          const programs = s.programs.map((p) => ({
            ...p,
            lifts: Object.fromEntries(Object.entries(p.lifts).filter(([key]) => exerciseOfLift(key) !== id)),
          }));
          // History keeps the exercise's name: archive instead of deleting once a session used it.
          if (s.sessions.some((log) => id in log.results)) {
            return { exercises: { ...s.exercises, [id]: { ...exercise, archived: true } }, programs };
          }
          const { [id]: _removed, ...rest } = s.exercises;
          return { exercises: rest, programs };
        });
        return [];
      },

      confirmWeights: (weights, programId) =>
        set((s) => {
          const target = programId ?? s.programs[0]?.id;
          return {
            programs: target
              ? mapProgram(s.programs, target, (p) => {
                  const lifts = { ...p.lifts };
                  const touchedAt = new Date().toISOString();
                  for (const [id, kg] of Object.entries(weights)) {
                    if (!(kg > 0)) continue;
                    lifts[id] = {
                      ...(lifts[id] ?? { weightKg: kg, startKg: kg, fails: 0 }),
                      weightKg: kg,
                      touchedAt,
                    };
                  }
                  return { ...p, lifts };
                })
              : s.programs,
            needsWeightConfirm: false,
            needsWeightConfirmSuspects: [],
          };
        }),

      exportJson: () => JSON.stringify(persisted(get()), null, 2),

      importBackup: async (state) => {
        // Restoring a backup is how the user recovers from unreadable data: it replaces the file only once the
        // unreadable file has been kept aside.
        if (get().storageError) {
          try {
            await storage.allowWrites();
          } catch (e) {
            const why = e instanceof Error ? e.message : String(e);
            set({
              storageError: `The unreadable data could not be kept aside, so nothing was replaced: ${why}`,
            });
            return;
          }
        }
        set({ ...snapshot(state), legacyChecked: true, storageError: null });
      },

      reset: () => set({ ...initialState(), legacyChecked: true }),

      importLegacy: async (raw) => {
        const data = raw ?? (await AsyncStorage.getItem(LEGACY_KEY));
        const migrated = data === null ? null : migrateV1(data, get().exercises);
        if (!migrated) return false;
        const current = snapshot(get());
        set({
          ...upgradeOneProgramState({ ...current, version: 2, ...migrated.patch, draft: null }),
          // The exercises in memory are already this version's (the conversion would refresh them as stored ones).
          exercises: current.exercises,
        });
        return true;
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORE_VERSION,
      migrate: migratePersisted,
      storage: createJSONStorage(() => storage),
      skipHydration: true,
      // ponytail: the whole state is serialised on every change (the file write itself is debounced); move
      // serialisation behind the debounce if very long histories make logging a set feel slow.
      partialize: (s) => persisted(s),
      onRehydrateStorage: () => (_state, error) => {
        hydrationError = error ?? null;
      },
      merge: (stored, current) => {
        // Damaged data fails the load (storageError, nothing written) instead of being filled with defaults.
        if (stored !== undefined) assertState(isRecord(stored) ? stored : { programs: null });
        const state = (stored ?? {}) as Partial<AppState>;
        // Nothing stored (a first launch): keep the exercises already in memory.
        return {
          ...current,
          ...state,
          exercises: state.exercises ? restoreExercises(state.exercises) : current.exercises,
        };
      },
    },
  ),
);

/**
 * Load persisted state, import v1 data once if this is a first launch, then mark the store hydrated. When the
 * stored data cannot be read, `storageError` is set and nothing is written (the recovery screen takes over).
 */
export async function initStore(): Promise<void> {
  const load = ++loads;
  hydrationError = null;
  // A retry keeps the recovery screen up until the data has loaded, so the app never shows an empty state.
  await useStore.persist.rehydrate();
  // A later call started over (zustand drops the earlier hydration): that call reports the outcome.
  if (load !== loads) return;
  if (!useStore.persist.hasHydrated()) {
    const error = hydrationError ?? new Error('The saved data could not be loaded');
    useStore.setState({
      storageError: error instanceof Error ? error.message : String(error),
      hydrated: true,
    });
    return;
  }
  // Loaded, migrated and merged: only now may anything be written. Save once so migrated data reaches the file.
  storage.enableWrites();
  useStore.setState({});
  const s = useStore.getState();
  if ((s.catalogVersion ?? 0) < CATALOG_VERSION) useStore.setState({ catalogVersion: CATALOG_VERSION });
  let legacyChecked = true;
  if (!s.legacyChecked && s.programs.length === 0 && s.sessions.length === 0) {
    try {
      await s.importLegacy();
    } catch {
      // The first version's entry could not be read (it is only ever read): try again on the next launch.
      legacyChecked = false;
    }
  }
  useStore.setState({ legacyChecked, hydrated: true, storageError: null });
}

/** The program with `id`; without an id, the first program that is not paused. */
export const useProgram = (id?: string): ActiveProgram | undefined =>
  useStore((s) => (id ? s.programs.find((p) => p.id === id) : s.programs.find((p) => !p.paused)));

export const useUnit = (): Unit => useStore((s) => s.unit);
export const useInventory = (): PlateInventory => useStore((s) => s.inventory);
export const useLift = (programId: string | undefined, key: string): LiftState | undefined =>
  useStore((s) => s.programs.find((p) => p.id === programId)?.lifts[key]);
