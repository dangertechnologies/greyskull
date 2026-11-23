# Store copy

Generated from one source; edit here, then mirror into `store.config.json` and `android/en-US/`.

| Field | Chars | Limit |
|---|---|---|
| iOS title | 20 | 30 |
| iOS subtitle | 27 | 30 |
| iOS promo text | 114 | 170 |
| iOS keywords | 92 | 100 |
| iOS description | 1897 | 4000 |
| iOS release notes | 212 | 4000 |
| Play title | 20 | 30 |
| Play short description | 71 | 80 |
| Play full description | 1827 | 4000 |
| Play release notes | 212 | 500 |

Category: Health & Fitness (secondary on iOS: Sports). Age rating 4+ / Everyone.

## Title
GSLP Workout Tracker

## Subtitle (iOS)
Strength & calisthenics log

## Promotional text (iOS)
Run several programs at once. Plates, bands and ladders do the maths; ease-back after a break. No account, no ads.

## Keywords (iOS)
gslp,workout,barbell,lifting,gym,plates,weightlifting,tracker,5x5,amrap,squat,deadlift,bench

## Short description (Play)
Strength and calisthenics tracker with plate maths. No account, no ads.

## Description
Greyskull LP is a workout tracker for lifting programs and calisthenics. It tells you what to do today, with which plates, bands or progression step, and what to do next time.

RUN SEVERAL PROGRAMS AT ONCE
Each program keeps its own weights, steps and place in the rotation. Train Greyskull LP and a skill track side by side, or add your own.

PROGRAMS BUILT IN
• Strength: Greyskull LP, Phrak's GSLP, StrongLifts 5x5, Starting Strength, AllPro Beginner Routine
• Calisthenics: Recommended Routine, Six Ladders, Skill Track, and a barbell + bodyweight Hybrid
• Build your own: days, sets, progression, ladders, supersets, circuits, EMOM and interval blocks
• Share a program as a file or text and import one from a friend

WHAT YOU GET
• Plate maths: weights are the bar plus pairs of the plates you own, in kg or lb; kettlebell sizes and bands too
• Progression ladders: easier and harder steps, hold timers, added load once you pass the top step
• Library of more than 900 exercises with line pictograms, muscles and form-video links
• Ease back after a break: after two weeks or more away, weights come back down and you can undo it
• Supersets, circuits, EMOM and interval timers with alerts and a Live Activity on iPhone
• Program generator: answer a few questions, or describe what you want and let the model on your phone draft it (supported devices only)
• Siri and Shortcuts: ask for your next workout or start it by voice (iPhone)
• Save finished workouts to Apple Health or Health Connect (optional, write-only)
• History, progress charts and projections, with stalls and deloads marked
• Home-screen widget, backup and restore, minimalist mode

NO ACCOUNT. NO TRACKING.
Your data stays on your phone. The app has no ads and sends nothing anywhere. Program generation runs on your device, with no network and no key.

Support: https://dangertechnologies.github.io/greyskull/support.html

## What's new
New: several programs at once, calisthenics programs and ladders, build your own, 900+ exercises, ease-back after a break, supersets and timers, on-device program generator, Siri, Apple Health and Health Connect.

## Privacy notes (Health)
- Health sync is opt-in (Settings, Health). When on, each finished workout is written to Apple Health (iOS) or Health Connect (Android) on the device: start, end, title and type only.
- Write-only: the app never reads from Health. iOS permission: workouts (write). Android permission: `android.permission.health.WRITE_EXERCISE`.
- Greyskull sends nothing to its developer or any third party because of it, so App Privacy stays "Data Not Collected" and Play Data safety stays "no data collected, none shared". What Apple (iCloud sync) or Google (Health Connect backup) do with Health data follows the user's own settings, and apps the user allows to read Health can see the workouts and their names; say this in the Health Connect declaration, not "nothing leaves the device".
- Play Console needs the Health Connect permissions declaration for `WRITE_EXERCISE`: purpose "save the user's finished workouts to Health Connect", no reads, no sharing. Privacy policy URL: https://dangertechnologies.github.io/greyskull/privacy.html
- iOS usage strings (app.json): update "Greyskull saves your finished workouts to Apple Health."; share "Greyskull does not read your health data."

## Privacy notes (new features)
- Program generator: "Describe it" uses the system's on-device model (Apple Foundation Models on iOS 26+, Gemini Nano on supported Android phones). No network, no key, nothing logged; the text typed stays on the device.
- Siri and Shortcuts (iOS): program names, day names, lift names and weights are shared with the system so Siri can answer; they stay on the device and in the app's own container.
- Clipboard and share sheet: only used when the user exports or imports a backup or a shared program.
- Links: exercise pages open YouTube and stronglifts.com in the browser; the Starting Strength programme links to startingstrength.com.

## App Store privacy answers to check before submitting
- Health & Fitness data: written to HealthKit on the device only; not collected. Answer stays "Data Not Collected".
- Add HealthKit (write) usage to the App Review notes; HealthKit entitlement is present in the build.
