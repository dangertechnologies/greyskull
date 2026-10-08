export type Unit = 'kg' | 'lb';
export type Kind = 'barbell' | 'bodyweight' | 'dumbbell' | 'machine';

export interface Exercise {
  id: string; // 'BENCH_PRESS' or 'custom_front_squat'
  name: string; // 'Bench press'
  shortName: string; // 'Bench'
  icon: string; // key into src/icons.ts
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
}

export type Scheme = '2x5+' | '1x5+' | '3x5+' | '2xAMRAP' | '3x8' | '2x10';

export interface Slot {
  exercise: string | [string, string]; // tuple = alternate between the two each session
  scheme: Scheme;
}
export interface Day {
  name: string;
  slots: Slot[];
}

export interface Rules {
  doubleAt: number; // AMRAP reps at/above which the increment doubles (default 10)
  deloadPct: number; // default 0.10
  failsBeforeDeload: number; // default 1 (fail once → stay; fail again → deload)
  warmups: boolean; // default true
}

export interface Program {
  template: 'base' | 'phrak' | 'custom';
  days: Day[];
  sessionsPerWeek: 2 | 3;
  rules: Rules;
}

export interface LiftState {
  weightKg: number; // current working weight
  startKg: number; // weight at program start (for charts)
  fails: number; // consecutive failed AMRAPs
  incrementOverride?: { kg: number; lb: number };
}

export interface SetResult {
  target: number | null; // null = AMRAP
  reps: number;
}
export interface ExerciseResult {
  weightKg: number;
  sets: SetResult[];
}

export interface SessionLog {
  n: number;
  dayName: string;
  startedAt: string; // ISO
  finishedAt?: string; // ISO; undefined while draft
  results: Record<string, ExerciseResult>; // key = exercise id
  order: string[]; // exercise ids in order (so UI never re-derives)
  skipped?: boolean;
}

export interface PlateInventory {
  barKg: number;
  platesKg: number[];
  barLb: number;
  platesLb: number[];
}

export interface AppState {
  version: 2;
  unit: Unit;
  inventory: PlateInventory;
  minimalist: boolean;
  restSeconds: number;
  exercises: Record<string, Exercise>;
  program: Program | null;
  lifts: Record<string, LiftState>;
  sessions: SessionLog[]; // finished or skipped, ascending n
  nextSession: number;
  draft: SessionLog | null;
  needsWeightConfirm: boolean; // true after migrating v1 data
  needsWeightConfirmSuspects: string[]; // lift ids whose migrated weight looked wrong
}

export const DEFAULT_INVENTORY: PlateInventory = {
  barKg: 20,
  platesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
  barLb: 45,
  platesLb: [45, 35, 25, 10, 5, 2.5],
};
export const OPTIONAL_PLATES = { kg: [0.5, 0.25], lb: [1.25, 0.5] };
export const BAR_OPTIONS = { kg: [20, 15, 10], lb: [45, 35, 25] };
export const DEFAULT_RULES: Rules = {
  doubleAt: 10,
  deloadPct: 0.1,
  failsBeforeDeload: 1,
  warmups: true,
};
