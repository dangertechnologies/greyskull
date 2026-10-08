# UI modernization plan

The v2 rewrite replaced the engine and the screens' structure but kept v1's look: a blurred photo behind
every screen, thin white text, 1 px outlined rectangles, circular outlined +/− buttons, and an opaque black
navigation bar. That was a 2018 style. This plan replaces it with a design that feels native on iOS 26 and
Android 16, works in daylight, and is fast to use with sweaty hands in a gym.

Nothing here has been checked on a device yet. Phase 0 exists so the design is judged on a phone, not in jest.

## 1. What is wrong with the current UI

| Area | Today | Problem |
|---|---|---|
| Theme | Dark only, one hard-coded palette in `src/theme.ts` (26 lines), colours inline in 26 `StyleSheet`s | No light mode, no semantic colours (success/warning/danger by role), no system dynamic colour on Android. Changing the look means editing every screen. |
| Type | System font at weights 200/300 | Thin weights vanish on photos and in sunlight; Android renders them inconsistently; no dynamic type. |
| Background | Pre-blurred JPG under every screen plus a flat 45 % overlay | Heavy decoration on screens where users read numbers; low contrast on bright photos; bakes blur into the asset instead of using the platform's. |
| Navigation | Stack only; Home has two header icons to reach Progress and Settings | No tab bar, so the three things people do (train, look at progress, change the plan) are not one tap away. Opaque black header over a photo. |
| Controls | Outlined rectangles and circles, 48 px steppers, `Modal` dialogs | Look like a prototype; small targets for gym use; modals are not the platform sheet. |
| Icons | `@expo/vector-icons` Ionicons + 23 bitmap PNGs tinted white | Not native (no SF Symbols / Material), bitmaps blur at 3×, no weight/size matching to text. |
| Motion | None except the rest ring | No transitions between sets, no feedback on logging a set, no haptics on normal taps. |
| Density | Every list is a flat column of text rows | Home mixes five equal-weight sections; nothing says "this is the thing to do now". |
| Charts | Hand-drawn polyline, min/max labels | No scrubbing, no dates, no PR highlight. |

## 2. Design direction

**"Gym-floor clarity."** Big numbers, one primary action per screen, strong contrast, native chrome. Photography
stays, but only where it carries mood (Welcome, Celebration, the exercise header in a session), never
behind data.

Principles:
1. **The next action is always the biggest thing on screen.** Start, Done, Finish.
2. **Numbers first.** Weights and reps use a tabular, heavy-enough weight (Medium/Semibold), never Thin.
3. **Reachable with one thumb.** Primary actions live in the bottom 40 % of the screen.
4. **Native where it exists.** Tab bar, sheets, toolbars, glass and symbols come from the platform.
5. **Light and dark.** Follows the system; dark is not special.
6. **Motion confirms, never decorates.** Every animation answers a tap or a change of state; all respect
   Reduce Motion.

## 3. Design system (foundation, build first)

All visual decisions move into `src/design/` so screens contain no literal colours, sizes or fonts.

### Tokens
- **Colour roles** (not colours): `background`, `surface`, `surfaceRaised`, `border`, `text`, `textMuted`,
  `accent`, `onAccent`, `success`, `warning`, `danger`, `chartLine`, `chartFill`. Two palettes (light, dark),
  chosen by `useColorScheme()`. Accent: a single saturated colour (proposal: electric lime on dark `#C6F432`,
  deep green on light `#1F7A3A`) plus iOS/Android system tint where controls are native.
- **Android dynamic colour:** read the Material You scheme through `expo-router`'s `Color` API
  (`expo-router/build/color` exists in SDK 57) and use it for `accent`/`surface` on Android 12+, falling back
  to the palette above.
- **Spacing:** 4-pt scale `4 8 12 16 24 32 48`. **Radii:** `8 12 20 999`. **Elevation:** hairline borders on
  light, tonal surfaces on dark; no drop shadows except sheets.
- **Type scale** (all with `fontVariant: ['tabular-nums']` for numbers): `display` 56/Semibold (current
  weight), `title` 28/Semibold, `headline` 20/Semibold, `body` 17/Regular, `callout` 15/Regular,
  `caption` 13/Medium, `label` 12/Semibold uppercase. Bundle one family with a real weight axis (Inter
  Variable or Geist) via `expo-font` config plugin so iOS and Android match; cap with
  `maxFontSizeMultiplier` on display sizes only.
- **Haptics map:** `selection` on stepper ticks and chip toggles, `light` on logging a set, `success` on
  finish and rest end, `warning` on destructive confirms. One helper, one setting to turn off.

