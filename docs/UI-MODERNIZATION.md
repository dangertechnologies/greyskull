# UI modernization plan (executable)

> **Status (2026-10-08): implemented on `v2`** (phases 1–6, with the deviations listed in `PLAN-NOTES.md`
> under "UI modernization"). Phase 0 (device baseline) and the §10 device checklist are still open: nothing here
> has been run on a phone.

This is a work order for an implementing agent (Claude Sonnet or similar). It is detailed enough to start
without asking questions: every decision below has been made, APIs and package versions were checked against
the installed SDK 57 packages on 2026-10-08, and each task names its files, its tests and its "done" check.
If something here turns out to be wrong in practice, follow §0.4.

Contents: §0 how to work · §1 why · §2 direction · §3 verified platform facts · §4 target structure ·
§5 design system spec · §6 assets, icons and graphics · §7 phases and tasks · §8 testing · §9 risks ·
§10 device checklist.

---

## 0. How to work on this plan

### 0.1 Rules
- Branch: `v2` (the branch all v2 work uses). Pull before starting; push after every task group.
- Before a task: `pnpm install`, `pnpm check` (Biome + typecheck + jest) must be green.
- After a task: `pnpm check` green, `pnpm exec expo export --platform ios --dev` succeeds, then commit with the
  message given in the task (Conventional Commits) and the co-author lines from your session instructions.
- Install native/Expo packages only with `pnpm expo install <pkg>` (`EXPO_OFFLINE=1` when api.expo.dev is
  unreachable). JS-only packages with `pnpm add`. Never `npm`/`yarn`.
- Keep the domain (`src/domain`, `src/store.ts`) untouched unless a task says otherwise; this plan is UI.
- No literal colours, font sizes, font families, spacing numbers or radii in screens or components outside
  `src/design/`. Use tokens. (A test enforces colours from Phase 2 on, §8.)
- Keep accessibility labels on every interactive element; never remove one to make a test pass.
- Don't build iOS/Android natively (`expo prebuild`, `run:ios`, `pod install`) in the cloud sandbox.
- Write each non-obvious decision and every deviation from this plan in `PLAN-NOTES.md` under a dated
  "UI modernization" heading, plus additions to the device checklist (§10).

### 0.2 Definition of done (every task)
1. The task's acceptance list is met and its tests exist and pass.
2. No file outside the task's list changed, except imports that had to move.
3. Old components replaced by the task are deleted (no dead code) and nothing still imports them.
4. Light and dark both render (tests run with `useColorScheme` mocked to each where the task says so).

### 0.3 Commands
```sh
pnpm check                                   # biome + tsc (TypeScript 7) + jest
pnpm lint:fix                                # biome format + safe fixes
pnpm exec expo export --platform ios --dev   # Metro bundle incl. __DEV__ code
pnpm exec jest path/to/file                  # one suite
```

### 0.4 When something in this plan is wrong
Make the smallest change that keeps the intent, write what and why in `PLAN-NOTES.md`, keep going. If an API
named here does not exist or behaves differently, read the package's `build/*.d.ts` in `node_modules` (the
installed version is the truth) and adapt.

---

## 1. Why: what is wrong today

| Area | Today (measured) | Problem |
|---|---|---|
| **Negative space** | Screen padding 16, gap 12 between *everything* (`src/components/Screen.tsx`); cards padding 16; history rows 10 px vertical padding; 44 px rows; Do/Don't tips in two 50 % columns | Everything is equally close to everything else, so nothing groups. Headings sit 12 px from the content above and below. Screens read as dense lists. |
| Theme | Dark only; palette in `src/theme.ts` (26 lines); colours also inline in screens | No light mode, no semantic roles. |
| Type | System font at weights 200/300 on photos | Thin text vanishes in gym lighting; inconsistent on Android. |
| Backgrounds | A blurred photo plus a flat 45 % black overlay behind *every* screen | Decoration behind data; contrast varies by photo. |
| Navigation | Stack only; two small header icons on Home | Progress and Plan are hidden. |
| Controls | 1 px outlined rectangles and circles; 48 px steppers; RN `Modal` | Prototype look; sheets aren't native. |
| Exercise icons | 23 PNGs, **50 × 50 px, single resolution**, white on transparent, 15 from icons8 | Blurry at 2–3×, invisible on a light background, third-party licence needs attribution. |
| UI icons | Ionicons font | Not SF Symbols / Material; mismatched weights. |
| App icon | 2019 purple-gradient skull + "GSLP", 1024 px | No Android adaptive icon (foreground/background/monochrome), no iOS dark/tinted variants. |
| Motion/haptics | Only rest-end haptic | Logging a set gives no feedback. |

## 2. Direction

**"Gym-floor clarity."** Big numbers, one primary action per screen, strong contrast, generous spacing, native
chrome. Photography stays where it carries mood (Welcome, session header, Celebration), never behind lists of
data.

Principles, in priority order:
1. **The next action is the biggest thing on screen** (Start, Done, Finish), in the bottom third.
2. **Space groups content.** Related items 8–12 apart, groups 24–32 apart, sections 40 apart. When unsure,
   add space rather than a divider.
3. **Numbers first.** Weights and reps in Semibold tabular numerals; never weight 200/300.
4. **Native where it exists.** Tabs, sheets, symbols, glass come from the platform.
5. **Light and dark**, following the system, with a manual override.
6. **Motion confirms, never decorates**, and respects Reduce Motion.

