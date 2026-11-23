# Plan: Expo 58, multi-program, ease-back deload, calisthenics, program builder, exercise library

Execution: superpowers:subagent-driven-development, adapted to the user's CLAUDE.md (parallel waves of
non-overlapping tasks in one checkout, no worktrees). Each `### Task N` below is a self-contained brief:
`scripts/task-brief PLAN N` extracts it for the implementer. Implementers read only their brief, the files it
names, and `src/domain/types.ts` once Task 5 has landed (the code is the contract after that).

## Context

The app (Expo 57, zustand, `master` @ 322f31d, PR #2 merged) runs one barbell-style program at a time. The user wants
the best app for calisthenics *and* common gym programs: several active programs, automatic deload after a long
break, calisthenics programs, an in-app program builder, and a library of several hundred exercises. Expo SDK 58
first (user request).

Decisions made with the user (2026-11-23): lift state **separate per program**; Today shows **one card per active
program**, the user picks; ship **all four** calisthenics programs (Recommended Routine, six ladders, skill track,
hybrid); exercises show **line pictograms + form-video link**, no photos (decided after the senior review found the
candidate photos are not cleared: extend the app's own pictogram set in `src/ui/exerciseIcons.ts`).
Also in scope at the user's request: **Health sync** (Apple Health, Android Health Connect), **program generation**
with on-device models only (no API key, no cost; Siri entry point), **supersets, circuits, EMOM and interval timers**.

On-device and system options (checked 2026-11-23): `expo-ai` (SDK 58, experimental, documented as a private
preview: Apple Foundation Models on iOS 26+, Gemini Nano via ML Kit Prompt API on supported Android phones,
structured output validated against a schema); fallback `@react-native-ai/apple` (iOS only). Siri: `expo-app-intents`
(SDK 58, alpha). Health: `@kingstinct/react-native-healthkit` (Nitro, Expo plugin, dev client) and
`react-native-health-connect` v4 (Expo plugin built in, Android minSdk 26).

Research (sources in the conversation): skill-ladder apps (Thenics, Calistree, Fitloop, Calisthenics Pro) lack barbell
programming; gym loggers (Hevy, Strong) lack holds, band levels, skill progressions and regress/progress swaps;
Boostcamp/Liftosaur have program libraries but are not calisthenics-aware; StrongLifts detects ≥1 week off and suggests
an adjustable deload. Nobody combines GSLP/GZCLP/5-3-1 with calisthenics ladders: that is the position. Detraining:
strength largely kept ~3 weeks (Stronger by Science); no source gives fixed percentages, so the ease-back table is a
tunable default. Exercise data: free-exercise-db (Unlicense, ~870 exercises, 2 photos each).

Codex (gpt-6.1-sol, high) critiqued an earlier draft: 15 findings, all verified against the code and folded into the tasks.
A second, isolated senior review (2026-11-23) found 3 blockers and 9 majors, verified and folded in (v2):
- **Content rights:** free-exercise-db's photos come from wrkout/exercises.json, whose CONTRIBUTING.md says they
  were "scrapped off the internet" and "I do not own the copy right for these images and would advise against using
  them in comercial projects". The text's origin is not stated. Import **facts only** (names, equipment, muscles,
  level); write our own descriptions; no photos: the owner chose our own pictograms (Task 4b).
- **Storage:** the whole state is one AsyncStorage entry (`src/store.ts:416`), and Android caps one entry at ~2 MB and
  the store at 6 MB. A failed hydration starts fresh and then **overwrites** stored data (`src/store.ts:434-437`).
  Owner decision: move persistence to a file (`expo-file-system`, already installed).
- **Session ids:** with several programs, a skip of B while A's draft holds id N reuses N (`store.ts:245,301,334-343`).
  Ids are now reserved when a draft or skip is created and never rewound.
- **Already built:** a rest Live Activity countdown exists (`src/hooks/useSession.ts:178-186`,
  `src/widgets/definitions.tsx:34-42`); timers extend it instead of building a new path.
- **Release:** no store build until every native feature has working UI (HealthKit entitlement without a Health
  feature is App Review risk); earlier PRs ship to dev/preview builds only.

## Global Constraints (every implementer and reviewer gets this block)

- **One checkout, branch `feat/calisthenics`, no worktrees.** Never switch branches, rebase, amend, stash or
  `git add -A`. Commit only your owned paths: `git commit -m "<conventional message>" -- <paths>`.
  Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; plain English nouns only.
- **Own only the files your task lists.** Need a change elsewhere? Stop and report NEEDS_CONTEXT.
- **Other agents edit other files at the same time.** Run scoped checks: `pnpm jest <your test paths>`,
  `pnpm biome check <your paths>`, `pnpm tsc --noEmit` and report only errors in your files. The controller runs the
  full `pnpm check` at each wave gate.
- **Never dispatch subagents or reviewers yourself.** Write the full report to the report file you are given;
  return status, commit SHAs, one-line test summary, concerns.
- **Simulator lane** (screen-changing tasks): use the device and Metro port the dispatch gives you
  (`npx expo start --port <port>`), deep links `exp://127.0.0.1:<port>/--/<route>`. Report what you saw, light and
  dark, and what you could not check.
- **Data safety:** never delete AsyncStorage keys `GSLP_STATE_18` or `gslp-v2`; every migration keeps every log and
  lift state; a failed read never leads to a write over stored data.
- **Session ids:** `nextSession` is reserved (incremented) when a draft or a skip log is created; never rewound by
  finish, discard or Undo. Gaps in ids are fine.
- **Content:** no third-party prose or images in the app unless their licence allows commercial redistribution;
  exercise descriptions and form cues are written in our own words.
- **Weights:** only loadable weights. Barbell = bar + paired plates; dip-belt added load = single plates; kettlebells
  = owned sizes; kg↔lb round trip stays loadable. Never arbitrary numbers.
- **Defect checklist before commit:** loadable weights; kg↔lb; skipped sessions and every Undo path; one draft at a
  time; GSLP/GZCLP/5-3-1 acceptance (`src/acceptance.test.ts`) still green; props passed as explicit `undefined`;
  light and dark theme; contrast worst case; screen-reader labels and hiding; empty, failure and paused states;
  large text; iPad width; Android; Biome clean (single quotes, 110 columns, `noExplicitAny`).
- **Code comments and docs:** plain English, no labels from this plan ("Task 6", "wave 3").
- **Ladder ids, exercise ids and enum values** below are exact; use them verbatim.

## Wave schedule and roles

| Wave | Tasks (parallel inside a wave) | Gate before next wave |
|---|---|---|
| 0 | Task 0 (controller) | branch exists, ledger written |
| 1 | Task 1 Expo 58 + every native dependency · Task 2 catalog import · Task 3 calisthenics data · Task 4 mockups · Task 4b pictograms | rerun `scripts/build-catalog.mjs` with Task 3's data merged; `pnpm check` + iOS/Android dev builds launch |
| 2 | Task 5 state v4 | `pnpm check`, Codex review fixes landed |
| 3 | Task 6 calisthenics + groups domain · Task 7 ease-back · Task 8 multi-program UI · Task 9 library | `pnpm check` |
| 4 | Task 10 session/ladder UI · Task 11 builder · Task 12 programs · Task 13 Health · Task 14 generator | `pnpm check` |
| 5 | Task 15 grouped sets + timers UI · Task 16 Siri | `pnpm check` |
| 6 | Task 17 final review + PRs (controller) | — |

| Task | Implementer (model) | Task reviewer | Lane |
|---|---|---|---|
| 1 | general-purpose, sonnet | general-purpose, sonnet | iOS A + Android, port 8081 |
| 2 | `codex-sol-implementer` (gpt-6.1-sol, medium) | general-purpose, sonnet | — |
| 3 | general-purpose, sonnet | general-purpose, sonnet (content check) | — |
| 4 | general-purpose, sonnet | none (design doc; user sees PNGs) | — |
| 4b | general-purpose, opus | controller looks at the sheets | — |
| 5 | general-purpose, opus | `codex-sol-collaborator` (high) | iOS A, 8081 |
| 6 | `codex-sol-implementer` | `codex-sol-collaborator` | — |
| 7 | general-purpose, sonnet | `codex-sol-collaborator` | — |
| 8 | general-purpose, sonnet | general-purpose, sonnet | iOS A, 8081 |
| 9 | general-purpose, sonnet | general-purpose, sonnet | iOS B, 8082 |
| 10 | general-purpose, opus | general-purpose, sonnet | iOS A, 8081 |
| 11 | general-purpose, sonnet | general-purpose, sonnet | iOS B, 8082 |
| 12 | `codex-sol-implementer` | `codex-sol-collaborator` | — |
| 13 | general-purpose, sonnet | general-purpose, sonnet | iOS A then Android (queued) |
| 14 | general-purpose, opus | `codex-sol-collaborator` | iOS B (queued), Android (queued) |
| 15 | general-purpose, opus | general-purpose, sonnet | iOS A, 8081 |
| 16 | general-purpose, sonnet | general-purpose, sonnet | iOS B, 8082 |

**Simulator lanes:** at most two at once (iOS A = iPhone 17, iOS B = iPhone 17 Pro Max; Android emulator only
when an iOS lane is free) because memory and swap are tight. Tasks without a free lane do their unit work first and
queue for the screen check; the controller hands lanes out in the ledger.
At most one Codex writer at a time (Task 2 in wave 1, Task 6 in wave 3, Task 12 in wave 4).
If Codex reports a usage limit: switch that task to general-purpose sonnet and tell the user once with the reset time.
Fix rounds resume the same implementer. A task's review fixes land before the next owner of its files starts.

## Autonomy (owner instruction 2026-11-23)

Everything is decided up front; **the run never stops to ask the owner**. The controller rules on anything new
(ledger line `Ruling: <decision> — <why> — <cost if wrong>`) and keeps going. Pre-authorised: pushing branches,
opening PRs, merging them to `master` once CI and the final review are green, EAS **preview** builds
(`eas build --profile preview`), publishing the privacy page to `gh-pages`. Not authorised (not needed): production
store builds or submissions, force-pushing `master`, deleting any data or branch other than merged PR branches.

## Pull requests

Commits land on `feat/calisthenics` in wave order. At each wave gate, with every agent idle, the controller runs
`GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash <wave start>` (folds `--fixup` commits) and tags `wave-N` locally,
so every wave boundary is a commit where `pnpm check` passed. PRs are those prefixes, stacked:
- **PR 1** = master..`wave-1`: Expo 58 + native modules, exercise catalog data, calisthenics ladders, mockups, pictograms.
- **PR 2** = `wave-1`..`wave-3`: state v4 + file storage, calisthenics/group domain, ease-back, multi-program screens, library.
- **PR 3** = `wave-3`..`wave-5`: session/ladder screens, builder, programs, Health, generator, timers, Siri.
Each PR body: plain-English summary, screenshots from the simulator checks, test summary, what was not verified.
Merge in order with merge commits (not squash, so the stack stays valid): `gh pr checks --watch`, then
`gh pr merge --merge`; GitHub retargets the next PR to `master`; rerun its checks before merging.

**Release rule (for the owner, not done by the run):** the native fingerprint changes once (PR 1). Make the next
store build from `master` after PR 3 merges, when HealthKit, Health Connect, App Intents and the on-device model all
have working UI. Later fixes ship as OTA to that build. Rollback: `eas update:republish` of the previous update for JS;
the v4 migration writes `state.v3.json` and keeps `gslp-v2`, so a support build can restore.

---

### Task 0: Controller setup (no subagent)

1. `git switch -c feat/calisthenics` from `master` (clean tree except untracked `.env`).
2. Copy this plan to `docs/PLAN-calisthenics.md` (so other sessions find it) and commit it.
3. Ensure `.superpowers/` and `.cache/` are in `.gitignore`; run `scripts/sdd-workspace`, create the ledger, run the
   pre-flight scan (table of shared files/interfaces per the skill) and record rulings.
4. Boot simulator lanes: iPhone 17 and iPhone 17 Pro Max (iOS), one Pixel emulator (Android).
5. Save memory: feedback "owner wants all questions settled before implementation, then a fully autonomous run";
   feedback "check where a dataset's images/text come from before calling them public domain (a repo licence badge
   does not cover scraped assets)"; project pointer to `docs/PLAN-calisthenics.md`.

