# Greyskull LP v2 — implementation plan (executable)

This document is written so that any coding agent (Claude Sonnet, Gemini Flash, …) can pick a
Session and execute it without further context. Read §0 first. Everything you need to decide is
decided here; if something is genuinely missing, follow §0.4.

---

## 0. Working protocol (read every session)

### 0.1 Start-of-session checklist
1. `cd /Users/amnesthesia/Work/greyskull && git status && git branch --show-current`.
   You must be on branch `v2` with a clean tree. If `v2` does not exist yet you are in Session 1.
2. Read this file top to bottom once. Then re-read the Session you were asked to do.
3. Read `PLAN-NOTES.md` if it exists (notes left by earlier sessions).
4. Run `npm test` and `npx tsc --noEmit` (after Session 1) and confirm both pass before changing anything.

### 0.2 Rules
- Never create a git worktree. Never run `pod install`, `npx expo run:ios`, `npx expo prebuild`.
  Use Expo Go (`npx expo start`) for manual checks and EAS for builds. Disk is tight.
- Install runtime dependencies only with `npx expo install <pkg>` (it picks SDK-compatible versions).
  Do not add any dependency that is not listed in §3.2. If you think you need one, don't; write a
  note (§0.4) and implement without it.
- No `lodash`, no `moment`/`date-fns`, no class components, no `any` in `src/domain`.
- Weights are **always** stored in kilograms as plain numbers (`weightKg`). Convert only for display
  and for rounding (see §5). Never store a value in lb.
- All UI text in English. Dark theme only. Function components + hooks. `StyleSheet.create`.
- Every logical change gets a test if it lives in `src/domain` or `src/store.ts`.
- Do not refactor files outside the Session's scope. Do not "improve" earlier sessions' work unless
  a test fails.

### 0.3 End-of-session checklist
1. `npm test` green, `npx tsc --noEmit` clean, `npx expo start` boots without red screen (Sessions ≥ 4).
2. Run the Session's **Verify** list literally and tick each item.
3. `git add -A && git commit -m "<commit message given in the Session>"` on branch `v2`.
4. Append to `PLAN-NOTES.md`: date, session number, anything you deviated from, anything left undone.

### 0.4 When blocked
Do not guess silently. Write the question and your chosen assumption into `PLAN-NOTES.md`, pick the
most conservative assumption that keeps tests passing, and continue. If you cannot continue, commit
what passes (tests green) and stop with a clear message of what is missing.

---

## 1. Context

`greyskull` is a 2019 bare React Native 0.57 app (not Expo). Published as iOS
`com.dangertechnologies.gslp` (1.0.1, build 1) and Android `com.greyskull` (1.0, versionCode 1).
It no longer builds. We are rewriting it as an **Expo SDK 57 managed app** (React Native 0.86,
React 19.2, expo-router) under the same ids, fixing the bugs users reported and adding features.

User reviews reported: weights exploding to millions; wrong Greyskull LP schedule (deadlift twice a
week, no exercise order); no way to edit weights mid-program; janky UI; over-sensitive +/- buttons;
stuck on a green check after a workout; no back button inside a lift; no projected future weights;
no custom rest time; no custom exercises; broken kg display.

What is worth keeping from v1: the exercise catalog text (`App/Configuration/exercises.json`:
descriptions, good/bad form hints, video and info URLs), the background photos and icons
(`App/Images/`), and the immersive look (full-bleed blurred photo, thin white typography, one
exercise per screen).

## 2. Verified v1 bug ledger (why v2 is designed the way it is)

| # | v1 location | Bug | v2 answer |
|---|---|---|---|
| 1 | `App/Components/WeightIncreased.tsx:94,107`, `App/Screens/Workout/Screen.tsx:46-91` | A 25 ms interval re-renders a progress ring; each `fill` change fires `onAnimationComplete`; each one queues `setTimeout(onDone, 5000)`; each `onDone` re-applies the "5RM" formula to a store that lodash `merge` mutated in place. Dozens of ×1.3 applications → 45 lb × 1.305^52 ≈ 47,306,820 lb. History gets the bad value too. | Progression is a pure function applied exactly once in `finishSession()`. No timers or animation callbacks write state. Store is immutable. |
| 2 | `App/Configuration/Units.ts:14-17` | Epley 5RM × 0.87 used as progression instead of GSLP's fixed increments. | §5.3 progression. |
| 3 | `App/Screens/Workout/Screen.tsx:64` | kg value rounded with the lb rule → imperial users progress in 5 kg steps. | All rounding in display unit with a plate inventory (§5.2). |
| 4 | `App/Configuration/ScheduleBuilder.ts:16-21` | ODD/EVEN slots over a flat index → deadlift twice in alternate weeks; exercise order undefined. | `sessionFor()` from ordered template days (§5.4). |
| 5 | `App/Screens/Exercise/DataValueDisplay.tsx:45-54` | +/- auto-repeat starts immediately on press-in at 100 ms. | `Stepper`: tap = one step; long-press (400 ms) repeats at 150 ms. |
| 6 | `App/Screens/Workout/Screen.tsx:107` | Reads store immediately after an async update → never navigates (stuck on ✅). | Explicit Finish button; synchronous store. |
| 7 | `App/Store/ApplicationState.tsx:63,67` | `merge` mutates `INITIAL_STATE`; Reset restores dirty data. | `reset()` builds a fresh object. |
| 8 | `App/Store/ApplicationState.tsx:84` | Unawaited writes can land out of order. | zustand `persist`. |
| 9 | `App/Components/Settings.tsx` | No way to edit weights after setup. | Lift editor + in-session weight edit. |
| 10 | `App/Screens/Navigation.tsx:53` | No headers, no back, stack grows forever. | expo-router Stack with headers; `router.replace` after flows. |
| 11 | `App/Screens/Launch/Screen.tsx:16` | Hard 2 s splash delay. | Hide splash when store hydrated. |
| 12 | `App/Components/WeightIncreased.tsx:101` | Division by zero → NaN when weight unchanged. | No animated ring. |
| 13 | `App/Screens/Progress/Screen.tsx:38`, `Progress.tsx:48` | Bodyweight lifts hidden from progress. | Bodyweight lifts chart reps. |
| 14 | `App/Screens/WorkoutBenchmark/Screen.tsx:26`, `ScheduleBuilder.ts:10` | Schedule built once; later config changes ignored. | Sessions are derived from program data on demand. |
| 15 | `App/Configuration/Units.ts:2` | 2.2 used for lb conversion. | 0.45359237. |
| 16 | `App/Components/RestTimer.tsx:28` | Interval never cleared. | `useEffect` cleanup. |
| 17 | Several `.map` without `key`. | — | Keys everywhere. |
| 18 | `App/Store/ApplicationState.tsx:91` | Whole store as props → full re-render per tick. | zustand selectors. |

## 3. Decisions and glossary