## 3. Verified platform facts (SDK 57, checked in this repo)

| Fact | Detail |
|---|---|
| Native tabs | `import { NativeTabs } from 'expo-router/unstable-native-tabs'`. Children: `<NativeTabs.Trigger name="index"><NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label><NativeTabs.Trigger.Icon sf="house" md="home" /></NativeTabs.Trigger>`. **Spike passed:** renders and switches tabs in the jest in-memory router (`renderRouter`) with `router.navigate('/progress')`. Still `unstable_` in 57: keep the import in one file (`app/(tabs)/_layout.tsx`). |
| Platform colours | `import { Color } from 'expo-router'` → `Color.ios.label`, `Color.android.dynamic.primary` (Material You). Values are `PlatformColor`s (opaque: no alpha maths, no contrast checks). Use only for optional Android accent (Phase 6). |
| Sheets | Stack screen options `presentation: 'formSheet'`, `sheetAllowedDetents: [0.5, 1] \| 'fitToContents'`, `sheetGrabberVisible: true` (from `expo-router/build/react-navigation/native-stack/types.d.ts`). Use for *route* sheets. For sheets holding local component state, use RN `Modal` with `presentationStyle="pageSheet"` (iOS) via the `Sheet` primitive. |
| Toolbar | `Stack.Toolbar` with `.Button`, `.Menu`, `.MenuAction`, `.Spacer` exists (iOS). Optional; not required by this plan. |
| Symbols | `expo-symbols` `SymbolView` with `name={{ ios: 'house', android: 'home' }}`, sizes/weights; Android uses Material Symbols (font). All icon names in §6.2 verified present. |
| Glass | `expo-glass-effect`: `GlassView`, `GlassContainer`, `isLiquidGlassAvailable()`. iOS 26+ only; must fall back to a solid `surfaceRaised`. |
| Versions to install (from `expo/bundledNativeModules.json`) | `expo-symbols ~57.0.3`, `expo-glass-effect ~57.0.4`, `expo-system-ui ~57.0.4`, `react-native-reanimated 4.5.1`, `react-native-worklets 0.10.1`, `expo-linear-gradient ~57.0.2` (only if needed). **pnpm currently auto-installs reanimated 4.7.1 / worklets 0.13 as transitive peers; installing them directly via `pnpm expo install` pins the SDK versions — confirm with `pnpm why react-native-reanimated`.** |
| Fonts | `@expo-google-fonts/inter` (JS-only, 0.4.x) + `useFonts` from it. Android cannot synthesise weights for custom fonts: use one family name per weight (`Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`). |
| Metro | Ignores `__tests__` folders: app code must never import from them (see the dev-seed bug fixed 2026-10-08). |
| Expo Go | Native tabs, symbols, reanimated work in Expo Go; Liquid Glass and app icon variants need a development build. |

## 4. Target structure

### 4.1 Folders
```
src/design/         tokens.ts, theme.tsx (ThemeProvider, useTheme, makeStyles), haptics.ts, fonts.ts
src/ui/             primitives: Text, Button, IconButton, Icon, Surface, Card, ListRow, Section,
                    SegmentedControl, Chip, Sheet, NumberStepper, Snackbar, Stack (layout), Monogram,
                    PlateStack, EmptyState
src/components/     app components built from primitives (WeightPicker, RestPanel, SetRail, Sparkline,
                    LiftChart, TechniqueLinks, GymSettings, ExercisePicker, Celebration)
src/views/          SessionImmersive, SessionMinimal
app/                routes (see 4.2)
```
`src/theme.ts`, `src/components/Background.tsx`, `Screen.tsx`, `Button.tsx`, `Stepper.tsx`, `ExerciseIcon.tsx`
are replaced and deleted by the end of Phase 3.

### 4.2 Routes (before → after)
| After | Before | Notes |
|---|---|---|
| `app/_layout.tsx` (Stack) | same | Hosts `(tabs)`, `session/[n]`, `session/edit/[n]`, `lift/[id]`, `exercises/*`, `setup/*`, `sheets/*`, `gallery` (dev). |
| `app/(tabs)/_layout.tsx` | — | `NativeTabs`: Today, Progress, Plan, Settings. |
| `app/(tabs)/index.tsx` | `app/index.tsx` | Today. Keeps the `Redirect`s to `/setup` and `/setup/confirm`. |
| `app/(tabs)/progress.tsx` | `app/progress.tsx` | Lift list with sparklines + Projection section. Detail goes to `/lift/[id]`. |
| `app/(tabs)/plan.tsx` | parts of Settings | Plan name + status, days overview, rows → Edit days, Progression rules, Exercises, Change plan. |
| `app/(tabs)/settings.tsx` | `app/settings.tsx` | Gym, rest, appearance, haptics, backup, reset, dev tools. |
| `app/lift/[id].tsx` | lift editor + progress page | Merged: chart + stats on top, editing below. |
| `app/history.tsx` | Home history list | Full history (`FlatList`). Today shows the last 3. |
| `app/plan/rules.tsx` | `app/setup/options.tsx` rules part | Edit rules after setup (`setProgram` with new rules). |
| `app/setup/index.tsx` | same | Welcome (photo). |
| `app/setup/gym.tsx` | `units.tsx` | Step 1/3. |
| `app/setup/plan.tsx` | `template.tsx` + `options.tsx` | Step 2/3: plan cards; selected card expands extras, sessions/week, "Advanced" rules disclosure. `?change=1` mode from Plan tab. |
| `app/setup/review.tsx` | `weights.tsx` + `summary.tsx` | Step 3/3: week 1, each lift row opens the weight sheet; "Customise days" → `/setup/days`. |
| `app/setup/days.tsx`, `confirm.tsx` | same | Restyled. |
| `app/sheets/weight.tsx` | `WeightModal` | Route sheet, params `exerciseId`; writes `setDraftWeight`. |
| `app/sheets/reps.tsx` | minimal-view reps `Modal` | Route sheet, params `exerciseId`, `set`; writes `logSet`. |
| `app/gallery.tsx` | — | `__DEV__` only: every primitive in both schemes. Linked from Settings → Developer. |

