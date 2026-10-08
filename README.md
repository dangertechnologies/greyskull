# Greyskull LP

A Greyskull LP (GSLP) workout tracker built with Expo SDK 57 and expo-router.
Replaces the 2019 bare React Native app; same store ids (`com.dangertechnologies.gslp` on iOS,
`com.greyskull` on Android).

## Develop

```sh
npm install        # .npmrc sets legacy-peer-deps (jest-expo peers)
npm start          # Expo dev server
npm test           # jest
npm run typecheck  # tsc --noEmit
```

## Release

Android keystore: not checked in cloud environment, must be checked on the owner's Mac.