### 3.1 Glossary
- **Lift**: an exercise the user trains with a tracked weight (e.g. `BENCH_PRESS`).
- **Program**: the user's configured template: ordered **days**, each with ordered **slots**.
- **Slot**: one exercise (or a pair that alternates) with a **scheme** such as `2x5+`.
- **Scheme** `AxB+`: A sets of B reps; `+` means the last set is AMRAP (as many reps as possible).
- **Session**: one workout. Session numbers `n` start at 0. `sessionFor(program, n)` tells which day
  and exercises session `n` is.
- **Draft**: the in-progress session, persisted so a crash loses nothing.
- **Inventory**: the user's bar weight and plate sizes. A **loadable** weight is one you can actually
  put on the bar: `bar + 2 × (sum of plates on one side)`.
- **Increment**: how much a lift goes up after a successful session (per exercise, per unit).

### 3.2 Dependencies (complete list; nothing else)
Runtime (install with `npx expo install`): `expo`, `expo-router`, `expo-linking`, `expo-constants`,
`expo-status-bar`, `expo-splash-screen`, `react-native-screens`, `react-native-safe-area-context`,
`@expo/vector-icons`, `react-native-svg`, `@react-native-async-storage/async-storage`, `zustand`,
`expo-web-browser`, `expo-haptics`. Optional, Session 5 only: `expo-notifications`.
Dev: `jest-expo`, `jest`, `@types/jest`, `typescript`.

### 3.3 Fixed decisions
- Fresh Expo project replaces the repo root on branch `v2`. Old native folders are deleted (git keeps history).
- Weights stored in kg (float, unrounded). Display and rounding in the user's unit with the inventory.
- Program is data; sessions are computed. Only logs (completed sessions) and the draft are stored.
- Progression applied once, in `finishSession()`.
- Two session views sharing one hook: **Immersive** (default; v1 look) and **Minimal** (StrongLifts-style list).
- Program is open-ended; UI groups sessions into weeks by `sessionsPerWeek`.
- Rest timer default 90 s, configurable 0–300 s in 15 s steps.
- iOS bundle id `com.dangertechnologies.gslp`, Android package `com.greyskull`, version `2.0.0`,
  iOS buildNumber `2`, Android versionCode `2`.

## 4. Data model — `src/domain/types.ts` (copy exactly)

```ts
export type Unit = 'kg' | 'lb';
export type Kind = 'barbell' | 'bodyweight' | 'dumbbell' | 'machine';

export interface Exercise {
  id: string;                 // 'BENCH_PRESS' or 'custom_front_squat'
  name: string;               // 'Bench press'
  shortName: string;          // 'Bench'
  icon: string;               // key into src/icons.ts
  kind: Kind;
  increment: { kg: number; lb: number };   // added after a successful session
  step?: { kg: number; lb: number };       // dumbbell/machine only: rounding step
  description?: string;
  goodForm?: string[];
  badForm?: string[];
  video?: string;
  url?: string;
  background?: string;        // key into src/backgrounds.ts
  custom?: boolean;
}

export type Scheme = '2x5+' | '1x5+' | '3x5+' | '2xAMRAP' | '3x8' | '2x10';

export interface Slot {
  exercise: string | [string, string];   // tuple = alternate between the two each session
  scheme: Scheme;
}
export interface Day { name: string; slots: Slot[] }

export interface Rules {
  doubleAt: number;           // AMRAP reps at/above which the increment doubles (default 10)
  deloadPct: number;          // default 0.10
  failsBeforeDeload: number;  // default 1 (fail once → stay; fail again → deload)
  warmups: boolean;           // default true
}

export interface Program {
  template: 'base' | 'phrak' | 'custom';
  days: Day[];
  sessionsPerWeek: 2 | 3;
  rules: Rules;
}

export interface LiftState {
  weightKg: number;           // current working weight
  startKg: number;            // weight at program start (for charts)
  fails: number;              // consecutive failed AMRAPs
  incrementOverride?: { kg: number; lb: number };
}

export interface SetResult { target: number | null; reps: number }  // target null = AMRAP
export interface ExerciseResult { weightKg: number; sets: SetResult[] }

export interface SessionLog {
  n: number;
  dayName: string;
  startedAt: string;          // ISO
  finishedAt?: string;        // ISO; undefined while draft
  results: Record<string, ExerciseResult>;   // key = exercise id, in slot order
  order: string[];            // exercise ids in order (so UI never re-derives)
  skipped?: boolean;
}

export interface PlateInventory {
  barKg: number;  platesKg: number[];
  barLb: number;  platesLb: number[];
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
  sessions: SessionLog[];     // finished or skipped, ascending n
  nextSession: number;
  draft: SessionLog | null;
  needsWeightConfirm: boolean;   // true after migrating v1 data
}

export const DEFAULT_INVENTORY: PlateInventory = {
  barKg: 20, platesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
  barLb: 45, platesLb: [45, 35, 25, 10, 5, 2.5],
};
export const OPTIONAL_PLATES = { kg: [0.5, 0.25], lb: [1.25, 0.5] };
export const BAR_OPTIONS = { kg: [20, 15, 10], lb: [45, 35, 25] };
export const DEFAULT_RULES: Rules = { doubleAt: 10, deloadPct: 0.1, failsBeforeDeload: 1, warmups: true };
```

## 5. Domain algorithms — `src/domain/*.ts` (pure, no React, fully tested)

### 5.1 `units.ts` — conversion
```ts
export const KG_PER_LB = 0.45359237;
export const toUnit = (kg: number, unit: Unit) => (unit === 'kg' ? kg : kg / KG_PER_LB);
export const toKg = (value: number, unit: Unit) => (unit === 'kg' ? value : value * KG_PER_LB);
export const formatWeight = (kg: number, unit: Unit) => `${trim(toUnit(kg, unit))} ${unit}`;
// trim: show up to 2 decimals, drop trailing zeros: 62.5 → "62.5", 60 → "60", 61.25 → "61.25"
```

### 5.2 `plates.ts` — loadable weights (the core of "real barbell weights")
A barbell total is `bar + 2 × s` where `s` is a sum of plates on one side, using any number of each
available plate size. Work in **quarter units** (integers = value × 4) to avoid float error.

```ts
export interface Loadable { totals: number[]; perSide: Map<number, number[]> }  // in display unit
export function loadable(inv: PlateInventory, unit: Unit, maxTotal = 500): Loadable
```
Algorithm (unbounded coin-change reachability with fewest-plates reconstruction):
1. `bar = unit==='kg' ? inv.barKg : inv.barLb`; `plates = (unit==='kg' ? inv.platesKg : inv.platesLb)`
   sorted descending; `q = v => Math.round(v * 4)`.
2. `maxSide = q((maxTotal - bar) / 2)`. Array `best: (number[] | null)[]` of length `maxSide + 1`,
   `best[0] = []`.