`goHome()` (`router.dismissTo('/')`) and `goBackOr()` in `src/navigation.ts` stay the only way to leave flows;
`src/__tests__/navigation.test.tsx` must keep passing after the move to tabs. `src/testRoutes.ts` gets the new
route keys (`'(tabs)/_layout'`, `'(tabs)/index'`, …).

## 5. Design system spec

### 5.1 Colour roles (contrast verified, WCAG AA)
| Role | Dark | Light | Use |
|---|---|---|---|
| `background` | `#0B0C0E` | `#F6F7F9` | Screen background |
| `surface` | `#16181C` | `#FFFFFF` | Cards, grouped lists |
| `surfaceRaised` | `#1F2228` | `#FFFFFF` | Sheets, floating bars (glass fallback) |
| `border` | `#2A2E35` | `#E1E4E9` | Hairline separators only (decorative) |
| `borderStrong` | `#5A616C` | `#8A919C` | Input and chip outlines (≥ 3:1 on surface) |
| `text` | `#F4F5F7` | `#0E1013` | Primary text (17.9:1 / 17.8:1 on background) |
| `textMuted` | `#A3A9B3` | `#5B6370` | Secondary text (8.3:1 / 5.7:1) |
| `accent` | `#C6F432` | `#1F7A3A` | Primary buttons, selection, progress (15.3:1 / 5.0:1 on background) |
| `onAccent` | `#0B0C0E` | `#FFFFFF` | Text on accent (15.3:1 / 5.4:1) |
| `success` | `#4ADE80` | `#15803D` | Weight went up, logged sets |
| `warning` | `#FBBF24` | `#B45309` | Failed rep target, experimental badge |
| `danger` | `#F87171` | `#B91C1C` | Destructive, deload, "looks wrong" |
| `scrim` | `rgba(0,0,0,0.55)` | `rgba(0,0,0,0.45)` | Over photos (text on photos is always light) |
| `chartLine` | = `accent` | = `accent` | |
| `chartFill` | accent at 18 % | accent at 14 % | |

Verify `borderStrong` ≥ 3:1 against `surface` with the contrast test in §8 (adjust the hex if not).

### 5.2 Typography (Inter)
| Variant | Size / line | Weight family | Use |
|---|---|---|---|
| `display` | 56 / 60 | SemiBold | Current weight in session |
| `numberLarge` | 40 / 44 | SemiBold | Reps target, rest countdown |
| `title` | 28 / 34 | SemiBold | Screen titles |
| `headline` | 20 / 26 | SemiBold | Card and section titles |
| `body` | 17 / 24 | Regular | Default |
| `bodyStrong` | 17 / 24 | Medium | List row titles |
| `callout` | 15 / 21 | Regular | Secondary lines, tips |
| `caption` | 13 / 18 | Medium | Metadata, plates line |
| `label` | 12 / 16 | SemiBold, uppercase, letterSpacing 0.6 | Section labels |

All numeric variants set `fontVariant: ['tabular-nums']`. Display variants set `maxFontSizeMultiplier: 1.3`;
text variants scale freely (Dynamic Type up to 200 % must not clip, §7 Phase 6).

### 5.3 Spacing, layout and negative space (the main fix)
Scale `space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 }`.

Rules (apply everywhere; the gallery shows each):
- **Screen gutters:** 20 horizontal (`space[5]`); 24 when window width ≥ 400.
- **Screen top:** large title 8 below the header, then 24 to the first block.
- **Between sections:** 40 (`space[10]`). A section = label/heading + its content.
- **Section label → content:** 12. **Heading → body text:** 8.
- **Inside cards:** padding 20; between rows in a card 16; card radius 20.
- **List rows:** min height 56, vertical padding 14, icon/monogram → text gap 14; separators inset to the text
  start, never full-bleed.
- **Buttons:** primary 56 tall (`lg` 60 for Start/Done/Finish), radius 16, horizontal padding 24; stacked
  buttons 12 apart; a primary button has ≥ 24 above it.
- **Bottom actions:** the primary action of a screen is pinned in a bottom bar: padding 20, plus the safe-area
  inset, background `surfaceRaised` (glass on iOS 26), 1 hairline `border` on top.