### Task 1: Upgrade Expo SDK 57 → 58

**Owns:** `package.json`, `pnpm-lock.yaml`, `app.json`, `app.config.ts`, `eas.json`, `tsconfig.json`, `biome.json`,
`app/(tabs)/_layout.tsx`, `jest.setup.tsx`, and type-only fixes in any `app/` or `src/` file that the upgrade breaks
(Tasks 2–4 touch no TypeScript, so no overlap).

SDK 58 (stable 2026-10-15) = React Native 0.88 (0.86 → 0.88 includes 0.87's breaking changes), built for iOS 27.
Guide: https://expo.dev/blog/how-to-upgrade-to-sdk-58, changelog: https://expo.dev/changelog/sdk-58.

Steps:
1. `npx expo install expo@^58.0.0 --fix`, then `npx expo-doctor@latest`; bump `jest-expo` to `~58`. Fix every doctor
   finding. Confirm `react-native-view-shot`, `react-native-svg`, `@expo/ui`, `expo-widgets`, `expo-glass-effect`
   resolve to SDK 58 versions.
2. `app/(tabs)/_layout.tsx:1`: `expo-router/unstable-native-tabs` → `expo-router/native-tabs`. Read the router
   migration guide for removed `expo-router/react-navigation` exports (none found in `app/`, `src/` today).
3. Strict TypeScript API is now the default: fix what `pnpm tsc --noEmit` reports with type-only changes.
4. Node ≥ 22.13 required (local 22.14). EAS needs Xcode ≥ 26.4; check `eas.json` images. R8 is said to be on by
   default for Android release builds: run `eas build --profile preview --platform android` (pre-authorised), install
   the APK on the emulator and run one full session to catch R8 stripping.
5. `runtimeVersion.policy = fingerprint` (`app.config.ts:24`) stays: the new native fingerprint means OTA updates reach
   only new store builds. Note this in the report for the release notes.
6. **Install every native dependency later tasks need, now** (one native rebuild instead of four; later tasks write
   only TypeScript). Use Context7 (`/expo/expo/expo_58.0.22`) and each package's README for setup:
   - `@kingstinct/react-native-healthkit` + `react-native-nitro-modules` with its config plugin: write-only use,
     `NSHealthUpdateUsageDescription` = "Greyskull saves your finished workouts to Apple Health."; no read usage
     string unless the plugin requires one (then: "Greyskull does not read your health data."); background delivery **off**.
   - `react-native-health-connect` (v4, plugin built in) with write permission for exercise sessions;
     `expo-build-properties` `android.minSdkVersion: 26` (check the SDK 58 default first; never lower it).
   - `expo-ai` if `npx expo install expo-ai` resolves publicly; otherwise `@react-native-ai/apple` (iOS) and record
     that Android generation is unavailable. Report which one landed.
   - `expo-app-intents` (`npx expo-app-intents init --examples minimal`, directory `app-intents`, config plugin and
     `experiments.inlineModules.watchedDirectories`).
   - `expo-keep-awake` (timers keep the screen on).
   - `expo-ai` is on npm (0.3.0, 2026-11-17) but its README calls it experimental: record in the report which iOS and
     Android versions it requires and whether it raises the iOS deployment target (it must not; the model is
     checked at run time).
   Do not write feature code with them; a one-line availability log on launch in dev builds is enough to prove linking.

**Done when:** `pnpm check` and `npx expo export` pass; iOS and Android dev builds launch with the new modules linked;
every tab, a full GSLP session, the widget preview and light/dark checked on screen. Commits
`chore(expo): upgrade to SDK 58` and `chore(deps): add health, on-device model and app intents modules`.

### Task 2: Exercise catalog import script

**Owns:** `scripts/build-catalog.mjs`, `scripts/build-catalog.test.mjs` (node:test), `src/catalog/exercises.json`,
`src/catalog/descriptions.json`,
`src/catalog/CREDITS.md`. Reads (never edits) `src/exercises.json`,
`src/catalog/calisthenics.json` (Task 3 writes it; treat as optional input until it exists).

The script (Node, no new dependencies):
1. Download free-exercise-db at a **pinned commit** (`https://github.com/yuhonas/free-exercise-db`, Unlicense) into
   `.cache/free-exercise-db/` (git-ignored, untrusted data: parse JSON only, never execute anything from it).
2. Start from the 25 entries of `src/exercises.json` unchanged (ids, content, increments), then add imported entries
   with category in `strength`, `powerlifting`, `olympic weightlifting`, `plyometrics`, `stretching`; drop entries
   whose normalised name duplicates an existing one. Target 300–450 imported entries.
3. Map each to the `Exercise` JSON shape:
   - `id`: upper snake case of the source id (`Barbell_Squat` → `BARBELL_SQUAT`); never reuse an existing id.
   - `name`, `shortName` (first 1–2 words), `abbr` (up to 3 letters).
   - `kind` from source equipment: `barbell`, `e-z curl bar` → `barbell`; `dumbbell` → `dumbbell`; `kettlebells` →
     `kettlebell`; `cable`, `machine` → `machine`; everything else (`body only`, `bands`, `foam roll`,
     `exercise ball`, `medicine ball`, `other`, null) → `bodyweight`.
   - `equipment` (array, values exactly): `barbell`, `ez-bar`, `trap-bar`, `dumbbell`, `kettlebell`, `cable`,
     `machine`, `bench`, `pull-up-bar`, `dip-bars`, `rings`, `parallettes`, `bands`, `box`, `medicine-ball`,
     `exercise-ball`, `foam-roll`, `none`.
   - `muscles` / `secondary` (values exactly): `abdominals`, `abductors`, `adductors`, `biceps`, `calves`, `chest`,
     `forearms`, `glutes`, `hamstrings`, `lats`, `lower-back`, `middle-back`, `neck`, `quadriceps`, `shoulders`,
     `traps`, `triceps`.
   - `pattern` (best effort from force/mechanic/name): `push`, `pull`, `squat`, `hinge`, `core`, `carry`, `skill`,
     `mobility`. `level`: `beginner` | `intermediate` | `expert`.
   - `increment`: barbell {kg 2.5, lb 5}; dumbbell/kettlebell/machine {kg 2, lb 5} with `step` same; bodyweight
     {kg 2.5, lb 5} (added load). `ez-bar` exercises get `barKg: { kg: 10, lb: 25 }`.
   - **Facts only** from the source (name, equipment, muscles, level, force/mechanic for `pattern`). Do **not** copy
     the source `instructions` text (its origin is unknown). Write `description` (1–2 sentences) and 3 `goodForm`
     cues per entry in our own words into `src/catalog/descriptions.json` keyed by id (bulk writing may be delegated
     to `gemini-flash-implementer` in batches; spot-check 20). No `badForm` for imports.
   - Also set increment {kg 2.5, lb 5} on the existing `CHINUPS` and `DIPS` (currently 0) and add `equipment`,
     `muscles`, `pattern` to all 25 existing entries.
4. Merge `src/catalog/calisthenics.json` entries if the file exists (they win on id clash).
5. **No photos** (owner decision 2026-11-23: the source photos are not cleared). Set `pictogram` on every entry to
   one key from the exact list in Task 4b, chosen by a name/pattern rule table in the script (e.g. name contains
   "squat" and kind barbell → `squat`; "curl" → `curl`; unmatched → `generic`). Print how many entries fell back to
   `generic`; under 15 % is the target.
6. Output sorted by id, 2-space JSON. `CREDITS.md`: source, commit, licence, and that only facts were imported.

**Tests** (`node --test scripts/build-catalog.test.mjs`, on a 5-entry fixture): mapping of each equipment value,
id collision handling, duplicate-name drop, existing 25 entries preserved byte-for-byte except the added fields and
the CHINUPS/DIPS increment, budget failure path.

**Done when:** script runs from a clean `.cache`, prints count and MB, tests pass. Does **not** switch the app to the
new catalog (Task 9 does).

### Task 3: Calisthenics exercises and progression ladders (data)

**Owns:** `src/catalog/calisthenics.json`, `src/catalog/ladders.json`, `src/catalog/ladders.md` (human-readable index).

Exercise entries use the same JSON shape as Task 2 (`kind: "bodyweight"`, `equipment`, `muscles`, `pattern`,
`level`, `increment {kg 2.5, lb 5}`, `description`, `goodForm`, `badForm`, `video` = a YouTube form video URL you
verified loads, `timed: true` for holds, `pictogram` = one key from the exact list in Task 4b). Ids upper snake
case, prefixed `CAL_` (e.g. `CAL_PULLUP_NEGATIVE`). Descriptions and cues in your own words.

Ladder shape: `{ "id", "name", "pattern", "after"?: "weighted", "steps": [{ "exercise": "<id>", "scheme"?: "<scheme>", "band"?: true }] }`.
Schemes: `3x5-8` reps range, `3x10-30s` hold range, `3x30s` fixed hold, fixed `NxM`. A step without `scheme` uses
the program slot's scheme.

Required ladders (ids exact; steps ordered easiest first; source the order from the r/bodyweightfitness wiki and
Recommended Routine, Steven Low's progression charts, and the classic ten-step "big six" progressions; write all
descriptions in your own words; no book or brand names):
- Recommended Routine: `rr_pullup` (scapular pulls → arch hangs → pull-up negatives → band-assisted pull-up
  (`band: true`) → pull-up → L-sit pull-up…, `after: weighted`), `rr_squat` (assisted squat → squat → split squat →
  Bulgarian split squat → beginner/intermediate/advanced shrimp squat), `rr_dip` (support hold `3x10-30s` → negative
  dips → dips, `after: weighted`), `rr_hinge` (bodyweight Romanian deadlift → single-leg deadlift → banded Nordic
  curl negatives → Nordic curls), `rr_row` (vertical rows → incline rows → horizontal rows → wide rows → archer rows),
  `rr_pushup` (wall → incline → full → diamond → pseudo-planche push-up, `after: weighted`), `rr_antiextension`
  (plank `3x10-30s` → ring ab rollouts → ab wheel), `rr_antirotation` (banded Pallof press), `rr_extension`
  (reverse hyperextension).
- Six ladders, 10 steps each with a per-step `scheme`: `six_pushup`, `six_squat`, `six_pullup`, `six_legraise`,
  `six_bridge`, `six_hspu`.
- Skills, hold-time ladders unless noted: `skill_handstand` (wall plank → chest-to-wall → heel pulls → freestanding),
  `skill_lsit` (foot-supported → one-leg → tuck → L-sit), `skill_front_lever` (tuck → advanced tuck → one-leg →
  straddle → full), `skill_planche` (lean → tuck → advanced tuck → straddle), `skill_muscleup` (reps: high pull-up →
  chest-to-bar → band-assisted muscle-up → muscle-up).

Reuse one exercise id across ladders when it is the same movement (e.g. pull-up). Reuse existing `CHINUPS`/`DIPS`
where they match. `ladders.md` lists each ladder with step names, schemes and sources.

**Check** (`node -e` one-liner in the report, no test file): every step exercise id exists in `calisthenics.json` or
`src/exercises.json`; every scheme matches `^\d+x(\d+|\d+-\d+)s?$`; no ladder repeats an exercise.

### Task 4: Mockups of every new screen

**Owns:** `docs/mockups/**`. Reads `src/design/*`, `src/ui/*`, `app/(tabs)/index.tsx`, `src/views/*` for tokens and
current look (match them: same type scale, colours, spacing, glass tab bar).

Deliver one self-contained HTML file per screen in `docs/mockups/src/`, rendered to PNG at 390×844 @3x in light and
dark by `docs/mockups/render.sh` (headless Google Chrome `--screenshot`, no new dependencies), PNGs in
`docs/mockups/exports/`, and `docs/mockups/README.md` indexing each PNG (what it shows, which state).

Screens and states: Today with an open draft + two program cards (GSLP, Skill Track) + one paused; Today empty;
Programs list; Program detail; Add program picker with categories (Strength, Hypertrophy, Calisthenics, Skills,
Mobility) and equipment-fit badge; Session with a timed hold (stopwatch running), a ladder exercise with
"easier / harder", added load, band label, and the ease-back banner ("23 days since you last trained · weights eased
back 10% · Undo"); Ladder screen (done / current / next steps with unlock rule); Lift chart for a ladder (level axis,
step names); Exercise library with search and filter chips (pictogram per row); Exercise detail with a large
pictogram, muscles, video link;
Builder day editor with progression picker and a superset group; Gym equipment checklist with bands and kettlebells;
"Finish or discard the current workout?" dialog; Session with a superset (A1/A2 alternating, rest after the pair);
EMOM timer running (minute 4 of 10, current exercise, next up); interval timer (work/rest countdown); Health settings
(toggle, "Export past workouts"); Generate program: questions (goal, days, session length, equipment, experience),
"Describe it" text box with on-device model, result preview, unavailable state; Siri shortcut tile in settings;
storage recovery screen ("Your data could not be read": retry, export raw file, restore backup).

**Done when:** `render.sh` regenerates all PNGs; README lists every file. Commit `docs(mockups): …`.

### Task 4b: Exercise pictograms

**Owns:** new `src/ui/pictograms.ts` (+ test), `scripts/render-pictograms.mjs`, `docs/pictograms/**` (rendered
sheet PNGs light + dark, README). Reads `src/ui/exerciseIcons.ts` for the format and style; does not edit it.

Extend the app's own line-pictogram style (`Pictogram` in `src/ui/exerciseIcons.ts`: 32 × 32 grid, one stroked path,
filled head dots, outlined plate rings, side view). Export `PICTOGRAMS: Record<PictogramKey, Pictogram>` with exactly
these keys (Task 2 and Task 3 map exercises to them in parallel, so the list is fixed):
`squat`, `front-squat`, `goblet-squat`, `lunge`, `split-squat`, `pistol`, `shrimp-squat`, `step-up`, `deadlift`,
`rdl`, `hip-thrust`, `nordic`, `kb-swing`, `bench`, `incline-press`, `overhead-press`, `push-up`, `pike-push-up`,
`handstand-push-up`, `dip`, `row`, `inverted-row`, `pull-up`, `chin-up`, `muscle-up`, `lat-pulldown`, `curl`,
`triceps-extension`, `lateral-raise`, `face-pull`, `shrug`, `calf-raise`, `leg-extension`, `leg-curl`, `plank`,
`hollow-hold`, `l-sit`, `leg-raise`, `ab-wheel`, `bridge`, `back-extension`, `handstand`, `front-lever`,
`back-lever`, `planche`, `support-hold`, `dead-hang`, `carry`, `stretch`, `cardio`, `generic`.

