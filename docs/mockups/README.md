# Mockups

Mockups of the calisthenics, multi-program, Health, generator and recovery screens. Each screen is one HTML file in
`src/`, rendered at 390 x 844 points, 3x (1170 x 2532 pixels), in light and dark, into `exports/`.

Open the PNGs to compare a built screen with its mockup. Colours, spacing, radii and the type scale are copied from
`src/design/tokens.ts`; the glass tab bar is approximated with a blurred translucent pill.

## Re-render

```sh
docs/mockups/render.sh        # every screen, light and dark (about 5 s per image)
docs/mockups/render.sh 07     # only screens whose file name starts with 07
```

Needs Google Chrome (set `CHROME` to use another path) and, for the Inter font, `pnpm install` (the font files are read
from `node_modules/@expo-google-fonts/inter`; the system font is used if they are missing). Nothing else.

## Editing

- `src/base.css` holds the tokens and shared components; `src/base.js` holds the theme switch (URL hash `#light` or
  `#dark`), the status bar, the icons, the placeholder pictograms and the tab bar. Every screen file links both, so a
  screen opened on its own in a browser works (add `#dark` to the address for dark).
- Pictograms are simple placeholder line drawings (`P` in `base.js`). The real set comes from the pictogram task; the
  mockups only show where a pictogram goes and at what size (40, 56 and 160 points).
- Names of ladder steps, programs and exercises are illustrative where the catalog is not final.

## Screens

| Image (light / dark) | Shows |
| --- | --- |
| `exports/01-today-draft-light.png` / `exports/01-today-draft-dark.png` | Today with an open draft: resume card on top, two program cards (GSLP, Skill Track) with Start and Skip, one paused program (5/3/1). |
| `exports/02-today-empty-light.png` / `exports/02-today-empty-dark.png` | Today with no program: empty state, "Add a program" and "Generate a program". |
| `exports/03-programs-light.png` / `exports/03-programs-dark.png` | Programs tab: active, paused, "My programs" groups; New button. The tab is labelled "Programs" here (it is "Plan" in the app today). |
| `exports/04-program-detail-light.png` / `exports/04-program-detail-dark.png` | Program detail for Skill Track: next day with Start, days, rules, pause, remove. |
| `exports/05-add-program-light.png` / `exports/05-add-program-dark.png` | Add program picker: category chips (Strength, Hypertrophy, Calisthenics selected, Skills, Mobility), equipment-fit badge per program (fits, missing barbell, equipment not set), "Generate a program" entry. |
| `exports/06-session-hold-light.png` / `exports/06-session-hold-dark.png` | Session, timed hold: stopwatch running at 0:18 of a 30 s target, set circles with the first logged in seconds, Stop button. |
| `exports/07-session-ladder-light.png` / `exports/07-session-ladder-dark.png` | Session, ladder exercise: ease-back banner with Undo, step name and "step 4 of 10", Easier / Harder, band label (Red), next-step rule, reps. |
| `exports/08-session-added-load-light.png` / `exports/08-session-added-load-dark.png` | Session, added load: weighted dip with "+10 kg" on a dip belt, loadable choices only (single plates). |
| `exports/09-ladder-light.png` / `exports/09-ladder-dark.png` | Ladder screen (push-up ladder): five done steps, current step highlighted with its unlock rule ("3×8 to move on"), four next steps. |
| `exports/10-lift-chart-light.png` / `exports/10-lift-chart-dark.png` | Lift chart for a ladder: level axis with step names, area line, "this program / all programs" toggle, summary rows. |
| `exports/11-exercise-library-light.png` / `exports/11-exercise-library-dark.png` | Exercise library: search, filter chips (Equipment selected, Muscle, Pattern, Timed), active-filter pills, rows with a pictogram, Timed tag. |
| `exports/12-exercise-detail-light.png` / `exports/12-exercise-detail-dark.png` | Exercise detail: large pictogram, level and equipment pills, muscles, how-to text, form video link. |
| `exports/13-builder-day-light.png` / `exports/13-builder-day-dark.png` | Builder day editor: AMRAP slot, a superset group (A1/A2, rest 90 s, ungroup), progression picker (AMRAP / Linear / Double / Ladder) with a ladder picker. |
| `exports/14-gym-equipment-light.png` / `exports/14-gym-equipment-dark.png` | Gym equipment checklist with resistance bands (colour, label, reorder), kettlebell sizes, and the ease-back toggle. |
| `exports/15-finish-discard-light.png` / `exports/15-finish-discard-dark.png` | "Finish or discard the current workout?" dialog over Today: Resume it, Discard it, Cancel. |
| `exports/16-session-superset-light.png` / `exports/16-session-superset-dark.png` | Session, superset: A1 done, A2 current with reps stepper, rest shown only after the pair. |
| `exports/17-timer-emom-light.png` / `exports/17-timer-emom-dark.png` | EMOM timer running: minute 4 of 10, 0:37 left, current exercise, next up, minute progress, pause / skip / end early. |
| `exports/18-timer-interval-light.png` / `exports/18-timer-interval-dark.png` | Interval timer in the work phase: round 3 of 8, 0:14 countdown, next phase (rest 10 s). |
| `exports/19-health-light.png` / `exports/19-health-dark.png` | Health settings: toggle, permission state, last sync, "Export past workouts", privacy note. |
| `exports/20-health-denied-light.png` / `exports/20-health-denied-dark.png` | Health settings when permission is denied and the last sync failed: open system Settings, export disabled. |
| `exports/21-generate-questions-light.png` / `exports/21-generate-questions-dark.png` | Generate a program, questions: goal, days a week, session length, equipment (prefilled), experience; link to "Describe it". |
| `exports/22-generate-describe-light.png` / `exports/22-generate-describe-dark.png` | Generate a program, "Describe it": text box with 500-character counter, on-device model ready. |
| `exports/23-generate-result-light.png` / `exports/23-generate-result-dark.png` | Generate a program, result preview: days and exercises, validation ticks, Review in builder (never starts on its own), Discard. |
| `exports/24-generate-unavailable-light.png` / `exports/24-generate-unavailable-dark.png` | "Describe it" unavailable (Apple Intelligence off): disabled box, reason, questions still work. |
| `exports/25-siri-settings-light.png` / `exports/25-siri-settings-dark.png` | Settings with the Siri and Shortcuts tile: three spoken phrases and an Open in Shortcuts button. |
| `exports/26-storage-recovery-light.png` / `exports/26-storage-recovery-dark.png` | Storage recovery: "Your data could not be read", Try again, Export raw file, Restore backup, latest backup line. |

## Not mocked

Generate-program states other than ready, result and unavailable (generating, timed out, refused by the model,
invalid output, downloading); the Android Health Connect wording; large-text and iPad layouts.