- **Touch targets:** ≥ 48 × 48 (44 on iOS-only controls is not enough for gym use).
- **Max line length:** body text max width 560.
- **Don't:** use `gap` as the only spacing on a whole screen (the cause of today's sameness); use dividers to
  separate things that space already separates; put two primary buttons side by side.

Implement as primitives so screens don't hand-pick numbers: `<Stack gap={…}>` (vertical stack taking a token
key), `<Section title label footer>` (owns the 40/12 rhythm), `<ScreenScroll>` (gutters + top rhythm + bottom
inset for a pinned bar), `<BottomBar>`.

### 5.4 Radii, elevation, motion, haptics
- Radii: `{ sm: 8, md: 12, lg: 16, xl: 20, pill: 999 }`.
- Elevation: dark uses tonal surfaces (no shadows); light uses `surface` on `background` plus a 1 px `border`
  for cards; sheets get the platform shadow.
- Motion tokens: `fast 150 ms`, `base 220 ms`, `slow 320 ms`; spring `{ damping: 18, stiffness: 220 }`. Reduce
  Motion → opacity fades only (`AccessibilityInfo.isReduceMotionEnabled` + `addEventListener`).
- Haptics (`src/design/haptics.ts`, wraps `expo-haptics`, no-op when the user setting is off):
  `tick()` = `selectionAsync` (stepper step, chip), `tap()` = `impactAsync(Light)` (log a set, Done),
  `success()` = `notificationAsync(Success)` (finish, rest over), `warn()` = `notificationAsync(Warning)`
  (destructive confirm).

### 5.5 Theme API
```ts
// src/design/theme.tsx
export type Scheme = 'light' | 'dark';
export interface Theme { scheme: Scheme; color: Record<ColorRole, string>; space: typeof space;
  radius: typeof radius; type: Record<TypeVariant, TextStyle>; }
export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element; // reads store `appearance`
export function useTheme(): Theme;
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(fn: (t: Theme) => T): () => T; // memoised per scheme
```
Store: add `appearance: 'system' | 'light' | 'dark'` (default `'system'`) and `hapticsEnabled: boolean`
(default `true`) to `AppState`, `initialState`, `setSettings`, with tests. Missing fields in persisted data are
filled by the default because zustand merges persisted state over the initial state; add a store test proving it.
`app.json`: `userInterfaceStyle: "automatic"`; add the `expo-system-ui` plugin so Android's root background
follows the scheme. `StatusBar style="auto"` except over photos (`light`).

### 5.6 Primitive APIs (Phase 1)
```ts
Text:            { variant?: TypeVariant = 'body'; color?: ColorRole = 'text'; align?; numberOfLines?; children } & TextProps
Button:          { title; onPress; variant?: 'primary' | 'secondary' | 'plain' | 'destructive' = 'primary';
                   size?: 'md' | 'lg' = 'md'; icon?: IconName; disabled?; testID?; accessibilityLabel? }  // tap() haptic
IconButton:      { icon: IconName; label: string /* a11y */; onPress; size?: 'md' | 'lg'; tone?: ColorRole }
Icon:            { name: IconName; size?: number = 22; color?: ColorRole = 'text' }  // SymbolView, see §6.2
Surface / Card:  { children; padded?: boolean = true; style? }  // Card = Surface with radius xl
ListRow:         { title; subtitle?; value?; leading?: ReactNode; onPress?; accessory?: 'chevron' | 'switch' | ReactNode;
                   switchValue?; onSwitch?; destructive?; testID? }
Section:         { label?: string; title?: string; footer?: string; children }
SegmentedControl:{ options: { value: string; label: string }[]; value; onChange; accessibilityLabel }  // JS, radio semantics
Chip:            { label; selected; onPress; role?: 'radio' | 'checkbox' }
Sheet:           { visible; onClose; title?; children; detent?: 'auto' | 'large' }  // Modal pageSheet (iOS) / bottom panel (Android)
NumberStepper:   same props as today's Stepper + size?: 'md' | 'lg'; keeps stepValue, long-press 400/150 ms,
                 accessibilityActions; tick() haptic per step; buttons 56 (lg 64), value in numberLarge
Snackbar:        useSnackbar().show({ message, action?: { label, onPress }, durationMs = 5000 })
Monogram:        { exercise: Exercise; size?: 40 | 56 }  // §6.3
PlateStack:      { kg: number; unit?; inventory?; size?: 'sm' | 'lg' }  // §6.4
EmptyState:      { icon: IconName; title; body?; action?: { title; onPress } }
```

## 6. Assets, icons and graphics

### 6.1 Current inventory (audited 2026-10-08)
- `assets/backgrounds/*-blur.jpg`: 11 pre-blurred photos, 1920 px wide (portrait ones up to 2891 tall), 1.2 MB
  total. All referenced from `src/backgrounds.ts`; `src/assets.test.ts` checks every `require` resolves, every
  exercise background key exists and no file is orphaned. The unreferenced `athlete-nonfree-blur.jpg` was
  removed (its name flagged a licence problem). Dips now use `dips`. Bench press, squat and row use `default`
  (= squat photo). **Provenance of the photos is undocumented** (owner task: confirm licences, add
  `assets/CREDITS.md`).
- `assets/icons/*.png`: 23 exercise icons, 50 × 50 px, no @2x/@3x, white on transparent; 15 are icons8 assets.
- `assets/icon.png` 1024 px; `assets/splash.png` 1920 × 1280 photo with "cover".