- Same stroke weight, proportions and head size as the existing nine; equipment drawn only where it identifies the
  movement (bar, rings, dumbbell, kettlebell, band).
- `scripts/render-pictograms.mjs` renders every key to one contact sheet per theme (no new dependencies: write SVG,
  rasterize with headless Google Chrome `--screenshot`, as Task 4 does) into `docs/pictograms/`, with the existing
  nine alongside for comparison.
- Test: every key present, every path parses (only M/L/H/V/C/Q/Z commands), all coordinates inside 0–32.
- Self-check by looking at the sheets at 24 px and 64 px: each movement recognisable, no two keys confusable;
  report which ones you are least sure of.

### Task 5: State v4 — several programs, separate lift state, one draft

**Owns:** `src/domain/types.ts`, `src/store.ts`, new `src/storage.ts` (+ test), new `src/domain/exerciseFields.ts`,
`src/backup.ts`, `src/domain/migrateV1.ts`, `src/domain/program.ts` (only `sessionFor` signature/rotation,
`liftKeysOf`), `src/domain/plates.ts` (only a `kettlebell` case that rounds like `dumbbell`, so the exhaustive
switch at `plates.ts:141-168` keeps compiling), `src/domain/projection.ts`, `src/format.ts`,
`src/hooks/useSession.ts`, `src/widgets/summary.ts`, and **mechanical** edits (selectors only, no redesign) in:
`app/(tabs)/{index,plan,progress,settings}.tsx`, `app/exercises/index.tsx`, `app/lift/[id].tsx`,
`app/plan/rules.tsx`, `app/session/[n].tsx`, `app/setup/{confirm,days,review}.tsx`; tests for all of these
(`src/store.test.ts`, `src/backup.test.ts`, `src/plans.store.test.ts`, `src/widgets/*.test.ts*`, new
`src/migrate.test.ts`, fixtures in `src/__fixtures__/`).