### Primitives (replace `Button`, `Screen`, `Background`, `Stepper`, `GymSettings` chips)
`Text` (variant prop), `Surface`/`Card`, `Button` (filled, tonal, plain, destructive; 52 pt tall, full-width by
default), `IconButton`, `Chip`/`SegmentedControl` (native where available), `ListRow`, `Section`,
`Sheet`, `NumberStepper`, `Switch` row. Each ships with a story page in a dev-only `/gallery` route that
renders light + dark + large-text variants, which doubles as the manual QA surface.

### Icons
Use `expo-symbols` (SF Symbols on iOS, Material Symbols on Android/web fallback) for UI icons. Replace the
23 PNG exercise icons with simple monochrome SVGs (single set, drawn once, `currentColor`) rendered by
`react-native-svg`, which is already installed. Keep the old PNG keys as aliases so custom exercises keep
working.

## 4. Information architecture

Native tab bar (`NativeTabs` from `expo-router`, available in SDK 57; liquid glass on iOS 26 for free):

| Tab | Content | Replaces |
|---|---|---|
| **Today** | Next session card, Start/Resume, week strip, upcoming | Home |
| **Progress** | Lift pager → master list with sparkline per lift, tap for detail; PRs; projection | `/progress` |
| **Plan** | Days, exercises, rules, plan switcher, custom exercises | Settings → Edit program, Exercises |
| **Settings** | Gym (bar/plates/unit), rest, appearance, backup, about | Settings |

Sessions, lift editor, setup and history are pushed or presented over the tabs. Modals become real sheets:
`presentation: 'formSheet'` with detents for the weight picker, rep editor, exercise picker and rest
controls; `Alert` stays for destructive confirms only.

## 5. Screen redesigns

**Today.** One hero card: day name and week, the lifts as large rows (name, weight in `display`, plates as a
tiny plate diagram, scheme chip), and a full-width **Start** pinned above the tab bar. A seven-day strip shows
done/skipped/next. Below, "Coming up" collapses to the next two sessions; history moves to Progress. Skip
becomes a swipe action with an undo snackbar.

**Session (immersive).** Keep one exercise per screen, but with a clear structure: a compact photo header
(real photo, native blur at 80 % scrim, parallax on scroll) with name and "Set 2 of 3"; a large weight with a
**plate diagram** (coloured discs per side) as the tap target for the weight sheet; a segmented **set rail**
(dots/pills for every set, tappable to revisit and edit, which is the undo the current UI lacks); the rep
control as a wheel or big ± with haptic ticks; **Done** as a 64 pt bottom button. "Last time: 62.5 × 8" under
the target. Rest becomes a bottom sheet with a linear countdown, ±30 s and Skip, so the rail stays visible.
Back is a native header button with a "Leave workout?" sheet instead of silently leaving.

**Session (minimal).** Set circles become rounded pills on `surface` rows; sticky progress header; rest bar
shares the new rest sheet; large long-press target with a visible "hold to edit" hint on first use.

**Progress.** Master list: each lift as a row with name, current weight, trend arrow and a 60-point
sparkline. Detail: area chart with scrub-to-read tooltip, PR markers, range chips (3M/6M/1Y/All), est. 1RM,
volume. Build on the existing `scaleSeries` maths with `react-native-svg` plus gesture handling; evaluate
Skia (`@shopify/react-native-skia`) only if scrubbing is janky on mid-range Android.

**Setup.** Cut from seven screens to three: (1) *Your gym* (unit, bar, plates with live loading preview);
(2) *Pick a plan* (cards with imagery, difficulty/frequency chips, Experimental badge, expanding detail);
(3) *Review* (week 1 with weights; "Customise" links open Plan editing sheets; options and starting weights
live there). Each step shows progress and has Back.

**Plan editor.** Reorderable days (drag handle via `react-native-reanimated` + gesture handler, replacing ▲▼),
swipe to delete, add via sheet; scheme picker as a segmented sheet (sets × reps, AMRAP, range) instead of a
cycling chip.

**Celebration.** Replace the plain text list with a summary card (lifts that went up, PR badges, volume,
duration) and a short confetti burst (reanimated, off with Reduce Motion), plus a share-as-image action.

## 6. Motion and feedback

- Reanimated 4 layout animations for list changes (add/remove slot, set rail advance, card expand).
- Shared transition from the Today card to the session header (expo-router shared elements where supported;
  otherwise a fade/scale).
- Set logging: pill fills with a spring, number ticks, `light` haptic. Weight change: number rolls.
- Reduce Motion: replace springs with opacity fades; confetti off.
- Performance budget: 60 fps on a mid-range Android (Pixel 6a class) during a set log; no JS-thread timers in
  render paths (rest countdown stays a single interval).