3. For `s` from 1 to `maxSide`: for each plate `p` with `q(p) ≤ s` and `best[s - q(p)] !== null`:
   candidate = `[...best[s - q(p)], p]`; keep the candidate with the fewest plates (tie → larger
   first plate). Store in `best[s]`.
4. `totals` = for every `s` with `best[s] !== null`: `bar + 2 * s / 4`. `perSide.set(total, best[s]
   sorted descending)`.
5. Memoise by `JSON.stringify([inv, unit, maxTotal])`.
If `plates` is empty, `totals = [bar]`.

```ts
export function nearestLoadableKg(kg: number, inv, unit): number   // ties → lower
export function ceilLoadableKg(kg: number, inv, unit): number      // smallest total ≥ value
export function floorLoadableKg(kg: number, inv, unit): number     // largest total ≤ value, min = bar
export function platesPerSide(kg: number, inv, unit): number[]     // [] if not loadable
export function formatPlates(kg, inv, unit): string                 // "per side: 20 + 5 + 1.25"  or "bar only"
export function smallestStep(inv, unit): number                     // 2 × smallest plate, or 0
```
All take/return **kg** but search in the display unit: `value = toUnit(kg, unit)`, search
`totals`, return `toKg(result, unit)`.

Worked examples (must be tests):

| inventory | unit | input | nearest | ceil | floor | perSide of ceil |
|---|---|---|---|---|---|---|
| default | kg | 61 | 60 | 62.5 | 60 | [20, 1.25] |
| default + 0.5 plate | kg | 61 | 61 | 61 | 61 | [20, 0.5] |
| default | kg | 20 | 20 | 20 | 20 | [] |
| default | kg | 10 | 20 | 20 | 20 | [] |
| default | lb | 137 | 135 | 140 | 135 | [45, 2.5] |
| default + 1.25 plate | lb | 137 | 137.5 | 137.5 | 135 | [45, 1.25] |
| bar 20, plates [20, 15] | kg | 50 | 50 (15 per side) | 50 | 50 | [15] |
| bar 20, plates [20, 15] | kg | 52 | 50 | 60 | 50 | [20] |
| plates [] | kg | 100 | 20 | 20 | 20 | [] |

`smallestStep(default, 'kg') === 2.5`, `smallestStep(default, 'lb') === 5`.

Non-barbell kinds: `dumbbell`/`machine` round to `exercise.step` (default `{kg: 2, lb: 5}`) using
plain `Math.ceil(value / step) * step` in the display unit; `bodyweight` never rounds.
Put this dispatch in `roundForExercise(kg, exercise, mode: 'nearest'|'ceil'|'floor', inv, unit)`.

### 5.3 `progression.ts`
```ts
export interface Outcome { next: LiftState; change: 'up' | 'double' | 'same' | 'deload' | 'none' }
export function nextLift(lift: LiftState, result: ExerciseResult, rules: Rules,
                         exercise: Exercise, inv: PlateInventory, unit: Unit): Outcome
```
1. If `exercise.kind === 'bodyweight'` → `{ next: lift, change: 'none' }`.
2. `last = result.sets[result.sets.length - 1]`; `reps = last.reps`;
   `inc = (lift.incrementOverride ?? exercise.increment)[unit]` (display unit).
3. `cur = toUnit(result.weightKg, unit)` (use the weight actually lifted, not `lift.weightKg`).
4. If `reps >= rules.doubleAt`: `target = cur + 2*inc`, change `'double'`.
   Else if `reps >= 5`: `target = cur + inc`, change `'up'`.
   Both: `nextKg = roundForExercise(toKg(target), exercise, 'ceil', inv, unit)`; `fails = 0`.
5. Else (`reps < 5`): `fails = lift.fails + 1`. If `fails >= rules.failsBeforeDeload + 1`
   (i.e. with default 1: first fail stays, second fail deloads): `nextKg =
   roundForExercise(toKg(cur * (1 - rules.deloadPct)), exercise, 'floor', inv, unit)`,
   `fails = 0`, change `'deload'`. Otherwise `nextKg = result.weightKg`, change `'same'`.
6. `next = { ...lift, weightKg: nextKg, fails }`.

Worked examples (tests), default inventory, default rules:

| unit | exercise inc | cur | last reps | fails before | → weight | fails after | change |
|---|---|---|---|---|---|---|---|
| kg | 1.25 | 60 | 7 | 0 | 62.5 (61.25 rounded up) | 0 | up |
| kg | 1.25 | 60 | 12 | 0 | 62.5 | 0 | double |
| kg | 2.5 | 100 | 6 | 0 | 102.5 | 0 | up |
| kg | 2.5 | 100 | 11 | 0 | 105 | 0 | double |
| kg | 2.5 | 100 | 4 | 0 | 100 | 1 | same |
| kg | 2.5 | 100 | 4 | 1 | 90 | 0 | deload |
| kg | 2.5 | 62.5 | 3 | 1 | 55 (56.25 floored) | 0 | deload |
| lb | 2.5 | 135 | 5 | 0 | 140 (137.5 not loadable) | 0 | up |
| lb + 1.25 plates | 2.5 | 135 | 5 | 0 | 137.5 | 0 | up |
| kg bodyweight | 0 | 0 | 15 | 0 | 0 | 0 | none |

Invariant test: apply 200 successes (reps 6) to squat 60 kg → final ≤ 60 + 200×2.5 + 2.5 and every
intermediate value is loadable. Determinism test: same inputs twice → deep-equal outputs.

Also export `warmups(workKg, scheme, exercise, inv, unit): { reps: number; kg: number }[]`:
- bodyweight or `scheme` is `2xAMRAP` → `[]`.
- `1x5+` (deadlift) → two sets: `[{5, 50 %}, {3, 75 %}]`.
- otherwise four: `[{5, bar}, {4, 55 %}, {3, 70 %}, {2, 85 %}]`.
- Each `kg = max(barKg-in-kg, nearestLoadable(pct × workKg))`; drop a warm-up if its kg equals the
  work weight; drop duplicates.