Today: single `program`, global `lifts` and `nextSession`, one `draft` (`types.ts:120-139`); `sessionFor` rotates by
`n - startN` (`program.ts:116`); `finishSession` re-resolves slots and matches by exercise id (`store.ts:283-290`);
`startSession` replaces another draft (`:219-252`); `skipSession` clears the draft (`:343`); `undoSkip` works on the
global last log (`:346-355`); `importLegacy` applies the v1 patch directly (`:404-408`); `migratePersisted` only fills
defaults (`:115-132`); `parseBackup` needs `version === 2` (`backup.ts:57`).

**Types to add (all of them, including ones later tasks implement):**
- `Kind` += `'kettlebell'`. `Equipment`, `Muscle`, `Pattern` string unions with the exact values in Task 2.
- `Exercise` += `equipment?: Equipment[]; muscles?: Muscle[]; secondary?: Muscle[]; pattern?: Pattern;
  level?: 'beginner' | 'intermediate' | 'expert'; timed?: boolean; barKg?: { kg: number; lb: number }; pictogram?: string`
  (key into the pictogram set; the old `icon` field stays legacy and unused).
- `Scheme` += `` `${number}x${number}s` `` | `` `${number}x${number}-${number}s` ``. `ProgressionModel` += `'ladder'`.
- `Slot` += `ladder?: string`. `Ladder { id; name; pattern: Pattern; after?: 'weighted'; steps: { exercise: string; scheme?: Scheme; band?: boolean }[] }`.
- `LiftState` += `step?: number; bandId?: string`.
- `ExerciseResult` += `timed?: true` (set `reps` hold seconds); `step?: number; scheme?: Scheme; band?: { id: string; label: string }`.
- `ResolvedSlot` = the element type of `ResolvedSession['slots']` (move it to `types.ts`) += `ladder?: string; step?: number`.
- Groups: `GroupKind = 'superset' | 'circuit' | 'emom' | 'interval'`;
  `Group { id: string; kind: GroupKind; rounds?: number; restS?: number; workS?: number; minutes?: number }`;
  `Day.groups?: Group[]`; `Slot.group?: string` (id of a group in the same day); `ResolvedSession.groups?: Group[]`.
