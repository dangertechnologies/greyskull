# UI review fixes and expo-widgets error: plan

## Context

On 2026-10-08 the app ran in Expo Go on the iPhone 17 Pro Max simulator (iOS 26.4). I went through
Today, Plan, Progress, Settings, History, the session screen, Exercises, Progression rules and Gallery
in light mode, and through Settings and the session screen in dark mode. The redesign from
`docs/UI-MODERNIZATION.md` works, but the screens have visible defects. In addition, every app start
in Expo Go logs `ERROR [Error: Cannot find native module 'ExpoWidgets']`, which shows as an error in
the terminal and in LogBox. This plan lists the fixes in priority order, so a later session can do
them one commit at a time.

**First step when executing:** copy this file into the repo as `docs/UI-REVIEW-2026-10.md`. That is
the markdown file to work from later.

## Part A. expo-widgets error (do first, small)

**Symptom.** Each JS start in Expo Go logs `[Error: Cannot find native module 'ExpoWidgets']`. Metro
gives this call stack: `definitions.tsx:3` → `load` (`src/widgets/index.ts:18`) → `syncNextWorkout` →
`run` (`watchStoreForWidgets`) → `initStore` (`src/store.ts:377`).

**Root cause.** `load()` calls `require('./definitions')` inside a `try`. `definitions.tsx` imports
`expo-widgets`, and `expo-widgets/build/ExpoWidgets.ios.js` calls `requireNativeModule('ExpoWidgets')`
at module evaluation. That call throws in Expo Go, because Expo Go has no ExpoWidgets module. The
`try/catch` catches the exception, so nothing crashes. But in dev the throw during module
initialization is still reported, which is why the error "keeps popping up" on every reload. The
same thing would happen on Android and in any build without the widget extension.

**Fix.** In `src/widgets/index.ts` `load()`, check whether the native module exists before requiring
the definitions. Use `requireOptionalNativeModule` from `expo`. It is exported by
`node_modules/expo/build/Expo.d.ts`, and it returns `null` instead of throwing:

```ts
import { requireOptionalNativeModule } from 'expo';
// …
definitions =
  Platform.OS === 'ios' && requireOptionalNativeModule('ExpoWidgets')
    ? (require('./definitions') as Definitions)
    : null;
```

- Keep the existing `try/catch` as a second guard.
- Update the doc comment to say why the check comes first: a module that throws while it loads still
  gets reported in dev.
- `startRestActivity` / `endRestActivity` already route through `load()`, so this one change covers
  every caller.

**Tests.** `src/widgets/widgets.test.ts` "without the native module" must still pass. In Jest,
`requireOptionalNativeModule` returns `null`, or mock `expo` the way `jest.setup.tsx` mocks other
modules. Add one assertion: `syncNextWorkout` does not call `require('./definitions')`. You can spy
on `console.error`, or mock `./definitions` with a factory that throws and expect no throw and no
log.

**Verify.** Run `CI=1 pnpm expo start --go`, then open the app in Expo Go. Metro shows no
`ExpoWidgets` error. `pnpm check` passes. In a dev build (`expo run:ios`) the widget still updates.

## Part B. UI fixes, in priority order

Each item gives what I saw, the cause where I found it, and the fix. Do one commit per item, or one
per small group.

### B1. Double top inset on tab screens (every tab)
- **Seen:** the title of Today, Plan, Progress and Settings starts about 150 pt from the top. About
  60 pt of empty space sits above every heading.
- **Cause:** in `src/ui/layout.tsx` `ScreenScroll`, `contentInsetAdjustmentBehavior="automatic"`
  already insets the content for the safe area on iOS. `paddingTop` adds `insets.top` again when
  `headerless`.
- **Fix:** add `insets.top` only where iOS does not adjust:
  `headerless && Platform.OS !== 'ios' ? insets.top : 0`. Check the Today screen too: its header
  may not use `ScreenScroll`, so grep for `insets.top` in `app/(tabs)/`.

### B2. Hyphens render with spaces ("Bench - press", "Chin - up", "Warm - up")
- **Seen:** in body text everywhere. Titles render correctly ("Bench-press" in the session header).
- **Cause:** `src/design/tokens.ts:104`. The `body` style (and probably other text styles) spreads
  `tabular` (`fontVariant: ['tabular-nums']`). In Inter, `tnum` also gives the hyphen a
  tabular width.
- **Fix:** remove `tabular` from prose styles (`body`, `bodyStrong`, `callout`, `caption` if
  present). Keep it only on number styles (`display`, `numberLarge`). Where a prose style shows
  numbers that must line up (weights in lists), apply `fontVariant` at that call site.

### B3. Weights like "184.99 lb" and "134.99 lb" (History)
- **Cause:** imported v1 weights were converted lb → kg → lb. `trim()` in `src/domain/units.ts`
  keeps 2 decimals, so float error shows through.