### 6.2 UI icons → `expo-symbols`
`src/ui/Icon.tsx` maps a closed `IconName` union to platform symbols. All names below exist in the installed
`sf-symbols-typescript` and Material Symbols list:

| IconName | iOS (SF) | Android (Material) |
|---|---|---|
| `today` | `house` | `home` |
| `progress` | `chart.line.uptrend.xyaxis` | `show_chart` |
| `plan` | `list.bullet` | `list` |
| `settings` | `gearshape` | `settings` |
| `back` | `chevron.left` | `arrow_back` |
| `close` | `xmark` | `close` |
| `up` / `down` | `chevron.up` / `chevron.down` | `keyboard_arrow_up` / `keyboard_arrow_down` |
| `add` / `remove` | `plus` / `minus` | `add` / `remove` |
| `check` | `checkmark` | `check` |
| `do` / `dont` | `checkmark.circle` / `xmark.circle` | `check_circle` / `cancel` |
| `timer` | `timer` | `timer` |
| `lift` | `dumbbell` | `fitness_center` |
| `calendar` | `calendar` | `calendar_today` |
| `delete` | `trash` | `delete` |
| `edit` | `pencil` | `edit` |
| `skip` | `forward.end` | `skip_next` |
| `undo` | `arrow.uturn.backward` | `undo` |
| `video` | `play.circle` | `play_circle` |
| `guide` | `book` | `menu_book` |
| `rules` | `slider.horizontal.3` | `tune` |
| `share` | `square.and.arrow.up` | `share` |

Native tab icons use the same names via `NativeTabs.Trigger.Icon sf=… md=…`. After Phase 6 nothing imports
`@expo/vector-icons`; remove it then (`TechniqueLinks` and the session views use it today).

### 6.3 Exercise icons → monograms (replace the PNGs)
The 50 px bitmaps can't be fixed by tinting. Instead of commissioning a new pictogram set, use **monograms**:
a circle (40 or 56) filled with `accent` at 16 % opacity, text `accent`, `caption`/`headline` SemiBold, showing
up to 3 letters derived from `shortName` (`Squat`→`SQ`, `Deadlift`→`DL`, `Bench`→`BP`, `Press`→`OHP`,
`Chin`→`CU`, `Curls`→`CL`, `Crunches`→`CR`, `Row`→`ROW`, `Dips`→`DIP`). Add an optional `abbr?: string` to
`Exercise` (catalog sets the values above; custom exercises derive: first letters of up to 3 words, else first 3
letters) — pure function `monogramOf(exercise)` in `src/domain/` with tests. Monograms scale perfectly, theme
correctly, have no licence issues and match how modern lifting apps list exercises.
- Delete `assets/icons/`, `src/icons.ts`, `ExerciseIcon.tsx` and the icon grid in the exercise editor; keep the
  `icon` field in the type (optional) for stored data, unused. Update `src/assets.test.ts`.
- The exercise editor gets an "Abbreviation" text field (max 3 chars, uppercase).

### 6.4 Plate diagram (`PlateStack`, new graphic)
SVG (`react-native-svg`), one side of the bar: sleeve stub, collar, then plates largest-first from
`platesPerSide(kg, inv, unit)`. Plate height ∝ diameter class, width ∝ thickness:

| kg plate | colour | height % | lb plate | colour | height % |
|---|---|---|---|---|---|
| 25 | `#D32F2F` red | 100 | 45 | `#455A64` | 100 |
| 20 | `#1565C0` blue | 100 | 35 | `#546E7A` | 100 |
| 15 | `#F9A825` yellow | 100 | 25 | `#607D8B` | 92 |
| 10 | `#2E7D32` green | 100 | 10 | `#78909C` | 70 |
| 5 | `#ECEFF1` white | 70 | 5 | `#90A4AE` | 55 |
| 2.5 | `#D32F2F` | 55 | 2.5 | `#B0BEC5` | 45 |
| 1.25 | `#B0BEC5` | 45 | 1.25 | `#CFD8DC` | 40 |
| ≤ 0.5 | `#90A4AE` | 35 | ≤ 0.5 | `#CFD8DC` | 35 |

(IWF/IPF colour convention for kg; neutral greys for lb, which have no standard.) Plate colours are data
colours, allowed in `src/ui/PlateStack.tsx` only (allowlisted in the colour test). Each plate gets a 1 px
`border` outline so white plates show on light backgrounds. `accessibilityLabel` = `formatPlates(...)`; the
text line stays visible under the diagram (colour is never the only carrier). Bar only → sleeve + "bar only".

### 6.5 Photography
- Keep the blurred photos only for: Welcome, the session header (top 34 % of the immersive screen, image with
  `scrim` gradient to `background`), Celebration. Everywhere else: solid `background`.
- Text on photos is always light (`#FFFFFF` / 80 % white) on `scrim`, independent of the scheme.
- Give every main lift a fitting header photo (checked by viewing the files): bench → `dumbbell-female` (bench
  press with a spotter, unused today); squat → `squat` (explicit key instead of the fallback); row →
  `empty-gym` (no row photo exists; the empty gym reads as neutral). `woman-with-barbell` is the same shot as the
  splash photo: use it on Welcome. Update `exercises.json`, bump `CATALOG_VERSION` to 3 so `refreshCatalog`
  carries the keys to existing installs, and extend `src/assets.test.ts` to require a `background` on every
  built-in.
