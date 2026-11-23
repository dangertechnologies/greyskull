export type Unit = 'kg' | 'lb';
export type Kind = 'barbell' | 'bodyweight' | 'dumbbell' | 'machine' | 'kettlebell';

export type Equipment =
  | 'barbell'
  | 'ez-bar'
  | 'trap-bar'
  | 'dumbbell'
  | 'kettlebell'
  | 'cable'
  | 'machine'
  | 'bench'
  | 'pull-up-bar'
  | 'dip-bars'
  | 'rings'
  | 'parallettes'
  | 'bands'
  | 'box'
  | 'medicine-ball'
  | 'exercise-ball'
  | 'foam-roll'
  | 'none';

export type Muscle =
  | 'abdominals'
  | 'abductors'
  | 'adductors'
  | 'biceps'
  | 'calves'
  | 'chest'
  | 'forearms'
  | 'glutes'
  | 'hamstrings'
  | 'lats'
  | 'lower-back'
  | 'middle-back'
  | 'neck'
  | 'quadriceps'
  | 'shoulders'
  | 'traps'
  | 'triceps';

export type Pattern = 'push' | 'pull' | 'squat' | 'hinge' | 'core' | 'carry' | 'skill' | 'mobility';

export interface Exercise {
  id: string; // 'BENCH_PRESS' or 'custom_front_squat'
  name: string; // 'Bench press'
  shortName: string; // 'Bench'
  icon?: string; // legacy: key of the old bitmap icon set (unused; the UI shows a monogram)
  abbr?: string; // up to 3 letters shown in the exercise monogram
  kind: Kind;
  increment: { kg: number; lb: number }; // added after a successful session
  step?: { kg: number; lb: number }; // dumbbell/machine only: rounding step
  description?: string;
  goodForm?: string[];
  badForm?: string[];
  video?: string;
  url?: string;
  background?: string; // key into src/backgrounds.ts
  custom?: boolean;
  /** Deleted by the user but kept because past sessions still reference it (hidden from pickers). */
  archived?: boolean;
  equipment?: Equipment[];
  muscles?: Muscle[];
  secondary?: Muscle[];
  pattern?: Pattern;
  level?: 'beginner' | 'intermediate' | 'expert';
  /** Held for time: set `reps` are seconds. */
  timed?: boolean;
  /** Bar weight when it is not the gym's standard bar (EZ bar). */
  barKg?: { kg: number; lb: number };
  /** Key into the pictogram set (src/ui/pictograms.ts). */
  pictogram?: string;
}

/**
 * Sets × reps. `5x5` fixed reps, `2x5+` last set AMRAP (at least 5), `2xAMRAP` every set AMRAP,
 * `2x8-12` a rep range for double progression (reps first, then weight), `3x30s` timed holds of 30 seconds,
 * `3x20-40s` a range of hold times.
 */
export type Scheme =
  | `${number}x${number}`
  | `${number}x${number}+`
  | `${number}xAMRAP`
  | `${number}x${number}-${number}`
  | `${number}x${number}s`
  | `${number}x${number}-${number}s`;

/**
 * How a lift moves after a session:
 * - `amrap`: GSLP. Last-set AMRAP ≥ 5 adds the increment, ≥ `doubleAt` adds it twice.
 * - `linear`: every set hits its target → add the increment (StrongLifts, Starting Strength).
 * - `double`: every set hits the current rep target → one more rep next time; at the top of the range
 *   add the increment and drop back to the bottom (AllPro).
 */
export type ProgressionModel = 'amrap' | 'linear' | 'double' | 'stages' | '531' | 'ladder';

export interface Slot {
  exercise: string | [string, string]; // tuple = alternate between the two each session
  scheme: Scheme;
  lift?: string;
  progression?: ProgressionModel;
  stages?: Scheme[];
  advanceAt?: number;
  /** Id of a ladder (src/catalog/ladders.json): the slot moves through the ladder's steps. */
  ladder?: string;
  /** Id of a group in the same day (superset, circuit, EMOM, interval). */
  group?: string;
}

/** A progression of exercises from easiest to hardest (calisthenics skill ladders). */
export interface Ladder {
  id: string;
  name: string;
  pattern: Pattern;
  /** `weighted`: after the last step the lift continues with added weight. */
  after?: 'weighted';
  steps: { exercise: string; scheme?: Scheme; band?: boolean }[];
}

export type GroupKind = 'superset' | 'circuit' | 'emom' | 'interval';
export interface Group {
  id: string;
  kind: GroupKind;
  rounds?: number;
  restS?: number;
  workS?: number;
  minutes?: number;
}

export interface Day {
  name: string;
  slots: Slot[];
  /** Fraction of the working weight used on this day (light/medium days). Below 1 the day never progresses. */
  intensity?: number;
  groups?: Group[];
}

export interface Rules {
  doubleAt: number; // AMRAP reps at/above which the increment doubles (default 10)
  deloadPct: number; // default 0.10
  failsBeforeDeload: number; // default 1 (fail once → stay; fail again → deload)
  warmups: boolean; // default true
  progression?: ProgressionModel; // default 'amrap' (programs saved before plans existed have none)
  /** Per-exercise increments that override the catalog's (e.g. StrongLifts adds 5 kg to the deadlift). */
  increments?: Record<string, { kg: number; lb: number }>;
}