### 5.4 `program.ts`
```ts
export const TEMPLATES: Record<'base' | 'phrak', Program>
export const PLUGINS: Record<PluginId, { label: string; apply(p: Program): Program }>
export function sessionFor(program: Program, n: number): { dayName: string; slots: { exercise: string; scheme: Scheme }[] }
export function parseScheme(s: Scheme): { sets: number; reps: number | null; amrap: boolean }
export function validateProgram(p: Program): string[]   // [] when valid
```
Templates (write as data):
```ts
base: { template: 'base', sessionsPerWeek: 3, rules: DEFAULT_RULES, days: [
  { name: 'Day 1', slots: [{ exercise: ['MILITARY_PRESS', 'BENCH_PRESS'], scheme: '2x5+' }, { exercise: 'BARBELL_SQUAT', scheme: '2x5+' }] },
  { name: 'Day 2', slots: [{ exercise: ['MILITARY_PRESS', 'BENCH_PRESS'], scheme: '2x5+' }, { exercise: 'DEADLIFT', scheme: '1x5+' }] },
  { name: 'Day 3', slots: [{ exercise: ['MILITARY_PRESS', 'BENCH_PRESS'], scheme: '2x5+' }, { exercise: 'BARBELL_SQUAT', scheme: '2x5+' }] } ] }
phrak: { template: 'phrak', sessionsPerWeek: 3, rules: DEFAULT_RULES, days: [
  { name: 'A', slots: [{ exercise: 'CHINUPS', scheme: '2x5+' }, { exercise: 'MILITARY_PRESS', scheme: '2x5+' }, { exercise: 'BARBELL_SQUAT', scheme: '2x5+' }] },
  { name: 'B', slots: [{ exercise: 'BENT_OVER_ROW', scheme: '2x5+' }, { exercise: 'BENCH_PRESS', scheme: '2x5+' }, { exercise: 'DEADLIFT', scheme: '1x5+' }] } ] }
```
Plugins (each appends slots to the end of the listed days; idempotent — skip if already present):
`curls` (`CURLS`, `2xAMRAP`, every day), `chins` (`CHINUPS`, `2xAMRAP`, every day; base only),
`dips` (`DIPS`, `2xAMRAP`, every day), `abs` (`CRUNCHES`, `2xAMRAP`, every day),
`rows_instead_of_chins` (phrak only: replace `CHINUPS` with `BENT_OVER_ROW` in A and `BENT_OVER_ROW`
with `CHINUPS` in B — i.e. swap).

`sessionFor(program, n)`:
1. `day = program.days[n % program.days.length]`.
2. For each slot: if `exercise` is a string, use it. If it is a tuple `[a, b]`: `count` = number of
   sessions `m < n` whose day `program.days[m % days.length]` contains a slot with the same pair
   (compare as sorted ids). `exercise = [a, b][count % 2]`.
3. Return `{ dayName: day.name, slots }`.
`validateProgram` returns errors for: no days, a day with no slots, a tuple pair that appears with a
different order in another day, an exercise id not in the catalog (pass catalog in), duplicate
exercise in one day.

Required test — base template, sessions 0..5 resolve to:
`[Press, Squat] [Bench, Deadlift] [Press, Squat] [Bench, Squat] [Press, Deadlift] [Bench, Squat]`.
Phrak: days `A B A B A B`; deadlift in sessions 1, 3, 5 only.

### 5.5 `projection.ts`
```ts
export function project(state: AppState, count: number): { n: number; dayName: string;
  lifts: { exercise: string; scheme: Scheme; weightKg: number }[] }[]
```
Simulate `count` sessions starting at `state.nextSession` (draft ignored): copy `lifts`; for each
session apply `nextLift` with a fake result of `reps = 5` (plain success) for each barbell slot
after recording its weight. Weights shown are what the user would lift in that session.

### 5.6 `migrateV1.ts`
v1 stored one JSON blob under AsyncStorage key `GSLP_STATE_18` (the new
`@react-native-async-storage/async-storage` reads the same on-device storage as RN 0.57's built-in
AsyncStorage, so the old data is readable after upgrade). Shape:
```ts
interface V1 { configuration: { initialSetupComplete: boolean; unit: 'METRIC' | 'IMPERIAL';
  exercises: Record<string, { include: 'REQUIRED' | 'INCLUDED' | 'EXCLUDED'; bodyweight?: boolean }>;
  weights: Record<string, { initial: number; current: number }> };   // ALWAYS kg
  workoutPlan: { id: number; completed: number | null;   // epoch ms
    exercises: { definition: string; weight?: number; amrap?: number | null; completed?: number | null }[] }[] }
```
```ts
export function migrateV1(raw: string, catalog: Record<string, Exercise>):
  { patch: Partial<AppState>; suspects: string[] } | null   // null if raw is not parseable v1
```
1. `unit = METRIC ? 'kg' : 'lb'`.
2. `program = TEMPLATES.base` with plugins: `curls` always; `chins` always; `dips`/`abs` if
   `DIPS`/`CRUNCHES` have `include === 'INCLUDED'`; if `BENT_OVER_ROW` is `INCLUDED` add a slot
   `{ exercise: 'BENT_OVER_ROW', scheme: '2x5+' }` to every day.
3. For each key in `weights` that exists in `catalog`: `lifts[key] = { weightKg: current, startKg:
   initial || current, fails: 0 }`. Mark **suspect** if `current > 3 × initial` (when initial > 0) or
   `current > 400`. For suspects set `weightKg = initial > 0 ? initial : 20`.