## 7. Accessibility (required, not optional)

Dynamic type to 200 % without clipping (wrap, never truncate numbers), minimum 48 pt targets, 4.5:1 contrast
for text and 3:1 for UI on both palettes (checked in the gallery), semantic roles/labels on every control
(extend the existing `Stepper` actions to `NumberStepper`), screen-reader announcement of rest end,
"Edit reps" action on set pills, no information by colour alone (plates also named in text, PRs also
labelled), Reduce Motion and Reduce Transparency respected (glass falls back to a solid surface).

## 8. Platform extras (after the core redesign)

iOS: Live Activity/Dynamic Island for the rest timer, Home Screen widget "Next workout", Apple Watch later.
Android: foreground-service rest notification with actions, Glance widget. Both need a development build and
native config, so they ship as separate, independently shippable tasks.

## 9. Dependencies

Add: `expo-symbols`, `expo-glass-effect`, `expo-blur`, `expo-image`, `react-native-reanimated` (+ worklets,
already resolved by Expo), `react-native-gesture-handler`, an Expo font package for the chosen family,
`@gorhom/bottom-sheet` only if `formSheet` detents prove insufficient. Remove: `@expo/vector-icons`, the
pre-blurred background JPGs (keep originals, add them as full-size photos through `expo-image` with
blurhash placeholders). Liquid glass and native tabs need a **development build**; Expo Go is fine for
everything else, and the design must degrade to opaque surfaces on older OS versions.

## 10. Phases

| Phase | Deliverable | Done when |
|---|---|---|
| **0. Device baseline** (1–2 days) | Run the current app on one iPhone and one Pixel, capture screenshots of every screen, list the manual-check items from `PLAN-NOTES.md` | Screenshots in `docs/ui/before/`, issues triaged |
| **1. Foundation** (3–4 days) | Tokens, light/dark, font, symbols, primitives, `/gallery` route, haptic helper; Biome rule banning literal colours outside `src/design` | Gallery renders both schemes at 100 % and 200 % text; no screen changed yet |
| **2. Shell** (2–3 days) | Native tabs, sheet presentation for pickers/weight/reps, new Today screen | Four tabs work; all old routes reachable; navigation tests updated |
| **3. Session** (5–6 days) | Immersive redesign, set rail with edit/undo, rest sheet, plate diagram, minimal view restyle | A full workout in both views on device; kill/resume still passes; reps editable after logging |
| **4. Progress + Plan** (4–5 days) | Sparklines/detail charts, plan editor with drag reorder, plan switcher | Charts scrub at 60 fps; plan can be changed without losing history |
| **5. Setup + Celebration** (3 days) | Three-step onboarding, summary card, confetti | First-run to first set in under 60 s on device |
| **6. Polish** (3 days) | Motion pass, Reduce Motion/Transparency, contrast audit, large-text pass, remove old components and assets | Accessibility checklist in §7 signed off; `src/components` old files deleted (no dead code) |
| **7. Platform extras** (optional) | Widgets, Live Activity, rest notification actions | Each behind its own flag |

Each phase ends with `pnpm check` green and updated screen tests (the in-memory router tests make
restructuring cheap; add semantic test IDs in Phase 1 so tests do not depend on copy).

## 11. Risks

- **Native-only features.** Glass, native tabs and widgets cannot be seen in Expo Go. Mitigation: a
  development build in Phase 0 and a CI-built preview (`eas build --profile preview`) per release candidate.
- **Reanimated/worklets versions.** pnpm resolves `react-native-worklets` 0.13 while some packages ask for
  ≤0.10 (a warning today). Install through `expo install` and verify one Android release build before
  committing to drag-to-reorder.
- **Scope creep.** Phases 2–3 deliver most of the perceived modernization; stop there if time is short.
- **Brand continuity.** Existing users liked the photo look. Keep photography in Welcome, Celebration and the
  session header so the app still feels like Greyskull.
- **Testing visual changes.** No screenshot tests exist. Add Maestro flows (or Expo's `expo-test`) for
  Today → session → finish on both platforms in Phase 6, run on a nightly workflow.

## 12. First tasks if started now

1. Install a dev build on both phones and capture the "before" screenshots (Phase 0).
2. Create `src/design/{tokens,theme,Text,Button,Surface}.ts(x)` and the `/gallery` route.
3. Swap `Button` and `Screen` internals to the new primitives so every screen changes at once, then migrate
   screens one at a time behind the existing tests.