- `ActiveProgram extends Program { id: string; name: string; position: number; lifts: Record<string, LiftState>; paused?: boolean }`.
- `CustomPlan { id: string; name: string; summary?: string; program: Program }`.
- `SessionLog` += `programId?: string; programName?: string; position?: number; slots?: ResolvedSlot[];
  eased?: { gapDays: number; lifts: Record<string, LiftState> }`.
- `PlateInventory` += `kettlebellsKg: number[]; kettlebellsLb: number[]` (defaults `[8,12,16,20,24,28,32]`,
  `[18,26,35,44,53,62,70]`).
- `AppState`: `version: 3`; remove `program`, `lifts`; add `programs: ActiveProgram[]`, `customPlans: CustomPlan[]`,
  `equipment: Equipment[]` (default `[]` = unknown, show everything), `bands: { id: string; label: string }[]`
  (heaviest first, default `[]`), `breakDeload: boolean` (default `true`), `healthSync: boolean` (default `false`).
  `SessionLog` += `healthId?: string`. Keep `nextSession` as the global,
  monotonic session log id (routes `session/[n]` keep working); keep one `draft`.

**Store API (exact):** `addProgram(input: Program & { name: string }): string` (new id
`${template}-${Date.now().toString(36)}`, `position: 0`, starting lift states as `setProgram` does today);
`updateProgram(id, program: Program)` (same template keeps `position` and lifts; validates); `removeProgram(id)`
(discards the draft if it belongs to it); `pauseProgram(id, paused)`; `renameProgram(id, name)`;
`updateRules(id, rules)`; `setSessionsPerWeek(id, days)`; `setLift(programId, key, patch)`;
`setLiftStep(programId, key, step)`; `startSession(programId): SessionLog` (returns the existing draft when it
belongs to this program; **throws** `Error('Another workout is in progress')` when it belongs to another);
`discardDraft()`; `saveCustomPlan(plan: CustomPlan)` (validates, upserts by id); `deleteCustomPlan(id)`;
`setEquipment(list)`; `setBands(list)`; `setBreakDeload(on)`; `setHealthSync(on)`; `setHealthId(n, id)`;
`finishSession(): Record<string, Outcome>`; `skipSession(programId)` (never touches the draft
unless it belongs to that program); `undoSkip(programId)` (only when the last log of `sessions` is that program's
skip; restores `restore` lifts, decrements that program's `position`, rewinds `nextSession`).
`setLift` and `setDraftWeight` accept `0` for bodyweight exercises (unweighted).

**Behaviour:**
- `sessionFor(program: ActiveProgram, lifts = program.lifts)` rotates by `program.position` (drop `startN` use;
  keep the field optional for old data). Every `n - startN` computation (week labels in `format.ts`, alternating
  pairs, 5/3/1 week) uses `position`.
- **Storage moves to a file** (owner decision). `src/storage.ts`: a zustand `StateStorage` over `expo-file-system`
  (`File`/`Paths` API): `Paths.document/state.json`; write = write `state.json.tmp` then move over `state.json`
  (atomic on one volume); writes debounced 500 ms and flushed on `AppState` → `background`; one write in flight at a
  time. Read order on launch: `state.json` → else AsyncStorage `gslp-v2` (copy it to the file, keep the key) → else
  fresh. **Hydration failure** (unreadable or unparsable file): never fall back to writing defaults
  (`store.ts:434-437` does today). Set `storageError`, block every write, show a recovery screen (retry, export the
  raw file via the share sheet, restore a backup). Before the v3→v4 migration runs, copy the raw v3 data to
  `state.v3.json` once.
- **Ids:** `startSession` and `skipSession` reserve `n = nextSession++` (see Global Constraints); `finishSession` no
  longer sets `nextSession`; `undoSkip` restores lifts and position but leaves `nextSession` alone.
- `startSession` stores the resolved slots in `draft.slots` and `programId`, `programName`, `position` on the draft;
  results keep `lift` when it differs from the exercise id. `finishSession` drops `slots` from the stored log
  (results already carry `lift`, `step`, `scheme`) to keep history small.
- **Program identity everywhere:** `app/session/[n].tsx` and `useSession` resolve the program from
  `draft.programId` (or the log's `programId`), never "the first program"; lift routes take `?program=<id>`.
  `setUnit` snaps lifts of **every** program; `deleteExercise` checks every program and every custom plan.
- **Bodyweight and ladder lifts start at 0 kg** (today `setProgram` skips them, `store.ts:192-196`, and a missing
  lift falls back to the bar weight, `store.ts:227`). `parseBackup` accepts `weightKg === 0` (`backup.ts:65-72`).
- **User fields of built-in exercises:** one exported constant `USER_FIELDS` in `src/domain/exerciseFields.ts`
  (`name`, `shortName`, `abbr`, `kind`, `increment`, `step`, `barKg`, `equipment`, `muscles`, `secondary`, `timed`)
  used by persistence, hydration, backup and (Task 9) the editor and `refreshCatalog`.
- `finishSession` iterates `draft.slots` (never re-resolves), applies `nextLift` to the owning program's lifts,
  advances only that program's `position`, sets `nextSession = draft.n + 1`. Leave a clearly marked spot where the
  ease-back base will plug in (`const base = lifts[key]`), nothing more.
- `projection.project(state, programId, count)`; widgets show the draft, else the first unpaused program.
- **Exercises stay one in-memory map** (`exercises` = built-ins + custom; readers unchanged). Persistence only:
  zustand `partialize` writes custom exercises plus built-ins whose user fields (`name`, `shortName`, `kind`,
  `increment`, `step`, `barKg`) differ from the shipped entry; on rehydrate, `refreshCatalog(stored)` (`src/catalog.ts`)
  re-adds the bundled ones. Do not edit `catalog.ts` (Task 9 owns it).
- **Migration** `STORE_VERSION = 4`, `migratePersisted` v3→v4: `program` → `programs[0]` with
  `id`, `name` = the plan's name from `src/config/plans.ts` (or "Custom program"), `position = nextSession - (startN ?? 0)`,
  `lifts` = the old global lifts. Old logs keep `programId` undefined (users could switch plans before; history shows
  "Earlier program"). An open draft gets `programId` of `programs[0]` and `slots` resolved now. `program: null` →
  `programs: []`. Never touch `GSLP_STATE_18`.
- `importLegacy` and `parseBackup` (accept `version` 2 and 3) go through the same conversion with the full
  `exercises` map.
- Screens: replace `s.program`/`s.lifts` with a `useProgram(id?)` hook (no id → first unpaused program) so every
  screen works with one program exactly as today. Redesign is Task 8's.

**Tests:** fixtures (store v3 snapshots) for every built-in plan, mid-5/3/1 week 2, GZCLP T1 stage 2, an open draft,
archived custom exercise, `program: null`; assert logs untouched, lift states moved, `sessionFor` gives the same next
day and weights as before. v2 backup and v1 legacy import land in v4. Persisted blob excludes unedited built-ins and
keeps an edited built-in's increment and equipment after two cold restarts. Two programs: independent positions and
lifts; start B with A's draft open throws; skip B keeps A's draft; undo skip only at the global tail; remove program
discards its draft. Id interleavings (start A, skip B, skip C, finish A, undo C) never duplicate an `n`.
Storage: AsyncStorage → file copy; corrupt file → no write happens and `storageError` is set; tmp-then-move leaves
the old file intact when the write throws; a 5,000-session history round-trips. Existing suites green.

### Task 6: Calisthenics and grouped-set domain — ladders, timed sets, weighted bodyweight, kettlebells, groups

**Owns:** `src/domain/progression.ts`, `src/domain/program.ts` (except `sessionFor` rotation already done),
`src/domain/plates.ts`, new `src/domain/ladders.ts`, `src/series.ts`, `src/chartMath.ts`, and their tests
(`src/domain/__tests__/*`, `src/series.test.ts`). Reads `src/catalog/ladders.json` (Task 3).

- `ladders.ts`: `getLadder(id): Ladder | undefined`, `LADDERS` from `src/catalog/ladders.json`.
- `SCHEME_PATTERN` + `tryParseScheme` accept `3x30s`, `3x10-30s`; `ParsedScheme` += `timed: boolean`.
- `sessionFor` for a slot with `ladder`: lift key = ladder id; step = clamp(`lifts[key].step ?? 0`); exercise =
  `steps[step].exercise`; scheme = `steps[step].scheme ?? slot.scheme`; progression `'ladder'`; `ResolvedSlot.step` set.
- `validateProgram`: ladder exists; a ladder slot's `exercise` equals `steps[0].exercise`; no two ladders in one day
  share any step exercise; timed schemes valid.
- `nextLift` `'ladder'` (context gains `ladder`, `step`, `bands: {id,label}[]`): every set ≥ target → target + 1 rep,
  or + `HOLD_STEP_S = 5` seconds when timed, capped at the range top; at the top: banded step with a lighter band
  left → `bandId` = next band, target to bottom; otherwise `step + 1`, target to bottom, `bandId` cleared (entering
  a banded step sets `bandId` to `bands[0]?.id`); top of the last step with `after: 'weighted'` → added load +
  increment, target to bottom. Miss: `fails` / `failsBeforeDeload` as today; deload drops the target to the bottom,
  **never the step**. Fixed-scheme steps (e.g. `3x30s`) advance on meeting every set.
- Bodyweight no longer returns `'none'` (`progression.ts:56`): under `linear`/`double`/`amrap` it progresses reps,
  then added load. `sessionWeightKg` returns the added load for bodyweight (0 = none).
- `plates.ts`: kettlebell rounds to the nearest owned size (`kettlebellsKg`/`Lb`); `exercise.barKg` overrides the
  inventory bar; `roundAddedLoad(kg, inv, unit)` for bodyweight = multiples of the smallest single plate.
- `series.ts`: `resultFor(log, key)` also finds results whose `lift === key` (ladder ids are not exercise ids).
  Ladder series value = `step + min(1, (best − min) / (max − min))` from the result's recorded `scheme`; point label
  carries the step's exercise name and reps/seconds. Timed results format as seconds.

- **Groups** (new `src/domain/groups.ts`): `sessionFor` copies the day's `groups`; `validateProgram` checks group ids
  exist, a group's slots are consecutive and ≥ 2 (superset/circuit) or ≥ 1 (emom/interval), circuit/interval slots
  have `rounds` sets, emom `minutes` divisible by its slot count, `restS`/`workS` 0–600.
  `setOrder(session: ResolvedSession, sets: Record<string, number>): { exercise: string; set: number; group?: string;
  restAfterS?: number; atS?: number }[]` = the order the session view walks: ungrouped slots set by set; superset A1
  set i, A2 set i, rest `restS` after each round; circuit one set of each slot per round; emom minute k does slot
  k mod n, `atS = 60k`; interval work `workS` then rest `restS` per round. Progression stays per slot (unchanged).
  Set counts come from the scheme and must agree with the group: circuit/interval slot sets = `rounds`; emom slot
  sets = `minutes / slotCount`. The validator rejects mismatches, so no set index is ever silently dropped.
- `parseProgram(input: unknown): { ok: true; program: Program } | { ok: false; error: string }` in `program.ts`:
  structural checks on untrusted JSON (shapes, types, sizes: ≤ 14 days, ≤ 20 slots a day) before `validateProgram`
  (which dereferences `days` directly, `program.ts:166-178`). Used by plan import (Task 11) and the generator (Task 14).

**Tests:** table tests for each rule above, incl. band → lighter band → next step, last step → added load,
timed +5 s capped, miss never drops a step, kettlebell rounding kg and lb, EZ bar 10 kg, resultFor on ladder keys,
series values across a step change, every `setOrder` kind and each group validation error. Acceptance suite green.

### Task 7: Ease-back deload after a training gap

**Owns:** new `src/domain/breakDeload.ts` + `src/domain/__tests__/breakDeload.test.ts`; in `src/store.ts` only
`startSession`, `finishSession` and a new `undoEase()` action (+ its type in the `Store` interface); store tests for these.

- `lastTrained(sessions, key): string | null` (ISO date): newest log that is not skipped and has a result for the key
  with at least one set `reps > 0`; light days count. Key match: ladder id → results with `lift === key`; otherwise
  results whose exercise id equals `exerciseOfLift(key)` (so GSLP bench and GZCLP bench T2 share recency).
  Searches **all programs**' logs.
- `gapDays = floor((now − last) / 86_400_000)`; no previous log → no easing.
- `easeBack(lift, gapDays, ctx): LiftState | null` with table (exact):

| Gap (days) | Weighted lifts (incl. added load) | 5/3/1 training max | Ladder / rep range |
|---|---|---|---|
| < 14 | none | none | none |
| 14–27 | −10% | −10% | target to bottom |
| 28–55 | −20% | −20% | target to bottom, step − 1 (min 0) |
| ≥ 56 | −30% | −30% | target to bottom, step − 1 (min 0) |

  Weights `roundForExercise(…, 'floor')`; GZCLP stage unchanged; `fails` reset to 0.
- `startSession` (when `breakDeload` is on): ease each slot's lift; put eased states in `draft.eased`; build the
  draft's weights/targets/steps from them. Stored lift state stays untouched.
- `finishSession`: `base = draft.eased?.lifts[key] ?? lifts[key]`; when eased, store `outcome.change === 'none' ? base
  : outcome.next` (a lowered 5/3/1 training max or light-day ease must not rebound).
- `undoEase()`: only while every draft set has `reps === 0`; rebuilds the draft from stored lifts without easing.
  Discarding the draft discards the easing.

**Tests:** boundaries 13/14/27/28/55/56; 5/3/1 eased TM persists after a week-1 finish; light day counts as trained;
all-zero session does not; gap across two programs; ladder step − 1 and never below 0; undoEase refused after a
logged set; finishing an eased GSLP session progresses from the eased weight.

### Task 8: Multi-program screens

**Owns:** `app/(tabs)/index.tsx`, `app/(tabs)/plan.tsx`, `app/(tabs)/progress.tsx`, `app/plan/**`,
`app/setup/{plan,review,confirm}.tsx`, `app/history.tsx`, new `app/program/[id].tsx`, their screen tests in
`src/__tests__/`. Mockups: `docs/mockups/exports/` (Today, Programs, Program detail, Add program, Finish-or-discard).

- **Today:** draft card on top; one card per unpaused program (name, next day, exercise preview, Start / Skip /
  Undo skip); paused programs collapsed; empty state → "Add a program". Start while another program's draft is open →
  "Finish or discard the current workout?" (Resume / Discard / Cancel).
- **Programs tab** (`plan.tsx`): list of programs → `app/program/[id].tsx` (today's plan screen scoped to the id:
  days, rules, sessions a week, rename, pause/resume, remove with confirmation).
- **Add program:** `setup/plan.tsx?add=1` with categories Strength, Hypertrophy, Calisthenics, Skills, Mobility
  (category comes from a `category` field Task 12 adds to plans; until then derive from plan id) and an
  equipment-fit badge (all exercises' `equipment` ⊆ `state.equipment`, or unknown when `equipment` is empty);
  a "My programs" group listing `state.customPlans`; `review.tsx` calls `addProgram`.
- **Progress:** grouped by program; **History:** program name per log ("Earlier program" when missing).
- Look at every changed screen on the simulator (light, dark, large text, iPad) and compare with the mockups.

### Task 9: Exercise library and equipment

**Owns:** `src/catalog.ts`, `src/exercises.json` (delete after switching), `app/exercises/**`, `app/setup/gym.tsx`,
`app/(tabs)/settings.tsx`, `src/ui/ExerciseBadge.tsx`, `src/ui/exerciseIcons.ts`, credits screen, their tests.

- `refreshCatalog` and the editor use `USER_FIELDS` from `src/domain/exerciseFields.ts` (Task 5) as the one list
  of fields a user may change on a built-in; everything else comes from the bundle.
- `catalog.ts` imports `src/catalog/exercises.json` (Task 2); `CATALOG_VERSION` + 1; `refreshCatalog` also gives
  bodyweight built-ins stored with increment `{0,0}` the shipped increment; content fields add `equipment`,
  `muscles`, `secondary`, `pattern`, `level`, `timed`, `pictogram`.
- Library: search, filter chips (equipment, muscle, pattern, timed), `FlatList`; detail with a large pictogram,
  muscles, description, form-video link. `ExerciseBadge` resolves: custom monogram → `EXERCISE_ICONS[id]` →
  `PICTOGRAMS[exercise.pictogram]` (Task 4b) → today's pictogram for the kind.
- Editor: equipment, muscles, timed, `barKg`; bodyweight increment editable (added load) instead of forced 0
  (`app/exercises/[id].tsx:79`).
- Gym setup + settings: equipment checklist (`setEquipment`), bands (`setBands`; add/rename/reorder/delete, ids
  stable), kettlebell sizes (`setInventory`), "Ease back after a break" toggle (`setBreakDeload`). Credits: free-exercise-db (Unlicense).
- Simulator check with the mockups; list performance with ~450 rows.

### Task 10: Session, ladder and chart screens for calisthenics

**Owns:** `src/views/**`, `src/hooks/useSession.ts`, `app/session/**` (incl. `edit/[n].tsx`), new
`app/ladder/[id].tsx`, `app/lift/[id].tsx`, `src/components/Stepper.tsx`, `src/restAlert.ts`, their tests.

- Session views: timed sets show a hold stopwatch (tap start/stop, haptic at target, logs seconds into `reps`);
  ladder exercise shows step name with "Easier / Harder" (`setLiftStep`, the draft's slot and result update in
  place); added load ("+10 kg") or band label; ease-back banner with Undo (hidden once a set is logged, `undoEase`).
- Past-session editor: seconds for timed results, added load for bodyweight (`edit/[n].tsx:57,90`).
- Ladder screen: steps top-down, done / current / next, unlock rule ("3×8 to move on", "3×30 s"), tap a step to set it
  (confirm).
- Lift screen `?program=<id>`: ladder chart (level axis, step names), timed units, toggle "this program / all".
- Simulator: full Recommended Routine-style session with hold, regress, progress, ease-back after moving the device
  date +30 days, edit a past timed session; light/dark, large text, Android.

### Task 11: Program builder and sharing

**Owns:** new `app/builder/**`, `app/setup/days.tsx`, `src/domain/programEdit.ts`, their tests.

- Builder reuses the day editor and scheme sheet; adds per-slot progression (`amrap`, `linear`, `double`, `ladder`),
  ladder picker (from `LADDERS`), timed mode in `schemeParts`/`buildScheme` (`3x30s`, `3x10-30s`), exercise picker =
  library with filters. Group editing: select consecutive slots → "Superset", "Circuit", "EMOM", "Interval" with
  rounds / rest / work / minutes; ungroup. Entry points: Programs tab "New program", "Duplicate & edit" on any
  built-in plan; route `app/builder/[id].tsx` edits the custom plan with that id (Task 14 opens generated plans here).
- Saves with the store's `saveCustomPlan` / `deleteCustomPlan` (they exist; `store.ts` is not yours); started
  through `addProgram`. (The Add program picker's "My programs" group is Task 8's; do not edit `app/setup/plan.tsx`.)
- Share: export `{ format: 'greyskull-plan', version: 1, plan: CustomPlan, exercises: Exercise[] }` (the custom
  exercises the plan uses) via the share sheet / clipboard; import runs `parseProgram`, adds missing custom exercises
  (new id on a clash, references rewritten), then `validateProgram` with clear errors.
- Simulator: build a 3-day plan with a ladder and a timed slot, start it next to GSLP, share and re-import it.

### Task 12: Built-in calisthenics programs

**Owns:** `src/config/plans.ts`, `src/config/plans.test.ts`, `src/acceptance.test.ts`, plan background-photo credits
for new plans (existing plan backgrounds and their credits are unchanged; any new background needs a commercial licence).

- Add `category: 'strength' | 'hypertrophy' | 'calisthenics' | 'skills' | 'mobility'` to every plan.
- **Recommended Routine** (3×/week, one day): supersets (`restS: 90`) `rr_pullup`+`rr_squat`, `rr_dip`+`rr_hinge`,
  `rr_row`+`rr_pushup` at `3x5-8` (holds per ladder step); core circuit (`rounds: 3`, `restS: 60`)
  `rr_antiextension`, `rr_antirotation`, `rr_extension` at `3x8-12`.
- **Six Ladders** (our name): 3 rotating days: push-up + leg raise; pull-up + squat; handstand push-up + bridge;
  per-step schemes from the ladder.
- **Skill Track** (3×/week, meant to run beside another program): day A `skill_handstand`, `skill_front_lever`,
  `skill_lsit`; day B `skill_handstand`, `skill_planche`, `skill_muscleup`; holds `3x10-30s` unless the step says
  otherwise, muscle-up steps `3x3-5`.
- **Hybrid**: day A barbell squat + `rr_pullup` + `rr_dip` + `rr_antiextension`; day B deadlift + `rr_row` +
  `rr_pushup` + `rr_antiextension`; barbell lifts GSLP-style `2x5+` AMRAP, ladders `3x5-8` (weighted after the top step).
- Descriptions in our own words; credit sources (r/bodyweightfitness) in the description.
- Acceptance: 120 simulated sessions per new plan (ladders advance, never skip a step, loads loadable) and two plans
  active together (independent positions, separate lifts, gap across programs).

### Task 13: Health sync (Apple Health, Android Health Connect)

**Owns:** new `src/health/**` (+ tests with the native modules mocked), `app/(tabs)/settings.tsx` (Health section),
`app/settings/health.tsx`, `store/site/**` privacy page, `store/copy.md` privacy notes. Native modules are already
installed by Task 1; use Context7 / the package READMEs for their APIs. Never edit `store.ts`: use its actions.

- Opt-in only (`setHealthSync`); turning it on asks for **write** permission for workouts only (no reads).
- `src/health/sync.ts` subscribes to the store (`useStore.subscribe`): when a non-skipped log with `finishedAt` and no
  `healthId` appears and sync is on, write one workout: iOS `traditionalStrengthTraining` (programs with category
  `calisthenics`/`skills` → `functionalStrengthTraining`), Android exercise session `STRENGTH_TRAINING` /
  `CALISTHENICS`; start/end from the log; title `<program name> · <day name>`; then `setHealthId(n, id)`.
  **Idempotent by design:** a stable record id `greyskull-<startedAt>-<n>` goes to HealthKit as
  `HKMetadataKeySyncIdentifier` (+ `HKMetadataKeySyncVersion`) and to Health Connect as `clientRecordId`
  (+ `clientRecordVersion`), so a crash between the native write and `setHealthId`, or a second attempt, replaces
  instead of duplicating. Writes are serialized (one queue). Editing a past session bumps the version and rewrites.
  Health Connect: one `ExerciseSegment` per exercise with its repetitions when the type exists for it.
  Failures never block finishing a workout: queue, retry on next launch with backoff, surface "Last sync failed" in
  settings; permission revoked → stop and show the state.
- "Export past workouts": writes every finished log (same ids, so repeats are harmless).
- Settings screen: status, permission state with a link to the system settings when denied, export button.
- Privacy page and store notes: workouts are written to Health on the device; nothing leaves the device; no reads.
  Publish the page the way it is published today (read `store/README.md` / `store/site/` for the gh-pages flow;
  pre-authorised) and check the live URL serves the new text.
- Simulator: iOS Health app shows the workout; Android emulator with Health Connect shows the session; deny path.

### Task 14: Program generator — questions, plus on-device model when available

**Owns:** new `app/generate/**`, `src/generate/**` (+ tests), Add program picker entry ("Generate a program") in
`app/setup/plan.tsx` (Task 8 is done by then). Uses `saveCustomPlan`, opens `app/builder/[id]` (Task 11, same wave:
navigate by route only).

- **Questions (always available, deterministic):** goal (strength, muscle, calisthenics skills, general fitness,
  mobility), days a week 1–7, session length (30/45/60/90 min), equipment (prefilled from `state.equipment`),
  experience (new, 6+ months, 2+ years). `recommend(answers)` (reads plan `category`, which Task 12 adds in the
  same wave; read it through one helper that falls back to a plan-id table) → ranked built-in plans plus an optional add-on
  (e.g. GSLP + Skill Track) with a one-line reason each; pure, table-tested.
- **"Describe it" (only when the on-device model is available):** `expo-ai` structured generation (or the fallback
  Task 1 installed) on iOS 26+ with Apple Intelligence / Android with Gemini Nano. Prompt carries the answers, the
  user's text, and a **short** allowed list (≤ 80 exercise ids and all ladder ids, filtered by equipment and goal;
  the on-device context window is small). Output schema = `CustomPlan` restricted to allowed ids, schemes from the
  scheme list, progression models, groups. Then `validateProgram` + catalog check; on failure one retry with the
  errors, then show them. Success → `saveCustomPlan` → builder for review; never auto-starts.
- No network, no API key, no account. States, each with its own UI: unsupported device or OS; model not enabled
  (Apple Intelligence off); model downloading; ready; generating (cancel button); timed out (30 s); refused by the
  model; invalid output after one retry (show errors); app backgrounded (Android aborts: offer retry). Input text
  capped at 500 characters. Output goes through `parseProgram` (Task 6) before `validateProgram`.
- Tests: `recommend` table; prompt builder stays under the token budget (character proxy); schema→plan mapping;
  validation failure path (model mocked).
- Simulator/device: iOS 26+ simulator on a Mac with Apple Intelligence if available; otherwise report as unverified.

### Task 15: Grouped sets and workout timers in the session

**Owns:** `src/views/**`, `src/hooks/useSession.ts`, `src/restAlert.ts`, new `src/timers/**` (+ tests). (Task 10 owned
these in wave 4 and is finished.)

- Session view walks `setOrder` (Task 6): superset cards show A1/A2 together and move focus between them; rest timer
  starts after each round with the group's `restS`; circuit shows round x of n.
- EMOM screen: big minute countdown, current exercise and target, next up; haptic + sound at each minute; a set is
  logged per minute (tap to confirm reps, default = target). Interval screen: work/rest countdown with rounds.
- **Extend what exists:** the rest timer already drives a Live Activity countdown (`src/hooks/useSession.ts:178-186`,
  `restLayout` in `src/widgets/definitions.tsx:34-42`, `timerInterval` text) and rest notifications (`restAlert.ts`).
  Add EMOM/interval layouts to that Live Activity (current exercise, minute x of n, countdown to the next boundary).
- Timing state persisted as anchors (`startedAt`, pause intervals) on the draft, so a relaunch or suspension
  recomputes the position; never count ticks. Boundaries also scheduled as local notifications (cancel on
  pause/finish); notifications denied → in-app only, said once. `expo-keep-awake` while a timer screen is open.
- Pause/resume, skip a set, end early. Unlogged sets stay in the result with `reps: 0` and count as missed (today's
  behaviour); an exercise marked "skipped" in the session gets no progression change.
- Simulator: Recommended Routine superset session, a 10-minute EMOM, a Tabata-style interval; backgrounding mid-EMOM.

### Task 16: Siri and Shortcuts (iOS)

**Owns:** `app-intents/**` (directory created by Task 1), `src/intents/**` (+ tests), settings row "Siri & Shortcuts"
in `app/(tabs)/settings.tsx` (Task 13 is done by then).

Using `expo-app-intents` (alpha; follow its SDK 58 skill/README):
- "What's my next workout?" → spoken/dialog answer: program, day, exercises with weights (same text as the widget,
  `src/widgets/summary.ts`).
- "Start my workout" (optional program parameter, entity = active programs) → opens the app on that session
  (`startSession`; if another workout is open, open it instead and say so).
- "Make me a program" (text parameter) → opens `app/generate` with the text prefilled (generation itself runs in the
  app, in the foreground).
- App Shortcuts phrases with the app name; Spotlight indexing of programs only.
- Android: none in this task (record as a later option: app shortcuts / Gemini app actions).
- Test on the iOS simulator through the Shortcuts app; Siri voice is device-only: report as unverified if no device.

### Task 17: Final review and pull requests (controller)

- Full `pnpm check` and `npx expo export`; whole-branch review with `codex:adversarial-review`
  (`--model gpt-6.1-sol --base master`), verify each finding, one fix wave.
- Simulator pass of the whole flow on iOS and Android, light and dark, compared with `docs/mockups/exports/`.
- Update `store/copy.md` feature list draft and a checklist of App Store privacy answers to change (Health write);
  no store submission.
- EAS preview builds (iOS + Android) of the final tip; install and smoke-test (launch, one session, Health write).
- Push, open PR 1–3, merge in order as described under "Pull requests". Final message to the owner: what shipped,
  what was not verified (Siri voice, on-device model on real hardware), and the release rule.

## Out of scope (each its own decision later)

Apple Watch app, reading from Health (body weight, heart rate), own video library, cloud AI models, Android voice
actions, combos/flows, RPE/RIR, tracked warm-ups, conflict warnings between programs.

## Verification (end to end)

- `pnpm check` green at every wave gate; CI (`.github/workflows/ci.yml`) also runs `expo export`.
- Migration fixtures: logs, lift states, next day and weights unchanged after v3→v4; v1 legacy and v2 backup imports.
- Domain tables for ease-back and ladders as listed in Tasks 6 and 7; acceptance for every plan and two plans at once.
- Catalog: count, `generic` pictogram share < 15 %, every plan slot and ladder step exercise exists, no source instruction text
  copied (script asserts no description equals a source instruction).
- Storage: kill the app mid-write (simulator) → previous state loads; corrupt `state.json` → recovery screen, no data
  overwritten; upgrade from a v3 AsyncStorage install → file created, `gslp-v2` kept, `state.v3.json` written.
- Health: workout appears in Apple Health / Health Connect once per finished session, also after a kill between write
  and `setHealthId`; export is idempotent; denied
  permission never blocks finishing. Generator: questions path on every device; model path on a supported device or
  marked unverified. Siri: intents run from the Shortcuts app. Timers: superset, circuit, EMOM, interval incl. background.
- Simulator (iOS + Android, light + dark): add a second program, train both, skip/undo, device date +30 days → banner
  and Undo, timed hold, ladder up/down, edit a past timed session, build + share + import a program, library filters,
  each compared with `docs/mockups/exports/`.
