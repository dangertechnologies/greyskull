# PLAN-NOTES

Decisions, deviations and manual-check items, appended per Session.

## Needs manual check on device
- Session 4: look and feel of Home/Settings/Lift editor/Confirm; header icons tappable; Stepper long-press feel on a real finger
- Session 4: splash screen hides once the store is hydrated (no 2 s delay); no flash of the Setup stub on launch with saved data
- Session 5: immersive session look; rest ring; haptic at rest end; rest-over notification while backgrounded (permission prompt, delivery); kill app mid-session then reopen → Resume at same set; back arrow keeps sets
- Session 6: onboarding flow end to end; exercise picker modal and search; renaming a day with the keyboard open
- Session 7: custom exercise editor with keyboard; icon grid; delete alert wording
- Session 8: minimal view tap/long-press feel; rest bar; same result as immersive on a real workout
- Session 9: charts (kg and lb) and paging; edit past session layout

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

## 2026-10-08 — Session 5 (session engine + immersive view)
- `useSession(n)` returns `null` until the draft exists (and after `finish()`); it guards against re-creating a
  draft after finishing (`finished` flag). The route owns the celebration summary, so the hook can drop the draft.
- A set counts as *logged* when `reps > 0` (that is how the persisted draft marks it); AMRAP stepper minimum is 1.
- Warm-ups are not persisted. On resume they count as done when any set of that lift, or of any *later* lift, is
  logged; otherwise the lift's warm-ups are shown again. Documented trade-off.
- Rest timer: one 250 ms interval while resting (`restEndsAt` timestamp, robust to JS throttling), cleared on
  unmount; haptic success at 0. Last item of the session never starts a rest; `restSeconds = 0` disables it.
- Celebration lines: `outcomeLine()` in `src/format.ts` — `↑` up, `↑↑` double, `↓ (deload)`, `(N fail[s])` for a
  repeated weight. Bodyweight and unchanged lifts produce no line.
- Back arrow on the session screen is an overlay (header hidden); it pops, or replaces with Home when there is no history.
- Rest-over notification (optional step) implemented with `expo-notifications` (added to app.json plugins):
  scheduled on `AppState → background` for the remaining rest, cancelled on return. Permission is requested when
  the first rest starts. Everything is wrapped in try/catch and returns null when unavailable.
  **Untested on device.**
- Test env quirk: store-driven re-renders inside a bare `act()` are not flushed in `renderHook`; use `await act(async …)`.
- Needs manual check on device: warm-up/set flow feel, AMRAP stepper, rest ring animation + haptic, background
  notification, real kill-and-resume.

## 2026-10-08 — Session 6 (setup flow + program editor)
- Onboarding state lives in `SetupProvider` (`src/setup/SetupContext.tsx`, mounted by `app/setup/_layout.tsx`).
  It stores template + plugins + options and *derives* `program` with `buildProgram()` (new, `programEdit.ts`),
  because a plugin switch cannot be un-applied from an already-edited program. Consequence: going back to Options
  and changing something rebuilds the program and discards manual day edits. Accepted.
- `programEdit.ts` holds the pure editing operations used by the days screen (add/remove/move slot, alternating
  pair, scheme cycling, add/remove/rename day) with tests. A pair already present in the program keeps its written
  order (see Session 2 note); a new pair uses pick order.
- Days editor: scheme chip cycles through all six schemes on tap; "Add alternating pair" is a separate button
  (pick first, then "Alternate with…"). Edit mode (`?edit=1`) edits a local copy of the stored program and calls
  `setProgram` (which keeps lifts/history and drops the in-progress draft).
- `WeightStepper` and `PlatesLine` accept optional `unit`/`inventory` overrides so Setup can preview with the draft gym.
  Changing unit or plates on the Units screen clears chosen starting weights.
- Summary applies: `setUnit` → `setInventory` → `setProgram` → `setLift` per non-bodyweight exercise.
- Setup screens use opaque headers except Welcome/Confirm; Welcome uses the empty-gym photo.
- `expo-notifications` is now imported lazily (it logs a warning on import in Expo Go/Android).
- `src/testRoutes.ts` mounts the real route modules for screen tests (kept out of `__tests__` so jest does not treat it as a suite).
- Needs manual check on device: whole onboarding flow look, picker modal, keyboard behaviour while renaming a day,
  ▲▼ tap targets.

## 2026-10-08 — Session 7 (custom exercises)
- `/exercises/new` is handled by `app/exercises/[id].tsx` with `id === 'new'` (custom ids are `custom_…` so no clash).
- Ids: `customId()` (`src/exerciseId.ts`) slugifies the name and appends `_2`, `_3`… on collision.
- Built-ins are editable (name, increment, description, form tips, icon, link) but their *type* is locked and
  they cannot be deleted. Dumbbell/machine exercises also expose a rounding-step stepper (kg and lb).
- Deleting a custom exercise that a program day uses shows an Alert naming the days; otherwise it removes the
  exercise and its lift. History keeps the id and shows it as such (`nameOf` falls back to the id).
- `goBackOr()` in `src/navigation.ts`: pops, or replaces with a fallback route when a screen was opened directly.
- Needs manual check on device: editor form with the keyboard (multiline fields), icon grid, delete Alert.