4. `sessions`: for each `workoutPlan` entry with `completed`, one `SessionLog { n: id, dayName: '',
   startedAt: finishedAt: new Date(completed).toISOString(), order: [...definitions], results }`
   where each exercise with `completed` gives `{ weightKg: weight ?? 0, sets: [{ target: null, reps:
   amrap ?? 0 }] }`; drop an exercise result whose weight is suspect by the rule in step 3 (compare
   to that lift's `initial`). `nextSession = count of completed workouts`.
5. `needsWeightConfirm = true`. Return `{ patch, suspects }`.
Never delete or overwrite `GSLP_STATE_18`.

Fixture for tests and the dev seed button — `src/dev/v1-imperial.json` (moved: Metro blocks `__tests__` folders):
```json
{ "configuration": { "initialSetupComplete": true, "unit": "IMPERIAL",
    "exercises": { "BARBELL_SQUAT": { "include": "REQUIRED" }, "DEADLIFT": { "include": "REQUIRED" },
      "BENCH_PRESS": { "include": "REQUIRED" }, "MILITARY_PRESS": { "include": "REQUIRED" },
      "CHINUPS": { "include": "REQUIRED", "bodyweight": true }, "CURLS": { "include": "REQUIRED" },
      "CRUNCHES": { "include": "EXCLUDED", "bodyweight": true }, "BENT_OVER_ROW": { "include": "INCLUDED" },
      "DIPS": { "include": "EXCLUDED", "bodyweight": true } },
    "weights": { "BARBELL_SQUAT": { "initial": 61.23, "current": 68.04 },
      "BENCH_PRESS": { "initial": 43.09, "current": 45.36 },
      "MILITARY_PRESS": { "initial": 29.48, "current": 31.75 },
      "DEADLIFT": { "initial": 83.91, "current": 88.45 },
      "BENT_OVER_ROW": { "initial": 20.41, "current": 21457934.2 },
      "CURLS": { "initial": 15.88, "current": 15.88 } } },
  "workoutPlan": [
    { "id": 0, "completed": 1556000000000, "exercises": [
      { "definition": "BARBELL_SQUAT", "weight": 61.23, "amrap": 8, "completed": 1556000000000 },
      { "definition": "BENCH_PRESS", "weight": 43.09, "amrap": 6, "completed": 1556000000000 },
      { "definition": "BENT_OVER_ROW", "weight": 20.41, "amrap": 15, "completed": 1556000000000 } ] },
    { "id": 1, "completed": 1556200000000, "exercises": [
      { "definition": "DEADLIFT", "weight": 83.91, "amrap": 7, "completed": 1556200000000 },
      { "definition": "BENT_OVER_ROW", "weight": 21457934.2, "amrap": 12, "completed": 1556200000000 } ] },
    { "id": 2, "completed": null, "exercises": [ { "definition": "BARBELL_SQUAT" } ] } ] }
```
Expected: `unit 'lb'`; `suspects = ['BENT_OVER_ROW']`; row `weightKg = 20.41`; squat `weightKg =
68.04`; `sessions.length = 2`; session 1 has no `BENT_OVER_ROW` result; `nextSession = 2`;
program is base + curls + chins + row slot on every day; `needsWeightConfirm = true`.

## 6. Store — `src/store.ts`

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
export const STORAGE_KEY = 'gslp-v2';
export const LEGACY_KEY = 'GSLP_STATE_18';
```
State = `AppState` + `hydrated: boolean` + the actions below. Use
`persist(..., { name: STORAGE_KEY, storage: createJSONStorage(() => AsyncStorage), version: 2,
partialize: s => (everything except hydrated), onRehydrateStorage: () => (state) => { ... } })`.
In `onRehydrateStorage`'s callback: if `state.program === null && state.sessions.length === 0`,
`AsyncStorage.getItem(LEGACY_KEY)` → if non-null, `migrateV1` → `set(patch)`; finally `set({ hydrated: true })`.
Export `useStore` and selector helpers (`useUnit`, `useInventory`, `useLift(id)`).

| Action | Signature | Behaviour |
|---|---|---|
| `initialState` | `(): AppState` | exercises from `src/exercises.json`, `unit 'kg'`, `DEFAULT_INVENTORY`, `minimalist false`, `restSeconds 90`, `program null`, `lifts {}`, `sessions []`, `nextSession 0`, `draft null`, `needsWeightConfirm false`. Fresh object every call. |
| `setUnit` | `(unit)` | sets `unit` only. |
| `setInventory` | `(patch: Partial<PlateInventory>)` | merge. |
| `setSettings` | `({ minimalist?, restSeconds? })` | merge. |
| `setProgram` | `(program)` | `validateProgram` must be `[]` else throw; sets `program`; for every barbell/dumbbell/machine exercise referenced that has no `lifts[id]`, create `{ weightKg: bar in kg, startKg: same, fails: 0 }`; discards `draft`. |
| `setLift` | `(id, patch: Partial<LiftState>)` | merge; `weightKg` must be `> 0`. |
| `startSession` | `(n)` | if `draft?.n === n` return it. Else `sessionFor` → `draft = { n, dayName, startedAt: now, order, results: {} }` where each result is `{ weightKg: lifts[id].weightKg (0 for bodyweight), sets: parseScheme → [{ target: reps, reps: 0 }…, last target null if amrap] }`. |
| `logSet` | `(exerciseId, setIndex, reps)` | writes `draft.results[id].sets[setIndex].reps`. |
| `setDraftWeight` | `(exerciseId, kg)` | writes `draft.results[id].weightKg`. |
| `finishSession` | `(): Record<string, Outcome>` | requires `draft`; `finishedAt = now`; push to `sessions`; for each exercise in `draft.order` run `nextLift` and write `lifts[id] = outcome.next`; `nextSession = draft.n + 1`; `draft = null`; return outcomes. Calling again with no draft throws. |
| `skipSession` | `()` | push `{ n: nextSession, skipped: true, order: [], results: {}, startedAt: finishedAt: now }`; `nextSession++`; `draft = null`. |
| `editSession` | `(n, results)` | replace `sessions[i].results` for the log with that `n`. Does **not** recompute progression. |
| `upsertExercise` | `(exercise)` | `exercises[id] = exercise`. |
| `deleteExercise` | `(id): string[]` | if any program slot references it, return the day names and do nothing; else delete and return `[]`. Built-ins (`custom !== true`) cannot be deleted. |
| `confirmWeights` | `(weights: Record<string, number /*kg*/>)` | sets each `lifts[id].weightKg`; `needsWeightConfirm = false`. |
| `exportJson` | `(): string` | `JSON.stringify(partialized state, null, 2)`. |
| `reset` | `()` | `set(initialState())`. Does not touch `LEGACY_KEY`. |

Tests (`src/store.test.ts`, using an in-memory storage mock): `finishSession` applies progression
exactly once (call `startSession`, log reps 8 on all sets, `finishSession`, assert weight; calling
`finishSession` again throws); `startSession` twice returns the same draft; draft survives
`JSON.parse(JSON.stringify(state))`; `deleteExercise` refusal; `reset` then `setProgram` works;
migration fixture via mocked `AsyncStorage.getItem(LEGACY_KEY)`.

## 7. Screen specifications (expo-router, `app/`)

Visual language (all screens): full-bleed background photo (`components/Background.tsx`:
`ImageBackground` of a blurred photo + `rgba(0,0,0,0.45)` overlay + `SafeAreaView`), white text,
font weights `'200'`/`'300'`, large thin numerals for weights/reps, 1 px white borders on buttons.
Header: expo-router Stack header, transparent, white tint, back arrow visible everywhere except Home.

| Route | Reads | Writes | Elements |
|---|---|---|---|
| `/` Home | `program, lifts, nextSession, draft, sessions, unit, inventory` | `skipSession` | Title "Next up · Day X · Week W" (week = `floor(n / sessionsPerWeek) + 1`). Card listing `sessionFor(nextSession)` slots in order with `formatWeight` and plates line. Button **Start** (or **Resume** if `draft`) → `/session/[n]`. Link **Skip**. Section "Coming up": `project(state, 9)` grouped by week, each row "Day · Press 62.5 · Squat 105". Section "History": finished sessions newest first, row → `/session/edit/[n]`. Header icons: settings (`/settings`), chart (`/progress`). If `program === null` → `router.replace('/setup')`. If `needsWeightConfirm` → `router.replace('/setup/confirm')`. |
| `/session/[n]` | `draft, program, exercises, unit, inventory, restSeconds, minimalist` | via `useSession` | Calls `startSession(n)` on mount. Renders `SessionImmersive` or `SessionMinimal`. |
| `/session/edit/[n]` | `sessions` | `editSession` | For each exercise in `order`: weight stepper (loadable), reps stepper per set. Note text: "Changing a past session does not recalculate your current weights. Adjust them in the lift editor." Save → back. |
| `/lift/[id]` | `lifts, exercises, sessions, unit, inventory` | `setLift` | Name, current weight stepper (loadable steps), plates line, start weight stepper, "Increment per session" stepper (0.25 steps; shows warning if not a multiple of `smallestStep`), fails counter (reset button), est. 1RM = `weight × (1 + bestAmrap/30)` text, history list (date, weight, AMRAP reps). |
| `/settings` | all settings | `setUnit, setInventory, setSettings, reset` | Unit segmented control. "Your gym": bar weight picker from `BAR_OPTIONS[unit]`, checkbox per plate size from `DEFAULT_INVENTORY.plates*` ∪ `OPTIONAL_PLATES[unit]`, live line "Smallest jump: 2.5 kg". Minimalist switch. Rest time stepper (0–300, step 15). Rows: **Edit program** → `/setup/days?edit=1`, **Exercises** → `/exercises`, **Export backup** → `Share.share({ message: exportJson() })`, **Reset** (Alert confirm). `__DEV__` only: **Seed v1 data** writes the fixture to `LEGACY_KEY`, calls `reset()`, then re-runs migration, and **Fast-forward** finishes the draft with reps 8. |
| `/progress` | `sessions, lifts, unit` | — | Horizontal paging `FlatList` (`pagingEnabled`), one page per lift: `Chart` (weight per finished session; reps for bodyweight), "Start → now", best AMRAP, est. 1RM. Last page "Projection": `project(state, 9)` list. |
| `/exercises` | `exercises, program` | — | Sections Built-in / Custom; row → `/exercises/[id]`; button **New exercise** → `/exercises/new`. |
| `/exercises/[id]` | `exercises` | `upsertExercise, deleteExercise` | Fields: name, short name, kind (4 chips), increment kg + lb (steppers), icon picker (grid of `src/icons.ts` keys), description, good form (one per line), bad form, URL. Save → `id = custom_<slugified name>` for new. Delete (custom only) → if refused, Alert listing day names. |
| `/setup` | — | — | Welcome text (3 lines about GSLP) + **Get started** → `/setup/units`. |
| `/setup/units` | setup draft | — | Same "unit + Your gym" component as Settings, writes to the setup context. **Next** → `/setup/template`. |
| `/setup/template` | — | — | Three cards: **Greyskull LP** ("Press/Bench alternate · Squat Mon & Fri · Deadlift Wed"), **Phrak's GSLP** ("A: Chins, Press, Squat · B: Rows, Bench, Deadlift"), **From scratch** (one empty day). Selecting sets `draft.program = clone(TEMPLATES[x])`. **Next** → `/setup/options`. |
| `/setup/options` | — | — | Plugin switches (`PLUGINS` filtered by template), sessions per week (2/3), warm-ups switch, rules steppers (doubleAt 6–15, deload 5–20 %, failsBeforeDeload 0–3). **Next** → `/setup/days`. |
| `/setup/days` | — | — | One card per day: editable name, ordered slot rows (exercise name, scheme chip), per row ▲ ▼ ✕, **Add exercise** opens a picker (all `exercises`, plus "alternate with…" second pick to create a tuple; a tuple must use the same order everywhere — enforce by always storing sorted ids and displaying `a / b`), **Add day**, **Remove day**. Validation errors shown inline from `validateProgram`. **Next** → `/setup/weights`. In edit mode (`?edit=1`): initial value from store; **Save** → `setProgram`, `router.replace('/')`. |
| `/setup/weights` | — | — | For each non-bodyweight exercise referenced: loadable stepper, default bar; button "Start with the bar". **Next** → `/setup/summary`. |
| `/setup/summary` | — | `setProgram, setLift, setUnit, setInventory` | Lists week 1 sessions with weights. **Start training** → writes store → `router.replace('/')`. |
| `/setup/confirm` | `lifts, needsWeightConfirm` | `confirmWeights` | Text "We moved your data from the old version. Please check these weights." Row per lift: loadable stepper; rows in `suspects` (store them in `needsWeightConfirmSuspects: string[]`, add to AppState) show red "looks wrong" label. **Confirm** → `router.replace('/')`. |

Setup draft lives in a React context in `app/setup/_layout.tsx` (`useState<{ unit, inventory,
program, weights: Record<string, number> }>`), **not** in the store, until Summary.

### `src/hooks/useSession.ts`
```ts
export function useSession(n: number): {
  draft: SessionLog;                      // from store (startSession called on mount)
  items: SessionItem[];                   // flattened in order
  activeIndex: number;                    // first item with reps === null-ish (not logged)
  record(itemIndex: number, reps: number): void;   // logs + starts rest if restSeconds > 0 and not last
  setWeight(exerciseId: string, kg: number): void;
  restRemaining: number | null;           // seconds, null when not resting
  skipRest(): void;
  isComplete: boolean;                    // every work set has reps logged
  finish(): Record<string, Outcome>;      // store.finishSession
}
interface SessionItem { exerciseId: string; kind: 'warmup' | 'work' | 'amrap'; setIndex: number | null;
  targetReps: number | null; weightKg: number; logged: boolean; reps: number }
```
Warm-ups come from `warmups()` and are not persisted; tapping Done on a warm-up only advances.
Rest timer: one `setInterval` in a `useEffect`, cleared on unmount; at 0 call
`Haptics.notificationAsync(Success)`. Optional (do last, skip if any trouble): on `AppState`
background, `Notifications.scheduleNotificationAsync({ content: { title: 'Rest over' }, trigger: {
seconds: restRemaining } })`, cancel on foreground.

### `components/Stepper.tsx`
Props `{ value: number; onChange(v: number): void; step?: number; values?: number[]; format(v):
string; min?: number; max?: number; label?: string }`. If `values` given, stepping moves to the
next/previous entry (used for loadable totals). `Pressable` buttons: `onPress` = one step;
`onLongPress` (`delayLongPress={400}`) starts `setInterval(150)`; `onPressOut` and unmount clear it.
`accessibilityLabel` "Increase"/"Decrease". Value in large thin text; `label` small above.

### `views/SessionImmersive.tsx` (v1 look)
Background = exercise `background` or default. Top: supertitle (`Warm-up 2 of 4` / `Set 1 of 2` /
`AMRAP`), exercise name, weight big + plates line small (tap weight → modal Stepper over loadable
values → `setWeight`). Middle: reps — fixed target shown big; AMRAP shows a Stepper starting at
target 5. Below: two columns "Do" / "Don't" from `goodForm`/`badForm`. Bottom: **Done** button →
`record`. When `restRemaining !== null` show `RestRing` full-screen with Skip. When `isComplete`
show **Finish workout** → `finish()` → `Celebration` (list of changes, "Bench 60 → 62.5 kg ↑") →
**Back to home** → `router.replace('/')`.

### `views/SessionMinimal.tsx`
`ScrollView`. Row per exercise: name, weight + plates (tap → Stepper modal), circles (44 px) per
work set in a row; warm-ups collapsed into one small line "Warm-up: 20 ×5 · 35 ×4 · 45 ×3 · 55 ×2".
Circle states: empty (shows target or "5+"), logged (filled, shows reps). Tap empty → logs target;
tap logged → reps − 1 (to 0, then back to empty); long-press → Stepper modal. Bottom bar: rest
countdown text + Skip while resting; **Finish workout** when `isComplete`.

## 8. Sessions (one per agent run)

### Session 1 — Scaffold
**Goal:** Expo SDK 57 app boots in Expo Go with assets ported and ids set.
1. `git switch -c v2`.
2. `git rm -r ios android storybook scripts index.js .babelrc tslint.json gql.d.ts yarn.lock
   .watchmanconfig .prettierrc.json tsconfig.json package.json .gitignore && rm -rf .expo node_modules`.
   Leave `App/` and `assets/` for now.
3. In the scratchpad: `npx create-expo-app@latest gslp --template blank-typescript`, then copy
   `package.json tsconfig.json app.json .gitignore index.ts App.tsx` (whatever the template produced)
   into the repo root. Delete the template's `App.tsx` and `index.ts`.
4. Install expo-router manually: `npx expo install expo-router expo-linking expo-constants
   expo-status-bar expo-splash-screen react-native-screens react-native-safe-area-context`; set
   `"main": "expo-router/entry"` in `package.json`; in `app.json` add `"scheme": "gslp"` and
   `"plugins": ["expo-router", "expo-splash-screen"]`. Then install the rest of §3.2:
   `npx expo install @expo/vector-icons react-native-svg @react-native-async-storage/async-storage
   zustand expo-web-browser expo-haptics` and `npx expo install jest-expo jest @types/jest -- --save-dev`.
   Add to `package.json`: `"scripts": { "start": "expo start", "test": "jest", "typecheck": "tsc --noEmit" }`,
   `"jest": { "preset": "jest-expo" }`.
5. `app.json` `expo` block: `name` "Greyskull LP", `slug` "greyskull", `version` "2.0.0",
   `orientation` "portrait", `userInterfaceStyle` "dark", `newArchEnabled` true,
   `icon` "./assets/icon.png", `splash` `{ image: "./assets/splash.png", resizeMode: "cover",
   backgroundColor: "#000000" }`, `ios: { bundleIdentifier: "com.dangertechnologies.gslp",
   buildNumber: "2", supportsTablet: false }`, `android: { package: "com.greyskull", versionCode: 2 }`.
   Pick the largest PNG in `assets/Icons/` as `assets/icon.png`; keep `assets/splash.png`.
6. Port assets: `mkdir -p assets/backgrounds assets/icons src`;
   `git mv App/Images/Backgrounds/*-blur.jpg assets/backgrounds/`;
   `git mv App/Images/Icons/*.png assets/icons/`;
   create `src/backgrounds.ts` and `src/icons.ts` exporting `Record<string, ImageSourcePropType>`
   with `require('../assets/backgrounds/<file>')` — copy the key→file mapping from
   `App/Images/Backgrounds/index.ts` and `App/Images/Icons/index.ts`.
7. Port the catalog: write a one-off Node script (scratchpad) that reads
   `App/Configuration/exercises.json` and writes `src/exercises.json` with, per id: `id`, `name`,
   `shortName`, `icon`, `description`, `goodForm`, `badForm`, `video`, `url`, `background`
   (only if present), `kind` (`'bodyweight'` if `bodyweight: true` else `'barbell'`),
   `increment` (`BARBELL_SQUAT`, `DEADLIFT` → `{ kg: 2.5, lb: 5 }`; bodyweight → `{ kg: 0, lb: 0 }`;
   others → `{ kg: 1.25, lb: 2.5 }`). Drop `slot`, `include`, `reps`, `initialWeight`,
   `incrementFactor`. Then `git rm -r App`.
8. `app/_layout.tsx`: `<Stack screenOptions={{ headerTransparent: true, headerTintColor: '#fff',
   headerTitle: '' , contentStyle: { backgroundColor: '#000' } }} />`. `app/index.tsx`: a `View`
   with text "Greyskull LP".
9. `eas.json`: `{ "cli": { "version": ">= 16.0.0" }, "build": { "preview": { "distribution":
   "internal" }, "production": {} }, "submit": { "production": {} } }`.
10. Android keystore check: `find ~ \( -name '*.keystore' -o -name '*.jks' \) -not -path '*/node_modules/*' 2>/dev/null`.
    Write the result under a "Release" heading in `README.md` (replace the old README body with a
    short v2 description + run/test/build commands + this note).
**Verify:** `npx expo start` shows "Greyskull LP" in Expo Go; `npm test` prints "No tests found"
without error (add `"passWithNoTests": true` to jest config); `npm run typecheck` clean;
`src/exercises.json` has 9 entries with `kind` and `increment`.
**Commit:** `chore: scaffold Expo SDK 57 app, port assets and exercise catalog`

### Session 2 — Domain core
**Goal:** `src/domain/{types,units,plates,progression,program,projection}.ts` implemented per §4–§5 with tests.
1. Create `src/domain/types.ts` from §4 verbatim.
2. `units.ts` (§5.1), `plates.ts` (§5.2), `progression.ts` (§5.3), `program.ts` (§5.4),
   `projection.ts` (§5.5). Export everything from `src/domain/index.ts`.
3. Tests in `src/domain/__tests__/`: `plates.test.ts` (every row of the §5.2 table; also: for the
   default kg inventory every total from 20 to 200 in 2.5 steps is loadable and `bar + 2 ×
   sum(platesPerSide)` equals the total), `units.test.ts` (135 lb → kg → lb → nearestLoadable ===
   135; 1,000 round trips keep 61.23496995 kg within 1e-9), `progression.test.ts` (every row of the
   §5.3 table + invariant + determinism + warm-ups: squat 100 kg kg-default → `[20×5, 55×4, 70×3,
   85×2]`; deadlift 140 → `[70×5, 105×3]`; bench 22.5 → `[20×5]` only), `program.test.ts` (base and
   phrak sequences from §5.4, `validateProgram` catches reversed tuple and unknown id, each plugin is
   idempotent), `projection.test.ts` (9 sessions from a fresh base program at bar weight: squat
   sequence 20, 22.5, 25 … on its sessions; length 9).
**Verify:** `npm test` green, `npm run typecheck` clean. No React imports under `src/domain`.
**Commit:** `feat(domain): units, plate math, progression, program templates, projection`

### Session 3 — Store and v1 migration
**Goal:** `src/store.ts` and `src/domain/migrateV1.ts` per §5.6 and §6, tested.
1. `migrateV1.ts` + fixture file from §5.6 + `migrateV1.test.ts` asserting the Expected list.
2. `store.ts` per §6. Add `needsWeightConfirmSuspects: string[]` to `AppState` (and `initialState`).
3. `src/store.test.ts` per §6 with `jest.mock('@react-native-async-storage/async-storage', () =>
   require('@react-native-async-storage/async-storage/jest/async-storage-mock'))`.
**Verify:** `npm test` green; typecheck clean.
**Commit:** `feat(store): zustand persist store, actions, v1 migration`

### Session 4 — Shell, Home, Settings, Lift editor, Confirm weights
**Goal:** Navigable app on real store data (no workout play yet).
1. `components/Background.tsx`, `Button.tsx`, `Stepper.tsx` (§7), `ExerciseIcon.tsx` (Image from
   `src/icons.ts`, 28 px, white tint), `PlatesLine.tsx` (text from `formatPlates`), `GymSettings.tsx`
   (unit + bar + plates editor; props `value, onChange` so Setup can reuse it).
2. `app/_layout.tsx`: `SplashScreen.preventAutoHideAsync()` at module top; in the layout read
   `hydrated` from the store; when true call `SplashScreen.hideAsync()`; render `null` until hydrated.
3. `app/index.tsx`, `app/settings.tsx`, `app/lift/[id].tsx`, `app/setup/confirm.tsx` per §7.
   Temporary `app/setup/index.tsx` with text "Setup coming in Session 6" and a `__DEV__` button
   **Use Base GSLP defaults** that calls `setProgram(TEMPLATES.base)` so Home can be exercised.
4. Dev seed button on Settings (§7) using the fixture.
**Verify** (Expo Go): fresh install → Setup stub → dev defaults → Home lists Day 1 "Press 20 kg ·
Squat 20 kg" with "bar only" plates lines and Coming up shows 9 sessions. Settings: switch to lb →
Home shows 45 lb; tick 1.25 lb plate → "Smallest jump: 2.5 lb". Lift editor: set bench to 62.5 kg →
Home updates. Seed v1 → Confirm screen shows "Bent-over row — looks wrong" prefilled 45 lb → Confirm
→ Home shows history with 2 sessions. Reset → Setup stub.
**Commit:** `feat(ui): app shell, home, settings, lift editor, confirm-weights`

### Session 5 — Session engine + Immersive view
**Goal:** A playable workout with the v1 look, persisted draft, Finish and celebration.
1. `hooks/useSession.ts`, `components/RestRing.tsx` (svg `Circle` with `strokeDasharray`,
   remaining seconds in the middle, Skip button), `components/Celebration.tsx`,
   `views/SessionImmersive.tsx`, `app/session/[n].tsx` (renders Immersive for now regardless of
   `minimalist`).
2. Optional last step: expo-notifications for background rest alert (install with `npx expo install
   expo-notifications`, add plugin to `app.json`). Skip on any difficulty and note it.
**Verify** (Expo Go, kg, default inventory, base template, press 20 kg / squat 100 kg):
session 0 shows for Press only one warm-up (20×5; the others round to the bar and are dropped), then
Set 1, Set 2, AMRAP; Squat shows warm-ups 20×5, 55×4, 70×3, 85×2. Log press AMRAP 12 and squat
AMRAP 4. After Finish the Celebration says "Overhead press 20 → 22.5 kg" (20 + 2 × 1.25 = 22.5,
loadable) and "Squat 100 → 100 kg (1 fail)". Kill the app mid-session → reopening Home shows **Resume** and the
session continues at the same set. Back arrow during a session returns Home without losing sets.
After Finish, Home shows session 1 = Bench + Deadlift.
**Commit:** `feat(session): engine hook, immersive view, rest timer, finish and celebration`

### Session 6 — Setup flow and program editor
**Goal:** `app/setup/*` complete per §7, re-entrant from Settings.
1. `app/setup/_layout.tsx` with the draft context; screens `index, units, template, options, days,
   weights, summary`. Replace the Session 4 stub.
2. `components/ExercisePicker.tsx` (modal list with search, used by `days` and later by Session 7).
**Verify:** Fresh install → full flow with Phrak's → Home Day A = Chins, Press, Squat; session 1 = B
with Deadlift 1x5+. Base + curls → every day ends with Curls `2xAMRAP`. Edit program from Settings:
add Dips to Day 2 → Home's next session (if it is Day 2) shows Dips; history unchanged.
`validateProgram` error shown when a day is emptied.
**Commit:** `feat(setup): onboarding flow and program editor`

### Session 7 — Custom exercises
**Goal:** `app/exercises/index.tsx`, `app/exercises/[id].tsx` per §7.
**Verify:** Create "Front squat" (barbell, 2.5 kg / 5 lb) → appears in the picker → add to Day 1 via
Edit program → Setup weights not shown, so `setProgram` created its lift at bar weight → lift editor
sets 60 kg → next session lists it with plates "per side: 20". Delete while referenced → Alert
naming "Day 1". Remove from program → delete succeeds.
**Commit:** `feat: custom exercises`

### Session 8 — Minimal session view
**Goal:** `views/SessionMinimal.tsx` per §7; `app/session/[n].tsx` switches on `minimalist`.
**Verify:** Toggle Minimalist → open the session → tap circles → rest bar counts down → Finish gives
the same progression as Immersive for the same reps (check by comparing lift weights after two
identical sessions, one in each mode). Kill/resume works.
**Commit:** `feat: minimalist session view`

### Session 9 — Progress, projection page, edit past session
**Goal:** `components/Chart.tsx` (svg `Polyline` + `Circle`s, y-axis min/max labels, no lib),
`app/progress.tsx`, `app/session/edit/[n].tsx` per §7.
**Verify:** After ≥ 3 finished sessions: charts render in kg and lb; chin-ups chart reps; projection
page lists 9 sessions; editing session 0's squat reps changes the chart, not `lifts`.
**Commit:** `feat: progress charts, projection page, edit past session`

### Session 10 — Release
1. `README.md`: run/test/build/release instructions; migration note; keystore status.
2. `eas build --profile preview -p ios` (and `-p android` if the keystore exists). Install the iOS
   build over a device that still has v1 → Confirm screen appears with real data.
3. `eas build --profile production -p ios && eas submit -p ios`. Android: with keystore → same;
   without → change `android.package` to `com.dangertechnologies.gslp`, publish as a new listing.
4. Store "What's new": "Fixed weights jumping to huge numbers. Edit any weight any time. Correct
   Greyskull LP days and exercise order. Custom rest timer, projections, custom exercises, minimalist
   mode, back button and Finish button. kg and lb both work with your real plates."
**Commit:** `chore(release): 2.0.0`

## 9. Global acceptance checklist (run before Session 10)
- `npm test`, `npm run typecheck` green.
- Base: deadlift once per 3 sessions; press/bench alternate; squat sessions 0 and 2.
- AMRAP 4 → same weight, fails 1; 4 again → floor-loadable of 90 %; 5 → +inc rounded up to loadable; 10 → +2×inc; bodyweight unchanged.
- Every displayed weight anywhere is loadable with the configured bar + plates, and the plates line sums back to it.
- Toggle kg ↔ lb 20 times → all displayed weights unchanged.
- Kill mid-session → resume at the same set. Back never loses logged sets.
- Stepper: tap = exactly one step; long-press repeats.
- Migration fixture: row suspect prefilled with start weight; history intact; `GSLP_STATE_18` still present afterwards.
