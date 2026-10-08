# v2 review (October 2026)

A review of the v2 rewrite (Sessions 1–9 plus the follow-up on pnpm, TypeScript 7 and training plans).
It covers what works, what is missing, what I would do differently, and UX/UI improvements, ordered by
how much they matter to someone training with the app. File references are to the `v2` branch.

## Verdict

The core is sound: weights cannot compound any more (progression is a pure function applied once in
`finishSession`), every weight the app proposes is loadable with the user's bar and plates, the GSLP day
order is right, sessions survive a kill, and v1 data migrates without touching `GSLP_STATE_18`. 181 jest
tests cover the domain, the store, the session hook and the main screens.

The weak spots are product gaps rather than bugs. There is no way to undo a mistaken set, no backup
restore, no way to switch plans after setup, and the look has only been checked in jest, not on a phone.
Nothing in v2 has run on a device yet, so the "needs manual check on device" list in `PLAN-NOTES.md` is
the real release gate.

## Fixed during this review

| Problem | Where | Fix |
|---|---|---|
| "Back to home" after a workout, saving the program, confirming migrated weights, the setup summary and Reset all used `router.replace('/')`. That pushed a **second Home on top of the first**, so the back gesture on Home led to another Home. | `app/session/[n].tsx`, `app/setup/*.tsx`, `app/settings.tsx` | `goHome()` (`router.dismissTo('/')`) in `src/navigation.ts`; regression tests in `src/__tests__/navigation.test.tsx`. |
| Saving the program during a workout **silently discarded the logged sets** (`setProgram` drops the draft). | `app/setup/days.tsx` | Asks "Discard the workout in progress?" first. |
| The rest timer started **after every warm-up set** (90 s of rest after an empty-bar set). | `src/hooks/useSession.ts` | Rest only after work sets. |
| Steppers used `accessibilityRole="adjustable"` **without accessibility actions**, so VoiceOver/TalkBack users could not change a value by swiping. | `src/components/Stepper.tsx` | `increment`/`decrement` actions, tested. |
| The lift editor showed the catalog increment even when the plan overrides it (StrongLifts deadlift +5 kg), and editing the kg increment rewrote the lb one by conversion (1.25 kg → 2.75 lb, not a real plate jump). | `app/lift/[id].tsx` | Uses `incrementFor()`; only the unit being edited changes. |
| Unused imports could slip through. | `tsconfig.json` | `noUnusedLocals` / `noUnusedParameters`. |

## Correctness and data risks (open)

1. **No backup restore.** Settings → Export backup shares JSON, but nothing can import it. A new phone or a
   reinstall loses all history. Add *Import backup* (paste or pick a file with `expo-document-picker`),
   validate it against the `AppState` shape, and show a summary before replacing.
2. **Persist schema has no `migrate`.** `persist` is at `version: 2` with no `migrate` function. Fields added
   so far are optional (`rules.progression`, `day.intensity`, `lift.reps`), so old data still loads, but the
   next non-optional field will break hydration. Add `migrate(persisted, version)` now and bump the version
   with every shape change. Test each step with a fixture.
3. **Deep link to another session replaces the draft.** `startSession(n)` with a draft for a different `n`
   overwrites it (`src/store.ts`). Home only opens `nextSession`, but a notification or deep link to
   `/session/7` would silently drop a half-done workout. Refuse and redirect to the draft instead.
4. **Deleting a custom exercise orphans its history.** History keeps the id, so the screen shows
   `custom_front_squat`. Soft-delete instead: add `archived: true`, hide it from pickers, keep the name.
5. **Unit switch rewrites `startKg`.** `setUnit` snaps start weights too, so "Start → now" on the progress
   page shifts slightly after a unit change. Keep `startKg` raw and snap only for display.
6. **Warm-up progress is not persisted.** After a kill, warm-ups for a lift with no logged work set are
   shown again. That is acceptable, but storing completed warm-ups in the draft costs only a few lines.
7. **The rest timer is not persisted.** Killing the app mid-rest loses the countdown. Store `restEndsAt` in
   the draft so it resumes.

## What is missing

- **Undo / edit a set during a workout (immersive view).** A mistaken *Done* can only be fixed by switching
  to the minimal view or editing the session after finishing. Add a *Previous set* control or tap-to-edit
  on a small list of today's sets. This is the biggest gap in the session flow.
- **Switch plan after setup.** Settings only edits days. Users cannot move from Greyskull to StrongLifts
  without Reset. Offer *Change plan*: re-run template → options → days, keep lifts and history.