## 2026-10-08 — Session 8 (minimal session view)
- `SessionMinimal` shares `useSession` with the immersive view, so progression cannot diverge; a test plays the
  same reps in both modes from the same starting state and compares lifts and the logged session.
- Circle behaviour: tap empty → logs the target (AMRAP circles show `5+` and log 5) and starts the rest; tap a
  logged circle → reps − 1 (0 turns it back to empty, no rest); long-press (400 ms) → reps stepper modal (min 1,
  no rest). Warm-ups are one collapsed line, weights in the user's unit without the unit suffix.
- Rest bar at the bottom: `Rest m:ss` + Skip; Finish workout appears when every work set is logged.
- Needs manual check on device: circle sizes/tap feel, long-press timing, scroll with many exercises, safe areas.

## 2026-10-08 — Session 9 (progress, projection, edit past session)
- Chart is plain `react-native-svg` (Polyline + Circles, min/max y labels), maths in `src/chartMath.ts` (tested);
  `src/series.ts` builds the per-lift series (weights in the display unit; last-set reps for bodyweight; skipped
  sessions ignored). No charting library added.
- History is stored in kg, so after switching to lb the chart labels show converted raw values (e.g. 44.09 lb),
  while current/start weights are snapped to lb plates. Accepted: history is a record of what was lifted.
- The progress pager has one page per exercise in the current program plus a final "Projection" page
  (`project(state, 9)`, bodyweight lifts omitted); each page scrolls.
- Edit past session: weight (loadable stepper) and per-set reps; Save calls `editSession`, which never touches `lifts`.
- Global acceptance (§9) additions: `src/acceptance.test.ts` runs 150 mixed-result sessions in kg, kg+0.5 plate, lb
  and lb+1.25 plate, asserting after every finish that all lift weights and all projected weights are loadable, the
  plates line sums back to the weight, weights never exceed a linear bound (no compounding), and 20× kg↔lb toggling
  leaves weights unchanged.
- Cleanup: store selector helpers (`useUnit`, `useInventory`, `useLift`) are now actually used.
- Needs manual check on device: chart rendering/legibility, horizontal paging feel, edit-session screen layout.

## 2026-10-08 — Session 10 (docs only) and push status
- README has run/test/build/release/migration/keystore sections; no EAS command was run, `android.package` unchanged.
- **Push blocked.** Every `git push` (to `v2` and to the session branch `claude/greyskull-expo-sdk57-zs2tcm`) failed
  with HTTP 403: the Claude GitHub App is not installed/authorised for write access to
  `dangertechnologies/greyskull` in this environment (read through the GitHub MCP works). All work is committed
  locally on `v2` (10 commits after 2ba6d3e). Run `git push -u origin v2` once access is fixed.
- Final state: 138 jest tests in 21 suites, `tsc --noEmit` clean, `npx expo export --platform ios` succeeds.

## 2026-10-08 — Follow-up: review, pnpm, TypeScript 7, training plans
- Review written to `docs/REVIEW.md` (gaps, risks, UX/UI, accessibility, tooling, plan status). Bugs found and
  fixed in the same pass: duplicate Home after `router.replace('/')` (now `goHome()` = `router.dismissTo('/')`),
  silent draft loss when saving the program mid-workout, rest timer after warm-ups, stepper screen-reader
  actions, plan increments in the lift editor. Each has a test.
- **pnpm 10** (isolated layout, `packageManager` pinned). Removed `.npmrc`/`package-lock.json`. Chose isolated
  over `node-linker=hoisted` because Metro, jest-expo and `expo export` all work, and autolinking then only
  sees direct dependencies (pnpm auto-installs optional peers like reanimated, which must not be linked).
  Added `@types/node` (no longer hoisted). Dev-only peer warnings remain for `react-server-dom-webpack`
  (wants React ≥ 19.2.8; Expo 57 pins 19.2.3). jest `testTimeout` raised to 20 s for cold screen suites.
- **TypeScript 7.0.2** (native `tsc`): drop-in for `expo/tsconfig.base`; typecheck ≈ 1 s. Expo CLI only checks that
  `typescript/package.json` exists. Caveats (no tsserver/JS API, typescript-eslint) are in the review.
- **Plans config** `src/config/plans.ts`: Greyskull LP, Phrak's GSLP (stable), StrongLifts 5×5, Starting Strength,
  AllPro's Beginner Routine (experimental). Domain additions: `Scheme` is a template-literal type (fixed,
  `+` AMRAP, `xAMRAP`, `min-max` range) with `tryParseScheme`; `rules.progression` (`amrap` default for old saves,
  `linear`, `double`); `rules.increments` per exercise; `day.intensity` (light/medium days scale and re-round the
  weight and never progress); `lift.reps` holds the double-progression target. `PLUGINS` no longer list
  templates; each plan lists the extras it offers. `Program.template` is now a plan id string.
- AllPro: the web sources found agree on 3 days/week with light at 80 % and medium at 90 % of heavy, and reps
  rising weekly 8 → 12 before adding weight. I modelled reps advancing only after the heavy day (once a week),
  two work sets, exercises squat/bench/row/press/curls. The original write-up was not reachable from the sandbox;
  marked experimental with "Approximation" in its description.
- Needs manual check on device (added): plan picker with experimental badges; AllPro light-day weights on Home and
  in the session; StrongLifts 5×5 session length in both views.
- Push access works again: `v2` is on origin (all commits from Session 1 on).
