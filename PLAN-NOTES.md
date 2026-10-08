# PLAN-NOTES

Decisions, deviations and manual-check items, appended per Session.

## Needs manual check on device
- Session 4: look and feel of Home/Settings/Lift editor/Confirm; header icons tappable; Stepper long-press feel on a real finger
- Session 4: splash screen hides once the store is hydrated (no 2 s delay); no flash of the Setup stub on launch with saved data

## 2026-10-08 — Session 1 (scaffold)
- Branch `v2` created from the working checkout of master (2ba6d3e).
- Scaffolded with `create-expo-app --template blank-typescript --no-install` (inside the repo, then moved
  `package.json`, `tsconfig.json`, `.gitignore` up, `app.json` rewritten). Template resolves to Expo SDK 57
  (`expo ~57.0.27`, RN 0.86.3, React 19.2.3). `--no-install` was used, then a single root install.
- `npx expo install` cannot reach api.expo.dev from the sandbox; `EXPO_OFFLINE=1 npx expo install ...` works
  (versions come from the bundled SDK list) and was used throughout.
- `.npmrc` with `legacy-peer-deps=true`: jest-expo 57 has peer deps (`@react-native/jest-preset`,
  `react-server-dom-webpack`) that conflict with optional worklets peers; installed explicitly.
- jest pinned to ^29 (what jest-expo 57 depends on).
- Added dev deps beyond PLAN §3.2: `@testing-library/react-native`, `react-test-renderer` (component tests).
- Non-route code lives in `src/` (`src/components`, `src/hooks`, `src/views`, `src/domain`), routes in `app/`
  (expo-router convention: keep non-route code out of the routes dir). PLAN shows them at repo root.
- Dropped the Lottie JSONs (`fireworks.json`, `trophy.json`) with `App/`; Celebration is plain RN.
- Keystore search not run (cloud). See README "Release".

## 2026-10-08 — Session 2 (domain core)
- TS 6 no longer auto-includes `@types/*`; `tsconfig.json` sets `"types": ["jest", "node"]`.
- `loadable()` default `maxTotal` raised 500 → 1000 so the "200 successes" invariant (60 → 560 kg) does not
  saturate at the table edge.
- `warmups()`: the first (empty-bar) set is always kept, even when the work weight is the bar. PLAN §5.3 says
  "drop if equal to the work weight" but §8 Session 5 and the bench 22.5 → `[20×5]` example require a
  surviving bar set. Non-barbell kinds get no warm-ups (a "bar" set is meaningless for dumbbell/machine).
- `rows_instead_of_chins` is defined as "rows on day 1, chin-ups on day 2" rather than a raw swap, because a raw
  swap is not idempotent (PLAN requires idempotent plugins). Plugins also carry a `templates` array so the
  setup UI can filter by template.
- Alternating pairs keep the order in which they were first written (Press then Bench in the base template);
  they are NOT re-sorted, because sorted order would start the base program on Bench. The pair *count* uses a
  sorted key so reversed duplicates are still recognised, and `validateProgram` rejects a reversed pair on a
  different day. `sessionFor` computes the alternation count in O(days) (closed form), not O(n).
- `parseScheme('2xAMRAP')` gives `reps: null, amrap: true`; added `setTargets(scheme)` returning per-set targets
  (`null` = AMRAP; all sets AMRAP for `2xAMRAP`).
- `validateProgram(p, catalog?)` takes an optional catalog for unknown-id checks. `exerciseIdsOf(program)` helper added.
- `isLoadable(kg, inv, unit)` helper added; all lookups tolerate 1e-6 float noise from kg↔lb round trips
  (ceil would otherwise skip 137.5 lb after `135 lb + 2.5`).
- `src/catalog.ts` `builtInExercises()` returns a fresh deep copy of `src/exercises.json`.
- `AppState.needsWeightConfirmSuspects` added in Session 2 (PLAN adds it in Session 3) since projection tests build an AppState.

## 2026-10-08 — Session 3 (store + v1 migration)
- Hydration: `skipHydration: true` plus an exported `initStore()` (rehydrate → import v1 once → `hydrated = true`)
  instead of `onRehydrateStorage`. Reason: the callback cannot be awaited, so the migration could not be tested
  deterministically, and a throw inside it would leave the splash screen up forever. `initStore` catches errors and
  always sets `hydrated`.
- Added `legacyChecked: boolean` to `AppState`. Without it, **Reset** followed by an app restart would re-import the
  untouched `GSLP_STATE_18` blob (program is null again). `reset()` sets it to true; the dev seed uses
  `importLegacy()` which ignores the flag. `GSLP_STATE_18` is only ever read.
- `migrateV1`: `order` of an imported session contains only exercises that kept a result (PLAN said all
  definitions); this lets the UI trust `order`. Barbell lifts used by the migrated program that v1 had no weight
  for (e.g. never-saved press) start at the bar. Returns null when `initialSetupComplete` is not true.
  `migrateV1`'s patch type is `MigrationPatch`.
- `deleteExercise` throws for built-ins, returns the day names when referenced, removes the exercise and its lift
  otherwise. History keeps ids of deleted custom exercises; UI must fall back to the id for the name.
- `setProgram` starting weights: barbell → bar, dumbbell/machine → one rounding step; bodyweight → none.
- `finishSession` leaves bodyweight lifts untouched (outcome `none`) and uses the weight actually lifted.
- `startSession(n)` with a draft for a different `n` replaces the draft (Home only ever starts `nextSession`).
- Store tests simulate "kill and reopen" by snapshotting the persisted payload and rehydrating a blank store.

## 2026-10-08 — Session 4 (shell, home, settings, lift editor, confirm)
- **Unit switch snaps weights.** Weights are stored in kg, but 20 kg is 44.09 lb, not a loadable weight with a
  45 lb bar. `setUnit` therefore moves every lift (`weightKg`, `startKg`) and the draft's weights to the nearest
  weight loadable in the new unit. Round trips are lossless for default and finer inventories (kg → lb → kg
  tested 20×). History is never rewritten. PLAN's "Home shows 45 lb after switching" requires this.
- Headers: root Stack uses an opaque black header (not `headerTransparent`) because expo-router 57 no longer
  re-exports a header-height hook to inset content; the session screens hide the header and draw their own
  overlay back button so they stay immersive.
- `StatusBar` is rendered inside `Background` (a Fragment root layout trips expo-router's layout props).
- Dev seed uses `importLegacy(rawFixture)`; it never writes `GSLP_STATE_18`. `Fast-forward` finishes the current
  session with reps 8. Both are `__DEV__` only (fixture is `require`d lazily inside the handler).
- Deps added beyond PLAN §3.2: `expo-asset`, `expo-font` (runtime peers of `@expo/vector-icons`; jest failed
  without them), `@testing-library/react-native@13` (v14 needs a not-installed `test-renderer`), `react-test-renderer`.
- Component/screen tests: `Stepper.test.tsx` (tap = one step, long-press repeat at 150 ms, stop on release/unmount),
  `src/__tests__/screens.test.tsx` mounts the real route modules in expo-router's in-memory test router.
- Confirm screen snaps migrated weights to the nearest loadable weight before showing them.
- Needs manual check on device (added): header icons and layout on Home, thin-font look, Stepper feel.
