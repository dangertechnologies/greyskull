# Greyskull LP

A Greyskull LP (GSLP) workout tracker built with Expo SDK 57 and expo-router. It replaces the 2019 bare
React Native app and ships under the same store ids: `com.dangertechnologies.gslp` on iOS and
`com.greyskull` on Android. Version `2.0.0` (iOS build 2, Android versionCode 2).

## Run

```sh
corepack enable      # once; package.json pins pnpm via "packageManager"
pnpm install
pnpm start           # Expo dev server; open in Expo Go or a development build
```

`pnpm expo install <pkg>` picks SDK-compatible versions. Without access to api.expo.dev use
`EXPO_OFFLINE=1 pnpm expo install <pkg>`. pnpm runs in its default isolated layout, so only direct
dependencies are autolinked into native builds.

## Test

```sh
pnpm test            # jest (domain, store, hooks, components, screens)
pnpm typecheck       # tsc --noEmit with TypeScript 7 (native compiler)
pnpm lint            # Biome: lint + format + import order (pnpm lint:fix / pnpm format to fix)
pnpm check           # lint + typecheck + test, what CI runs
pnpm expo export --platform ios   # proves the bundle builds
```

TypeScript 7 is used for type checking only; Metro and jest strip types with Babel. The TS 7 package has no
`tsserver.js`, so editors should use their bundled TypeScript or the native-preview language server.

## Training plans

Plans are data in `src/config/plans.ts`: days, schemes (`2x5+`, `5x5`, `2x8-12`, …), the progression model
(`amrap`, `linear`, `double`), plan-specific increments, light/medium day intensities, and which extras each
plan offers. Built in: Greyskull LP and Phrak's GSLP (stable), StrongLifts 5×5, Starting Strength and AllPro's
Beginner Routine (experimental). Every plan is validated and simulated by the test suite.

Structure: `src/domain` is pure TypeScript (units, plate maths, progression, program templates, projection,
v1 migration); `src/store.ts` is the persisted zustand store; `app/` holds the expo-router screens.

## CI and releases

- `.github/workflows/ci.yml` runs on every pull request and on pushes to `master`: Biome, typecheck, jest and
  an iOS + Android Metro bundle.
- `.github/workflows/preview.yml` publishes each same-repo PR to an EAS Update branch (`pr-<number>`) and
  comments a QR code.
- `.github/workflows/release.yml` (Actions → Release → Run workflow) runs CI, bumps `version` in
  `package.json` (patch/minor/major/none), commits `chore(release): vX.Y.Z`, tags `vX.Y.Z`, publishes an
  over-the-air update to the `production` channel, and can start EAS store builds (`build`: ios/android/all).

**Versioning.** `package.json` `version` is the single source of truth; `app.config.ts` copies it to the
store version. iOS build numbers and Android version codes are managed by EAS (`appVersionSource: remote`,
`autoIncrement` on production builds). OTA updates use `runtimeVersion.policy = fingerprint`, so a JS-only
release reaches all installed binaries with the same native code; a release that changes native dependencies
or config needs a store build (`build` input) before users get it.

**One-time setup** (owner): run `eas init` locally, then add to the GitHub repository
- variable `EAS_PROJECT_ID` (the project id `eas init` prints),
- secret `EXPO_TOKEN` (an Expo access token),

and allow the Actions bot to push to the release branch (or release from an unprotected branch). Build
profiles `preview` and `production` map to the update channels of the same name.

## Build

```sh
pnpm dlx eas-cli build --profile preview -p ios      # internal test build
pnpm dlx eas-cli build --profile production -p ios
```

Profiles are in `eas.json`. Install the preview build over a device that still has v1 to check the migration.

## Release

1. Install the preview iOS build over a device that has v1 installed. The "Check your weights" screen must
   appear with the old data; confirm it and check the history.
2. `pnpm dlx eas-cli build --profile production -p ios && pnpm dlx eas-cli submit -p ios`.
3. Android: if the original upload keystore for `com.greyskull` exists, build and submit with it
   (`-p android`). If it does not, change `android.package` in `app.json` to `com.dangertechnologies.gslp` and
   publish as a new listing.
4. Store "What's new": "Fixed weights jumping to huge numbers. Edit any weight any time. Correct Greyskull LP
   days and exercise order. Custom rest timer, projections, custom exercises, minimalist mode, back button and
   Finish button. kg and lb both work with your real plates."
5. Commit `chore(release): 2.0.0` once the builds are accepted.

Android keystore: not checked in cloud environment, must be checked on the owner's Mac.

## Widgets and Live Activities (iOS)

`expo-widgets` adds a "Next workout" widget and a rest-timer Live Activity (Lock Screen and Dynamic Island). They need a
development or production build, not Expo Go: `eas build`, with the App Group `group.com.dangertechnologies.gslp`
enabled for the app and the generated `ExpoWidgetsTarget` extension (EAS provisions both when it can sign for the
account). Widget layouts live in `src/widgets/definitions.tsx`; they run in the extension's own runtime and may only use
`@expo/ui/swift-ui` components. Everything degrades to a no-op on Android, in Expo Go and in tests.

## Backups

Settings → Export backup shares the whole app state as JSON; Import backup restores it from the clipboard or a file
after showing what it contains and asking to replace the current data.

## Migration from v1

v1 stored everything as one JSON blob under the AsyncStorage key `GSLP_STATE_18`. On the first v2 launch (no v2
data yet) the app reads that key, imports the program choice, weights and finished workouts, and opens a
"Check your weights" screen. Any weight that looks wrong (over 3× its starting weight, or over 400 kg; v1 had a
bug that multiplied weights into the millions) is reset to the starting weight and flagged. The v1 key is only
ever read, never modified or deleted, and Reset in Settings does not re-import it.