- **Edit rules after setup.** `doubleAt`, deload %, fails-before-deload and warm-ups can only be set during
  onboarding. Put the Options screen behind Settings → *Progression rules*.
- **Per-exercise bar weight.** Curls and rows use the 20 kg / 45 lb bar. EZ bars (≈10 kg) and trap bars
  differ. Add `barKg/barLb` per exercise (defaulting to the inventory bar) and use it in plate maths.
- **Weighted bodyweight progression.** Chin-ups and dips track reps only. A common GSLP rule is "add weight
  once you get 3×8+". The `double` progression model already covers this if bodyweight lifts may carry an
  added load.
- **Plans the model cannot express yet:** GZCLP (tiers with stage changes 5×3+ → 6×2+ → 10×1+), 5/3/1
  (percentages of a training max, weekly waves) and Texas Method (weekly volume/intensity days). They need
  a percentage-of-training-max model and per-stage scheme changes. `src/config/plans.ts` is the right place
  once the domain supports them.
- **Release plumbing:** no CI (GitHub Actions running `pnpm test` + `pnpm typecheck` + `expo export`), no lint
  (`expo lint`, see the TypeScript 7 caveat below), no crash reporting, no EAS Update channel.

## What I would do differently

- **Home subscribes to the whole store** (`useStore()` in `app/index.tsx` and `app/progress.tsx`). Home stays
  mounted under the session screen, so every logged set re-renders it and recomputes `project(state, 9)`.
  Select only the fields it needs with `useShallow`, and memoise the projection on
  `program, lifts, nextSession, unit, inventory, exercises`.
- **History is an unvirtualised list inside a `ScrollView`.** After a year (≈150 sessions) Home renders all
  of them. Show the last 10 on Home and move the full history to its own `FlatList` screen.
- **Programs are copied into state, plans are referenced by id.** Saving a user's program as a full copy is
  right (they can edit it), but plan fixes (e.g. correcting AllPro) never reach existing users. Store
  `planVersion` next to `template` and offer "Your plan has an update".
- **One progression model per program.** `rules.progression` applies to every slot. Real programs mix:
  AMRAP main lifts with double-progression accessories. Moving `progression` (and `increments`) onto the
  slot, with the program value as default, is a small change in `nextLift` callers.
- **Strings are inline.** Every label is a literal in a component. Even if the app stays English, a
  `strings.ts` makes copy review and later i18n far cheaper.
- **Test fixtures in app code.** The dev *Seed v1* button `require`s a file from `src/domain/__tests__`. Move
  the fixture to `src/dev/` so app code never imports from test folders.

## UX improvements (by priority)

1. **Undo the last set** in both session views (see above).
2. **Default the AMRAP stepper to last time's reps** (or the target) instead of always 5, and show "Last time:
   62.5 × 8" under the target. That is the number lifters care about.
3. **Show what happens next on Finish.** The celebration lists changes; add the next session's weights and
   date ("Wednesday: Bench 62.5 · Deadlift 100").
4. **Skip with undo.** Skipping is one tap plus an alert, and there is no way back. Use a snackbar with *Undo*
   for 5 seconds instead of the alert.
5. **Plate loading helper.** The plates line is text. A small bar diagram (coloured plates on one side) is
   faster to read mid-set and is the feature people screenshot.
6. **Rest timer controls.** +30 s / −30 s during rest, and a per-lift rest override (deadlift 3 min,
   curls 60 s).
7. **Request notification permission at a better moment.** It is asked when the first rest starts,
   mid-workout. Ask on the Settings rest-time row or once, with an explanation, before the first workout.
8. **Onboarding length.** Seven screens before the first workout. Units, template and weights are essential;
   Options and Days could be collapsed into "Customise" links on the summary screen.
9. **History rows.** Migrated v1 sessions show only "#1" (no day name). Fall back to "Imported workout".
   Make rows show date first; that is how people look things up.
10. **Validation copy.** Errors such as `MILITARY_PRESS / BENCH_PRESS must use the same order` show raw ids.
    Use exercise names (`validateProgram` already receives the catalog).

## UI improvements

- **Immersive look is half done.** Only the session screens are full-bleed. Every other screen has an
  opaque black header above the photo. Use a transparent header with a gradient scrim and pad content by
  the header height (expo-router 57 exposes it via its native header options; check the version docs).
