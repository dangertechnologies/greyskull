# Greyskull LP

A Greyskull LP (GSLP) workout tracker built with Expo SDK 57 and expo-router. It replaces the 2019 bare
React Native app and ships under the same store ids: `com.dangertechnologies.gslp` on iOS and
`com.greyskull` on Android. Version `2.0.0` (iOS build 2, Android versionCode 2).

## Run

```sh
npm install          # .npmrc sets legacy-peer-deps (jest-expo peer ranges)
npm start            # Expo dev server; open in Expo Go or a development build
```

`npx expo install <pkg>` picks SDK-compatible versions. Without access to api.expo.dev use
`EXPO_OFFLINE=1 npx expo install <pkg>`.

## Test

```sh
npm test             # jest (domain, store, hooks, components, screens)
npm run typecheck    # tsc --noEmit
npx expo export --platform ios   # proves the bundle builds
```

Structure: `src/domain` is pure TypeScript (units, plate maths, progression, program templates, projection,
v1 migration); `src/store.ts` is the persisted zustand store; `app/` holds the expo-router screens.

## Build

```sh
npx eas build --profile preview -p ios        # internal test build
npx eas build --profile production -p ios
```

Profiles are in `eas.json`. Install the preview build over a device that still has v1 to check the migration.

## Release

1. Install the preview iOS build over a device that has v1 installed. The "Check your weights" screen must
   appear with the old data; confirm it and check the history.
2. `npx eas build --profile production -p ios && npx eas submit -p ios`.
3. Android: if the original upload keystore for `com.greyskull` exists, build and submit with it
   (`-p android`). If it does not, change `android.package` in `app.json` to `com.dangertechnologies.gslp` and
   publish as a new listing.
4. Store "What's new": "Fixed weights jumping to huge numbers. Edit any weight any time. Correct Greyskull LP
   days and exercise order. Custom rest timer, projections, custom exercises, minimalist mode, back button and
   Finish button. kg and lb both work with your real plates."
5. Commit `chore(release): 2.0.0` once the builds are accepted.

Android keystore: not checked in cloud environment, must be checked on the owner's Mac.

## Migration from v1

v1 stored everything as one JSON blob under the AsyncStorage key `GSLP_STATE_18`. On the first v2 launch (no v2
data yet) the app reads that key, imports the program choice, weights and finished workouts, and opens a
"Check your weights" screen. Any weight that looks wrong (over 3× its starting weight, or over 400 kg; v1 had a
bug that multiplied weights into the millions) is reset to the starting weight and flagged. The v1 key is only
ever read, never modified or deleted, and Reset in Settings does not re-import it.