- File sizes are fine (80–156 KB each, 1.1 MB total); no re-encoding and no `expo-image` unless decode jank shows
  on device.

### 6.6 App icon and splash
- **Android adaptive icon** (missing today): from `assets/icon.png`, create `assets/adaptive-foreground.png`
  (skull + GSLP on transparent, content inside the central 66 % safe zone, 1024 px), `assets/adaptive-background.png`
  (the purple gradient, 1024 px) and `assets/adaptive-monochrome.png` (white silhouette). Wire
  `android.adaptiveIcon: { foregroundImage, backgroundImage, monochromeImage }` in `app.json`.
- **iOS 18+ variants:** `ios.icon: { light: "./assets/icon.png", dark: "./assets/icon-dark.png", tinted:
  "./assets/icon-tinted.png" }` (dark = skull on near-black gradient; tinted = white silhouette on transparent).
- Produce these with a small Node script in `scripts/` using `sharp` (dev dependency) from the existing PNG
  (crop/scale/recolour), not by hand-drawing; commit script + outputs; check by viewing the PNGs.
- **Splash:** switch to the `expo-splash-screen` plugin config: `image: "./assets/splash-icon.png"` (skull mark,
  transparent, 512 px from the icon), `imageWidth: 160`, `backgroundColor: "#0B0C0E"`, `dark.backgroundColor`
  same. The full-bleed photo splash crops badly on tall phones and is not supported by the modern splash API.
- Add all new files to `src/assets.test.ts` (existence) and record the device check in §10.

## 7. Phases and tasks

Phase 0 is for the owner (needs devices). Phases 1–6 are for the implementing agent, in order. Sizes are
agent sessions (≈ one focused run each).

### Phase 0 — Device baseline (owner)
Install a development build on one iPhone and one Pixel-class Android; screenshot every screen in
`docs/ui/before/`; run the open items in `PLAN-NOTES.md` "Needs manual check on device". Not blocking Phase 1.

### Phase 1 — Foundation (2 sessions)
**1.1 Packages and config.** `pnpm expo install expo-symbols expo-glass-effect expo-system-ui react-native-reanimated
react-native-worklets`; `pnpm add @expo-google-fonts/inter`. Confirm reanimated 4.5.1 / worklets 0.10.1
(`pnpm why`). jest: add `"setupFilesAfterEnv": ["<rootDir>/jest.setup.ts"]` to the `jest` block in `package.json`; `jest.setup.ts`
calls `require('react-native-reanimated').setUpTests()`; if `SymbolView` or `GlassView` fail in jest, mock them there
(`jest.mock('expo-symbols', () => ({ SymbolView: () => null }))`). `app.json`: `userInterfaceStyle: automatic`,
plugins add `expo-system-ui`.
*Commit:* `chore(ui): design-system dependencies and config`.

**1.2 Tokens + theme.** `src/design/tokens.ts` (§5.1–5.4 exactly), `theme.tsx` (§5.5), `fonts.ts`
(`useAppFonts()` wrapping `useFonts` from `@expo-google-fonts/inter`), `haptics.ts`. Root layout: wrap in
`ThemeProvider`; keep the splash until `hydrated && fontsLoaded`. Store: `appearance`, `hapticsEnabled`.
*Tests:* contrast test (§8) over both palettes; `makeStyles` memoises per scheme; store defaults/merge.
*Commit:* `feat(ui): design tokens, theme provider, fonts and haptics`.

**1.3 Primitives.** Everything in §5.6 under `src/ui/`, plus `Stack`, `ScreenScroll`, `BottomBar`. Each with a
small test (renders; role/label; `Button` calls `onPress` and haptic; `NumberStepper` keeps all current
`Stepper.test.tsx` behaviour — move those tests over).
*Commit:* `feat(ui): primitives`.

**1.4 Gallery.** `app/gallery.tsx` (`__DEV__` only, `Redirect` to `/` otherwise) rendering every primitive,
both schemes side by side (wrap halves in nested `ThemeProvider` with forced scheme), at normal and
"large text" (wrap with a context that multiplies font sizes 1.5× for preview). Settings → Developer → Gallery.
*Commit:* `feat(ui): primitives gallery`.

**Done when:** gallery renders in the jest router in both schemes; no existing screen changed visually yet;
`pnpm check` green.

### Phase 2 — Shell (2 sessions)
**2.1 Tabs + route moves** per §4.2 (Today, Progress, Plan, Settings). Move files with `git mv`. Update
`testRoutes.ts`, all screen tests, `goHome` behaviour (navigation tests must pass unchanged in intent).
**2.2 Screens to primitives:** Settings (Sections: Your gym, Workout, Appearance, Data, Developer), Plan tab,
Exercises list, Confirm weights. Replace `Screen`/`Background` with `ScreenScroll` on solid background.
**2.3 Sheets:** `app/sheets/weight.tsx` and `app/sheets/reps.tsx` as `formSheet` routes (detents
`'fitToContents'`, grabber visible); `WeightModal` and the minimal-view reps modal deleted.
**2.4 Today screen:** hero `Card` with day + week, lift rows (`Monogram` 56, name `bodyStrong`, weight
`numberLarge`, `PlateStack sm` + plates caption, scheme chip); 7-day strip (done ✓ / skipped / next); "Coming up"
(next 2 sessions) and "Recent" (last 3, "See all" → `/history`); `BottomBar` with **Start/Resume** (`lg`). Skip
moves to a plain button under the card and shows an undo `Snackbar` (store: `undoSkip()` — removes the last log if
it is skipped and `n === nextSession - 1`, decrements `nextSession`; tests).
**2.5 Colour lint test** turns on with an allowlist of not-yet-migrated files (§8).
*Commits:* `feat(ui): native tabs and route restructure`, `feat(ui): settings, plan and exercises on the new
design system`, `feat(ui): weight and reps sheets`, `feat(ui): today screen`.
**Done when:** every old route is reachable from the tabs; all tests updated and green; Today matches §5.3
spacing (assert key paddings via style props in one test).