- **Fix:** round the display value in `formatWeight` to the smallest real increment: 0.1 is enough
  to remove the drift (`Number(v.toFixed(1))` for lb), or round to the nearest 0.25. Also check
  `src/domain/migrateV1.ts`: if it stores rounded kg from an lb source, store the exact `lb * KG_PER_LB`
  value. Add a unit test: `formatWeight(toKg(185, 'lb'), 'lb') === '185 lb'`.

### B4. Plan screen names do not match Today
- **Seen:** Plan shows "Press / Bench", "Chin" and "Incline row". Today and Progress show
  "Bench-press", "Chin-up" and "Bent-over row". The Progress projection says "Incline row" while
  Today shows Bent-over row.
- **Fix:** in `app/(tabs)/plan.tsx`, show the resolved exercise names with `nameOf` from
  `src/format.ts`, the same as Today. Show the slot label (for example "alternates with Press") only
  as secondary text. Find out why the slot says "Incline row" and the exercise says "Bent-over
  row". If the template default and the user's chosen exercise differ, show the user's choice. If
  it is a data bug, fix it in the domain.

### B5. Monograms are inconsistent ("BEN", "CUR", "CHI", "DEA" next to "BS", "BR")
- **Cause:** `src/domain/monogram.ts` uses the first 3 letters of a single word. It also splits only
  on whitespace, so "Bench-press" counts as one word.
- **Fix:** split on whitespace and hyphens. Use initials of up to 2 words. For a single word, use
  its first letter: "Bench-press" → BP, "Chin-up" → CU, "Curls" → C, "Deadlift" → D. Remove the
  3-letter `letterSpacing` special case in `src/ui/Monogram.tsx`. Update the monogram tests.

### B6. Session screen status bar is unreadable on the photo header (light mode)
- **Seen:** the clock and the signal icons are dark on the dark blurred photo.
- **Fix:** in `app/session/[n].tsx`, render `<StatusBar style="light" />` from `expo-status-bar`
  while the photo header is visible.

### B7. Session screen: set count does not match the set dots
- **Seen:** "0 OF 9 SETS DONE", but the dot row shows 6 (W W W W 5 5+). The warm-up dots are also
  smaller than the work-set dots.
- **Cause:** `src/views/SessionImmersive.tsx:80-81` counts work sets only (warm-ups are excluded),
  and it counts them across the whole workout. The dot row shows the current lift, including its
  warm-ups.
- **Fix:** label the counter so it says what it counts, for example "0 of 9 work sets today", or
  count only the current lift's sets. Make every dot the same size, and mark warm-ups by fill or
  outline, not by size.

### B7b. Minimalist view: warm-ups are a caption, not sets
- **Seen (code):** `src/views/SessionMinimal.tsx:152-154` shows warm-ups as one muted caption line
  (`Warm-up: 20 ×5 · 55 ×4 · …`). Line 156 filters warm-ups out of the pills. So in the minimalist
  view you cannot tick off warm-ups, the caption weights have no unit, and no plates are shown.
- **Fix:** render the warm-ups as a row of smaller, outlined pills before the work-set pills. Each
  pill shows the weight with its unit and the reps ("20 kg ×5"). Tapping a warm-up pill marks it
  done through the hook's existing warm-up path: call `record(index, item.targetReps)` from
  `useSession`, which adds it to `doneWarmups` and starts no rest, the same as the immersive view.
  Do not use `logSet`, which handles work sets only. Keep the warm-ups out of `isComplete`, as now.
  Update `src/__tests__/minimal.test.tsx`: it asserts on the caption text at lines 20-21.
- Before building this, check that `useSession` exposes `record` to the minimalist view (or whatever
  `SessionMinimal` receives). If it does not, pass it through, and do not duplicate the warm-up
  state.

### B8. Progress list is noisy
- **Seen:** "Not enough sessions yet" repeats on all 7 rows. The Projection section is one run-on
  paragraph.
- **Fix:** if no lift has 2 or more sessions, show one empty-state line above the list and drop the
  per-row subtitle. Otherwise show a small trend or last change, for example "+5 lb since last".
  Render the projection as one row per session ("#4 Day 1", then a list of lifts and weights), and
  reuse `ListRow`.

### B9. History lacks a title and repeats "Imported workout"
- **Fix:** add the screen title "History". For imported sessions, use the day name when it is
  known. Otherwise show "Imported" as a small caption, not as the row title. Make skipped sessions
  visually muted (textMuted, no summary).

### B10. Settings controls are too heavy or too weak
- **Plate chips:** six solid accent circles (bright lime in dark mode) dominate the screen. Use a
  tinted fill (accent at about 15 % with accent text) plus a checkmark for "on", and an outline for
  "off".
- **Unit segmented control:** in light mode the selected "lb" is white on white, shown only by a
  thin border. Give the selected segment a filled surface (`surfaceRaised` with a shadow, in the
  iOS style) or the accent tint.