export interface Program {
  template: string; // plan id from src/config/plans.ts, or 'custom'
  days: Day[];
  sessionsPerWeek: number;
  rules: Rules;
  /**
   * Session number the program started at, from before several programs could run at once. Only kept on
   * programs moved from that data (it tells which old history entries belong to them); rotation uses
   * `ActiveProgram.position`.
   */
  startN?: number;
}

/** A program the user runs: its own rotation (`position`) and its own lift states. */
export interface ActiveProgram extends Program {
  id: string;
  name: string;
  /** Sessions finished or skipped in this program; picks the day, alternating pairs and 5/3/1 week. */
  position: number;
  lifts: Record<string, LiftState>;
  paused?: boolean;
}

/** A program the user built and saved, ready to start. */
export interface CustomPlan {
  id: string;
  name: string;
  summary?: string;
  program: Program;
}

export interface LiftState {
  weightKg: number; // current working weight
  startKg: number; // weight at program start (for charts)
  fails: number; // consecutive failed AMRAPs
  incrementOverride?: { kg: number; lb: number };
  stage?: number;
  reps?: number; // double progression: current rep target inside the scheme's range
  step?: number; // ladder: index of the current step
  bandId?: string; // ladder: assistance band in use
}

export interface SetResult {
  kg?: number;
  target: number | null; // null = AMRAP
  reps: number;
}
export interface ExerciseResult {
  weightKg: number;
  sets: SetResult[];
  /** Lift key when it differs from the exercise id (GZCLP T2), so charts keep tiers apart. */
  lift?: string;
  /** 5/3/1: the training max the sets were built from (`weightKg` is the heaviest set). */
  tmKg?: number;
  /** Held for time: set `reps` are seconds. */
  timed?: true;
  /** Ladder step the sets were done at. */
  step?: number;
  scheme?: Scheme;
  band?: { id: string; label: string };
}

/** One exercise of a session as the program resolves it (day, stage, alternating pair and 5/3/1 week applied). */
export interface ResolvedSlot {
  exercise: string;
  lift: string;
  scheme: Scheme;
  progression: ProgressionModel;
  stages?: Scheme[];
  advanceAt?: number;
  week?: number;
  lastInWeek?: boolean;
  ladder?: string;
  step?: number;
  group?: string;
}

export interface SessionLog {
  n: number;
  dayName: string;
  startedAt: string; // ISO
  finishedAt?: string; // ISO; undefined while draft
  results: Record<string, ExerciseResult>; // key = exercise id
  order: string[]; // exercise ids in order (so UI never re-derives)
  skipped?: boolean;
  intensity?: number; // set when the day is a light/medium day
  /** Skipped 5/3/1 cycle ends: lift states from before the training max went up, so Undo can restore them. */
  restore?: Record<string, LiftState>;
  /** Program the session belongs to; undefined for history from before several programs could run at once. */
  programId?: string;
  programName?: string;
  /** The program's position this session was at. */
  position?: number;
  /** Draft only: the resolved exercises, so finishing never re-derives them from a changed program. */
  slots?: ResolvedSlot[];
  /** Set when the session eased back after a long break: the gap and the lift states from before. */
  eased?: { gapDays: number; lifts: Record<string, LiftState> };
  /** Id of the workout written to Apple Health or Health Connect. */
  healthId?: string;
}

export interface PlateInventory {
  barKg: number;
  platesKg: number[];
  barLb: number;
  platesLb: number[];
  kettlebellsKg: number[];
  kettlebellsLb: number[];
}

export interface AppState {
  version: 3;
  unit: Unit;
  inventory: PlateInventory;
  minimalist: boolean;
  restSeconds: number;
  exercises: Record<string, Exercise>;
  programs: ActiveProgram[];
  customPlans: CustomPlan[];
  /** Equipment the user has; empty means unknown (show everything). */
  equipment: Equipment[];
  /** Assistance bands, heaviest first. */
  bands: { id: string; label: string }[];
  /** Ease back after a long break. */
  breakDeload: boolean;
  healthSync: boolean;
  sessions: SessionLog[]; // finished or skipped, ascending n
  /** Next session id. Reserved when a draft or a skip is created; never goes back, so ids never repeat. */
  nextSession: number;
  draft: SessionLog | null;
  needsWeightConfirm: boolean; // true after migrating v1 data
  needsWeightConfirmSuspects: string[]; // lift ids whose migrated weight looked wrong
  legacyChecked: boolean; // v1 data was looked for once; stops a Reset from re-importing it
  appearance: 'system' | 'light' | 'dark';
  hapticsEnabled: boolean;
  dynamicColor: boolean; // Android 12+: take the accent from the wallpaper (Material You)
  catalogVersion: number; // version of the built-in exercise content in `exercises`
}

export const DEFAULT_INVENTORY: PlateInventory = {
  barKg: 20,
  platesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
  barLb: 45,
  platesLb: [45, 35, 25, 10, 5, 2.5],
  kettlebellsKg: [8, 12, 16, 20, 24, 28, 32],
  kettlebellsLb: [18, 26, 35, 44, 53, 62, 70],
};
export const OPTIONAL_PLATES = { kg: [0.5, 0.25], lb: [1.25, 0.5] };
export const BAR_OPTIONS = { kg: [20, 15, 10], lb: [45, 35, 25] };
export const DEFAULT_RULES: Rules = {
  doubleAt: 10,
  deloadPct: 0.1,
  failsBeforeDeload: 1,
  warmups: true,
};