- **Typography.** The design relies on weights 200/300. iOS's system font has them; Android maps weights
  through Roboto and the result varies by device. Bundle one typeface with thin weights (e.g. Inter or
  Barlow) through `expo-font` so both platforms match.
- **Contrast.** `colors.dim` (62 % white) on a photo with a 45 % black overlay is borderline on the bright
  backgrounds (squat, empty gym). Raise the overlay to ~55 % for text-heavy screens or the dim colour to
  72 %. Check with a contrast tool on device screenshots.
- **Hierarchy on Home.** The next-session card, Start, Coming up and History have similar weight. Make the
  card plus Start dominate (larger weights, Start as a filled button). Collapse Coming up into one line per
  week with a "See projection" link.
- **Haptics.** Only rest-over vibrates. A light impact on *Done*, circle taps and stepper steps makes the app
  feel responsive in the gym, where people do not look at the screen.
- **Chart.** Min/max labels only, no dates. Add first/last date labels and a dashed line at the current
  working weight. Light-day sessions (AllPro) should be dimmed or excluded from the weight chart.
- **Experimental badge.** New plans are marked *Experimental* in setup but nowhere after. Show it in Settings
  next to the plan name with a "Send feedback" link.

## Accessibility

- Fixed: stepper actions (above).
- Rest ring: the countdown is announced through `accessibilityLiveRegion` only on Android. iOS needs
  `AccessibilityInfo.announceForAccessibility` at intervals (every 30 s and at 10 s).
- Minimal view circles are 44 pt, which is fine, but the long-press is the only way to enter AMRAP reps.
  Add an accessibility action "Edit reps" on each circle.
- Dynamic type: font sizes are fixed. Large weights (56–96 pt) should cap with `maxFontSizeMultiplier`, and
  body text should scale.

## Testing and tooling

- Screen tests run the real routes in expo-router's in-memory router and caught both navigation bugs above.
  The `act()` warnings in some suites come from store updates outside `act`. Harmless, but they hide real
  warnings. Wrap the store setup in `act` or silence them per test file.
- Nothing has been run on a device. Before release, run the flow list in `PLAN-NOTES.md` on one iPhone and
  one Android phone, and install the preview build over v1 to check the migration with real data.
- **pnpm.** Installs use pnpm 10 in its default isolated layout. Expo autolinking only sees direct
  dependencies, which is what we want: optional peers such as reanimated stay out of native builds. If
  Metro or a native module ever fails to resolve a transitive dependency, add `node-linker=hoisted` to
  `.npmrc` rather than adding that package directly.
- **TypeScript 7.** `tsc` is the native compiler (typecheck runs in about 1 s). Metro and jest strip types with
  Babel, so the app does not depend on the compiler. Caveats:
  - The `typescript` 7 package ships no `tsserver.js` and no JS compiler API. Editors must use their own
    TypeScript or the native-preview language server; *Use workspace version* in VS Code will not work.
  - `typescript-eslint` (used by `expo lint`) needs the JS API. Before adding lint, check that the
    typescript-eslint release in use supports TS 7. If it does not, pin a TS 6 copy for ESLint only
    (`typescript6` alias) or wait.

## Training plans: status

| Plan | Status | What still needs checking |
|---|---|---|
| Greyskull LP | stable | — |
| Phrak's GSLP | stable | — |
| StrongLifts 5×5 | experimental | Its own warm-up scheme and the deload-after-3-fails rule are approximated by our generic warm-ups and `failsBeforeDeload: 2`. |
| Starting Strength | experimental | Novice phase A/B only; no power-clean phase, no chin-ups. |
| AllPro's Beginner Routine | experimental | Built from secondary sources (heavy/light/medium at 100/80/90 %, two sets, 8 → 12 reps a week, then add weight). The exercise list (squat, bench, row, press, curls) is my choice. Check against the original write-up before calling it stable. |

The plans are data in `src/config/plans.ts`. Adding one takes a `PlanDefinition` entry. The tests in
`src/config/plans.test.ts` and `src/acceptance.test.ts` validate every plan automatically, including 120
simulated sessions per plan with every weight checked for loadability.

## Suggested next steps

1. Undo last set (immersive + minimal).
2. Import backup + persist `migrate`.
3. Change plan / edit rules from Settings.
4. Transparent headers + bundled typeface; contrast pass.
5. CI workflow (test, typecheck, export) and lint once TS 7 support is confirmed.
6. Device pass over the manual-check list; then the 2.0.0 release steps in the README.