- **Rest time stepper:** it is centered, while everything else on the screen is left-aligned. Use
  the same row layout as the toggles: label on the left, stepper on the right.

### B11. Content behind the floating tab bar and BottomBar
- **Seen:** at rest, Plan shows "Days and exercises" half hidden under the tab bar. On the session
  screen the Technique text shows through the glass "Done" bar.
- **Fix:** scrolling under glass is normal on iOS. The problem is the first view. Make sure the
  tab screens get the tab bar inset (`contentInsetAdjustmentBehavior` handles native tabs; check
  this after B1). On the session screen, use `withBottomBar` on the scroll view so its last content
  clears `BOTTOM_BAR_CLEARANCE`.

### B12. Small items
- The `lift/[id]` empty state ("This exercise no longer exists.") is bare. Give it a title and a
  "Back to exercises" button.
- Exercises list: built-in rows without "in program" (Tricep dips) are shorter than the other rows.
  Give rows a fixed minimum height.
- Check B1 to B11 again in dark mode. The dark session screen and dark Settings looked correct apart
  from B10.

### B13. Grouped lists have no card behind them
- **Seen (owner report):** several screens look like they should have a white card behind the text.
  Instead the grey text sits straight on the grey background.
- **Cause:** the spec (`docs/UI-MODERNIZATION.md` §5.1) gives `surface` to "Cards, grouped lists".
  Only Today's lift list and the Plan name card used `Card`.
- **Fix:** `Section` takes `card`, which puts its children on a `Card` with a hairline between each
  child. Use it for Plan days and edit rows, Progress lifts and projection, Today's coming up and
  recent, Exercises, a lift's stats and history, Settings, and Progression rules. History builds the
  card from its FlatList rows so the list stays virtualised.

## Status (2026-10-08)

All items are done and pushed on `v2`, one commit per item. Notes from doing them:

- **A:** after a cold start in Expo Go, Metro shows no `ExpoWidgets` error. A widget test fails
  without the guard.
- **B3:** `trim` gained a `decimals` argument, which broke `side.map(trim)` in `plates.ts`, because
  `map` passes the index as the second argument. Fixed by writing `side.map((p) => trim(p))`.
- **B4:** the mismatch came from user data, not a bug. The v1 import kept the user's short name
  "Incline row" for an exercise named "Bent-over row". The Plan tab now shows full names.
- **B5:** a catalog `abbr` still wins and can be 3 letters (OHP, ROW, DIP), so the 3-letter spacing
  in `Monogram.tsx` stays.
- **B6:** the light status bar has to depend on focus (`useIsFocused`). Without that, a screen
  pushed over the workout screen inherited a white status bar.
- **B7:** the counter now counts this lift's pills, warm-ups included. All pills are 48 pt, and
  open warm-ups have a dashed outline.
- **B10:** no shadow on the segmented control, because the colour lint test forbids literal
  colours. The track and the selected segment differ by colour instead.
- **B11:** no change needed. Content scrolling under the glass bars is normal iOS behaviour, and
  scroll padding already clears the bars.

## Out of scope
- Redesigning Today. Its layout works, and B1, B2 and B5 fix most of what looks wrong there.
- Charts on Progress beyond a one-line trend. That needs a separate plan; `src/chartMath.ts` exists.

## Critical files
- `src/widgets/index.ts`, `src/widgets/widgets.test.ts` (Part A)
- `src/ui/layout.tsx` (B1, B11), `src/design/tokens.ts` (B2), `src/domain/units.ts` and
  `src/domain/migrateV1.ts` (B3), `app/(tabs)/plan.tsx` (B4), `src/domain/monogram.ts` and
  `src/ui/Monogram.tsx` (B5), `app/session/[n].tsx` and its hooks/components (B6, B7),
  `app/(tabs)/progress.tsx` (B8), `app/history.tsx` (B9), `app/(tabs)/settings.tsx`,
  `src/ui/Chip.tsx` and `src/ui/SegmentedControl.tsx` (B10)

## Verification
1. Run `pnpm check` (Biome, tsc and Jest) after each item.
2. Start Metro with `CI=1 pnpm expo start --go --port 8081` and open
   `xcrun simctl openurl booted "exp://127.0.0.1:8081/--/<route>"` for each route: `/`, `progress`,
   `plan`, `settings`, `history`, `session/1`, `exercises`, `plan/rules`. Take screenshots with
   `xcrun simctl io booted screenshot`. Repeat after `xcrun simctl ui booted appearance dark`, then
   set it back to light.
3. Part A: the Metro log shows no `Cannot find native module 'ExpoWidgets'` after a cold start.
4. Compare the new screenshots with the defects above: titles about 24 pt below the safe area,
   hyphens without spaces, "185 lb", matching names, 2-letter monograms, a light status bar on the
   session screen.