### Phase 3 — Session (3 sessions)
**3.1 Hook additions** (`src/hooks/useSession.ts`): `selectedIndex` (defaults to `activeIndex`), `select(i)`,
logging an already-logged item updates reps without starting rest; `addRest(seconds)` (±30, floor 0); expose
`restTotal`. `src/domain/history.ts`: `lastResult(sessions, exerciseId)` → `{ weightKg, reps: number[], date } | null`
and `isPersonalRecord(sessions, exerciseId, weightKg, reps)`. Tests for each.
**3.2 Immersive view:** photo header (34 % height, scrim, exercise name `title`, "Set 2 of 3 · Light day"
`label`); body on `background`: `display` weight + `PlateStack lg` (tap → weight sheet), "Last time: 62.5 kg × 8"
`callout textMuted`; reps (`numberLarge`, or `NumberStepper lg` for AMRAP starting at last time's reps, else
target); `SetRail` (pill per work set; logged = `success`; current = `accent` outline; tap a logged pill to edit
it — fixes "no undo"); `BottomBar` with **Done** (`lg`, `tap()` haptic). Tips below the fold: "Technique" section
with Do (✓ `success`) and Don't (✕ `danger`) as a stacked list, `TechniqueLinks` underneath.
**3.3 Rest:** `RestPanel` replaces the full-screen `RestRing`: slides up over the bottom bar (reanimated), shows
`numberLarge` countdown, linear progress bar, `−30`, `+30`, `Skip`. SetRail stays visible. Rest-over:
`success()` haptic + `AccessibilityInfo.announceForAccessibility('Rest over')`.
**3.4 Minimal view:** rows as `Card`s (40 between exercises), set pills 52 tall, `Monogram 40`, weight + plates
caption, warm-ups as one `caption` line, `RestPanel` shared, Finish in `BottomBar`. Long-press a pill → reps sheet;
add accessibility action "Edit reps" on each pill.
**3.5 Celebration:** solid screen with photo header; summary `Card` with one row per lift (`Monogram`, "60 → 62.5 kg",
change badge: ↑ `success`, ↑↑, same `warning`, deload `danger`, "+1 rep"), PR badge from `isPersonalRecord`,
"Next: Wed · Bench 62.5 · Deadlift 100" line; **Back to Today** in `BottomBar`. Confetti is out of scope.
*Commits:* `feat(session): set selection and rest controls in the engine`, `feat(ui): immersive session
redesign`, `feat(ui): rest panel`, `feat(ui): minimal session redesign`, `feat(ui): celebration summary`.
**Done when:** existing session, minimal and navigation tests pass (updated for copy/testIDs); new tests cover
editing a logged set, ±30 s rest, PR badge, last-time line.

### Phase 4 — Progress, lift detail, plan editing (2 sessions)
**4.1 Progress tab:** `Section` per program lift: `ListRow` with `Monogram`, current weight, trend arrow
(`success`/`danger`), `Sparkline` (60 × 24 svg polyline, last 12 points; reps for bodyweight); "Projection" `Section`
with the next 6 sessions; "History" row → `/history`.
**4.2 Lift detail (`/lift/[id]`):** `LiftChart` (area: `chartFill` + `chartLine`, first/last date labels,
current weight dashed line, PR dots; range `SegmentedControl` 3M / 6M / 1Y / All; scrub with
`onResponderMove` on a transparent overlay showing a tooltip "12 Mar · 62.5 kg × 8"; light/medium-day sessions
excluded), stats row (start → now, best AMRAP, est. 1RM), then the existing editor controls in `Section`s, then
history.
**4.3 Plan tab + rules + change plan:** `/plan/rules` edits rules with the same controls as setup (calls
`setProgram({ ...program, rules })`); "Change plan" opens `/setup/plan?change=1` → `/setup/review?change=1`
(keeps lifts and history; confirm sheet explains).
**4.4 Days editor restyle:** each day a `Card`; slot rows with `Monogram 40`, name, scheme chip (opens a scheme
sheet with Sets stepper, Reps stepper, AMRAP / range toggle — replaces cycling), move up/down `IconButton`s,
delete `IconButton`. Drag-to-reorder is out of scope.
*Commits:* `feat(ui): progress tab with sparklines`, `feat(ui): lift detail chart`, `feat(ui): plan tab, rules and
change plan`, `feat(ui): days editor redesign`.

### Phase 5 — Setup and remaining screens (1–2 sessions)
Welcome (photo, logo, 3 short value lines, **Get started**), Gym (step 1/3 with a live `PlateStack` preview of
100 kg / 225 lb), Plan (cards: name, summary, frequency chip, Experimental badge in `warning`; selected expands
description + extras switches + sessions/week `SegmentedControl` + "Advanced" disclosure with rules), Review
(week 1 cards, each lift row → weight sheet in setup mode, "Customise days" link, **Start training** in
`BottomBar`). Step indicator "1 of 3" in the header. Exercise editor, history, edit past session restyled with
primitives. Delete `units.tsx`, `template.tsx`, `options.tsx`, `weights.tsx`, `summary.tsx`.
*Commit:* `feat(ui): three-step onboarding and remaining screens`.

### Phase 6 — Polish, assets, cleanup (2 sessions)
- §6.3 monograms everywhere (if not done), §6.5 photo keys, §6.6 icon/splash assets + config.
- Motion pass: reanimated layout animations on SetRail, list insert/remove, card expand; number roll on weight
  change; all gated by Reduce Motion.
- Accessibility pass: Dynamic Type 200 % (gallery + Today + session must not clip: numbers wrap to their own
  line), Reduce Transparency (glass → `surfaceRaised`), every control labelled, contrast test green, focus order
  sane in session.
- Optional: Android Material You accent via `Color.android.dynamic.primary` behind a Settings toggle.
- Liquid Glass: `BottomBar`/`RestPanel` use `GlassView` when `isLiquidGlassAvailable()`.
- Remove `@expo/vector-icons`, `src/theme.ts`, old components, `assets/icons/`; colour-lint allowlist empty.
*Commits:* `feat(ui): app icon, splash and photo updates`, `feat(ui): motion and accessibility pass`,
`chore(ui): remove legacy UI`.

### Out of scope (later, separate plans)
Apple Watch app, custom exercise illustrations, Skia charts.

> Status 2026-10-08: widgets, Live Activities, share-as-image, confetti, drag-to-reorder, Liquid Glass and the
> Material You accent were built afterwards; see the last section of `PLAN-NOTES.md`.

## 8. Testing strategy
- **Keep** all domain/store tests untouched. **Update** screen tests for moved routes and new copy; prefer
  `testID`s on primary actions (`start-session`, `done-set`, `finish-workout`, `skip-session`, `rest-skip`,
  `set-pill-<exercise>-<n>`) so copy changes don't break tests.
- **Contrast test** (`src/design/contrast.test.ts`): compute WCAG ratios for text roles on `background`,
  `surface`, `surfaceRaised` (≥ 4.5), `borderStrong` on `surface` (≥ 3), `onAccent` on `accent` (≥ 4.5), both schemes.
- **Colour lint test** (`src/design/no-literal-colours.test.ts`): scan `app/**` and `src/**` (excluding
  `src/design/`, `src/ui/PlateStack.tsx`, tests) for `/#[0-9a-fA-F]{3,8}\b|rgba?\(/`; fail on matches outside an
  explicit allowlist array in the test. The allowlist shrinks each phase and is empty after Phase 6.
- **Scheme tests:** render Today, session and Settings with `useColorScheme` mocked to `'light'` and `'dark'`;
  assert the root background style equals the token.
- **Asset test** (`src/assets.test.ts`, exists): extend with new icon/splash files and photo keys.
- **No screenshot tests in jest.** Visual review happens on device (§10) and in the gallery.

## 9. Risks
| Risk | Mitigation |
|---|---|
| `unstable-native-tabs` API changes in a later SDK | Single import site; Phase 2.1 adds `src/__tests__/tabs.test.tsx` (render + switch tabs through `renderRouter`, as the 2026-10-08 spike did). |
| reanimated/worklets version drift under pnpm | Install directly with `pnpm expo install`; check `pnpm why`; Android release build before Phase 3 ships. |
| jest can't render `SymbolView`/`GlassView` | Mock in `jest.setup.ts`; logic stays testable through `Icon` props. |
| Fonts slow first launch | Fonts load during the splash (already gated on hydration). |
| Light mode on photo screens | Photo screens force light text on scrim, independent of scheme. |
| Losing the Greyskull feel | Photos stay on Welcome, session header and Celebration; skull icon stays. |

## 10. Device checklist (add to `PLAN-NOTES.md`; owner runs after each phase)
- Spacing reads as grouped, not cramped, on a 375 pt-wide iPhone and a 411 dp Android; nothing touches the gutters.
- Light and dark both look intentional; switch while the app is open.
- Inter renders at all weights on Android (no fallback to Roboto).
- Tab bar: native look on both; Liquid Glass on iOS 26; icons crisp.
- Sheets: weight and reps sheets size to content, grabber works, keyboard doesn't cover inputs.
- Session: Done reachable with the thumb; editing a logged set works; rest panel ±30 s; haptics feel right;
  "Rest over" announced with VoiceOver/TalkBack.
- Plate diagrams match real plates (kg colours, lb greys) and white plates are visible in light mode.
- Monograms legible at 40 and 56.
- App icon: adaptive icon on Android (round and squircle masks), dark and tinted icons on iOS 18+; splash
  shows the mark centred on dark on a tall phone.
- Dynamic Type at the largest accessibility size: no clipped numbers.
- Technique links open YouTube / guides in the in-app browser.
