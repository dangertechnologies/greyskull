/**
 * Training plan catalogue. Each plan is plain data: the days, the schemes, the progression model and which
 * optional extras (plugins) make sense for it. The setup flow lists these in order; adding a plan here is all
 * it takes to offer it.
 *
 * `experimental` plans use progression models or day intensities that have unit tests but have not been run
 * through a real training block in the app yet. They are labelled as such in the UI.
 */

import { getLadder } from '../domain/ladders';
import type { Group, Program, Rules, Scheme, Slot } from '../domain/types';
import { DEFAULT_RULES } from '../domain/types';

export type PluginId = 'curls' | 'chins' | 'dips' | 'abs' | 'rows_instead_of_chins';

export type PlanCategory = 'strength' | 'hypertrophy' | 'calisthenics' | 'skills' | 'mobility';

export interface PlanDefinition {
  id: string;
  name: string;
  /** One line for the picker card. */
  summary: string;
  /** A few sentences on how the plan works, shown when it is selected. */
  description: string;
  status: 'stable' | 'experimental';
  /** Where the plan sits in the picker. */
  category: PlanCategory;
  /** Optional extras offered on the Options screen. */
  plugins: PluginId[];
  program: Program;
}

const press = 'MILITARY_PRESS';
const bench = 'BENCH_PRESS';
const squat = 'BARBELL_SQUAT';
const deadlift = 'DEADLIFT';
const row = 'BENT_OVER_ROW';

/** A slot that walks a ladder: it starts at the ladder's first step and moves up by ladder progression. */
function ladderSlot(ladder: string, scheme: Scheme, group?: string): Slot {
  const first = getLadder(ladder)?.steps[0].exercise;
  if (!first) throw new Error(`Unknown ladder ${ladder}`);
  return { exercise: first, scheme, progression: 'ladder', ladder, ...(group ? { group } : {}) };
}

const superset = (id: string): Group => ({ id, kind: 'superset', restS: 90 });

const rules = (patch: Partial<Rules>): Rules => ({ ...DEFAULT_RULES, ...patch });

export const PLANS: PlanDefinition[] = [
  {
    id: 'base',
    name: 'Greyskull LP',
    summary: 'Press/Bench alternate · Squat Mon & Fri · Deadlift Wed',
    description:
      'Two work sets, the last one as many reps as possible. Five or more reps adds weight, ten or more adds double. Miss twice in a row and the lift drops 10 %.',
    status: 'stable',
    category: 'strength',
    plugins: ['curls', 'chins', 'dips', 'abs'],
    program: {
      template: 'base',
      sessionsPerWeek: 3,
      rules: DEFAULT_RULES,
      days: [
        {
          name: 'Day 1',
          slots: [
            { exercise: [press, bench], scheme: '2x5+' },
            { exercise: squat, scheme: '2x5+' },
          ],
        },
        {
          name: 'Day 2',
          slots: [
            { exercise: [press, bench], scheme: '2x5+' },
            { exercise: deadlift, scheme: '1x5+' },
          ],
        },
        {
          name: 'Day 3',
          slots: [
            { exercise: [press, bench], scheme: '2x5+' },
            { exercise: squat, scheme: '2x5+' },
          ],
        },
      ],
    },
  },
  {
    id: 'phrak',
    name: "Phrak's GSLP",
    summary: 'A: Chins, Press, Squat · B: Rows, Bench, Deadlift',
    description:
      'The popular r/fitness variant of Greyskull LP with a pull on every day. Same AMRAP progression as Greyskull LP.',
    status: 'stable',
    category: 'strength',
    plugins: ['curls', 'dips', 'abs', 'rows_instead_of_chins'],
    program: {
      template: 'phrak',
      sessionsPerWeek: 3,
      rules: DEFAULT_RULES,
      days: [
        {
          name: 'A',
          slots: [
            { exercise: 'CHINUPS', scheme: '2x5+' },
            { exercise: press, scheme: '2x5+' },
            { exercise: squat, scheme: '2x5+' },
          ],
        },
        {
          name: 'B',
          slots: [
            { exercise: row, scheme: '2x5+' },
            { exercise: bench, scheme: '2x5+' },
            { exercise: deadlift, scheme: '1x5+' },
          ],
        },
      ],
    },
  },
  {
    id: 'stronglifts',
    name: 'StrongLifts 5×5',
    summary: 'A: Squat, Bench, Row · B: Squat, Press, Deadlift',
    description:
      'Five sets of five, no AMRAP. Hit every rep and the weight goes up next time (deadlift twice as fast). Miss three sessions in a row and the lift drops 10 %.',
    status: 'experimental',
    category: 'strength',
    plugins: ['curls', 'dips', 'abs'],
    program: {
      template: 'stronglifts',
      sessionsPerWeek: 3,
      rules: rules({
        progression: 'linear',
        failsBeforeDeload: 2,
        increments: {
          [squat]: { kg: 2.5, lb: 5 },
          [bench]: { kg: 2.5, lb: 5 },
          [row]: { kg: 2.5, lb: 5 },
          [press]: { kg: 2.5, lb: 5 },
          [deadlift]: { kg: 5, lb: 10 },
        },
      }),
      days: [
        {
          name: 'A',
          slots: [
            { exercise: squat, scheme: '5x5' },
            { exercise: bench, scheme: '5x5' },
            { exercise: row, scheme: '5x5' },
          ],
        },
        {
          name: 'B',
          slots: [
            { exercise: squat, scheme: '5x5' },
            { exercise: press, scheme: '5x5' },
            { exercise: deadlift, scheme: '1x5' },
          ],
        },
      ],
    },
  },
  {
    id: 'starting-strength',
    name: 'Starting Strength',
    summary: 'Squat every session · Press/Bench alternate · Deadlift 1×5',
    description:
      'The novice phase: three sets of five on squat and the presses, one heavy set of deadlifts. Every completed session adds weight. Miss three in a row and the lift drops 10 %.',
    status: 'experimental',
    category: 'strength',
    plugins: ['chins', 'dips', 'abs'],
    program: {
      template: 'starting-strength',
      sessionsPerWeek: 3,
      rules: rules({
        progression: 'linear',
        failsBeforeDeload: 2,
        increments: { [squat]: { kg: 2.5, lb: 5 }, [deadlift]: { kg: 5, lb: 10 } },
      }),
      days: [
        {
          name: 'A',
          slots: [
            { exercise: squat, scheme: '3x5' },
            { exercise: press, scheme: '3x5' },
            { exercise: deadlift, scheme: '1x5' },
          ],
        },
        {
          name: 'B',
          slots: [
            { exercise: squat, scheme: '3x5' },
            { exercise: bench, scheme: '3x5' },
            { exercise: deadlift, scheme: '1x5' },
          ],
        },
      ],
    },
  },
  {
    id: 'allpro',
    name: "AllPro's Beginner Routine",
    summary: 'Full body · Heavy, Light (80 %), Medium (90 %) · 8–12 reps',
    description:
      'Every session trains the whole body for two sets. Each week the heavy day asks for one more rep (8 → 12); after a week at 12 the weight goes up and reps start at 8 again. Light and medium days use 80 % and 90 % of the heavy weight and never change it. Approximation of the published routine.',
    status: 'experimental',
    category: 'hypertrophy',
    plugins: ['dips', 'abs'],
    program: {
      template: 'allpro',
      sessionsPerWeek: 3,
      rules: rules({ progression: 'double', failsBeforeDeload: 1 }),
      days: (
        [
          ['Heavy', 1],
          ['Light', 0.8],
          ['Medium', 0.9],
        ] as const
      ).map(([name, intensity]) => ({
        name,
        ...(intensity < 1 ? { intensity } : {}),
        slots: [
          { exercise: squat, scheme: '2x8-12' as const },
          { exercise: bench, scheme: '2x8-12' as const },
          { exercise: row, scheme: '2x8-12' as const },
          { exercise: press, scheme: '2x8-12' as const },
          { exercise: 'CURLS', scheme: '2x8-12' as const },
        ],
      })),
    },
  },
  {
    id: 'lyle-gbr',
    name: "Lyle McDonald's Generic Bulking Routine",
    summary: '4 days · Upper/lower split · Compound lifts and isolation work',
    description:
      'A four-day upper/lower split for muscle growth, training each muscle twice a week with heavier compounds at 6–8 reps and lighter work at 10–15. Build reps to the top of each range, then add weight and start at the bottom again. Lyle recommends about two weeks of submaximal ramp-up before pushing to add weight each workout; manage those starting loads yourself. Approximation of the published routine.',
    status: 'experimental',
    category: 'hypertrophy',
    plugins: [],
    program: {
      template: 'lyle-gbr',
      sessionsPerWeek: 4,
      rules: rules({ progression: 'double', failsBeforeDeload: 1 }),
      days: [
        {
          name: 'Upper 1',
          slots: [
            { exercise: bench, scheme: '3x6-8' },
            { exercise: 'SEATED_CABLE_ROW', scheme: '3x6-8' },
            { exercise: 'DB_SHOULDER_PRESS', scheme: '2x10-12' },
            { exercise: 'LAT_PULLDOWN', scheme: '2x10-12' },
            { exercise: 'TRICEP_PUSHDOWN', scheme: '2x12-15' },
            { exercise: 'CURLS', scheme: '2x12-15' },
          ],
        },
        {
          name: 'Lower 1',
          slots: [
            { exercise: squat, scheme: '3x6-8' },
            { exercise: 'ROMANIAN_DEADLIFT', scheme: '3x6-8' },
            { exercise: 'LEG_PRESS', scheme: '2x10-12' },
            { exercise: 'LEG_CURL', scheme: '2x10-12' },
            { exercise: 'CALF_RAISE', scheme: '3x6-8' },
          ],
        },
        {
          name: 'Upper 2',
          slots: [
            { exercise: 'INCLINE_BENCH_PRESS', scheme: '3x6-8' },
            { exercise: row, scheme: '3x6-8' },
            { exercise: press, scheme: '2x10-12' },
            { exercise: 'DUMBBELL_ROW', scheme: '2x10-12' },
            { exercise: 'TRICEP_PUSHDOWN', scheme: '2x12-15' },
            { exercise: 'CURLS', scheme: '2x12-15' },
          ],
        },
        {
          name: 'Lower 2',
          slots: [
            { exercise: squat, scheme: '3x6-8' },
            { exercise: 'ROMANIAN_DEADLIFT', scheme: '3x6-8' },
            { exercise: 'LEG_PRESS', scheme: '2x10-12' },
            { exercise: 'LEG_CURL', scheme: '2x10-12' },
            { exercise: 'CALF_RAISE', scheme: '3x6-8' },
          ],
        },
      ],
    },
  },
  {
    id: 'full-body-hypertrophy',
    name: 'Full Body Hypertrophy',
    summary: '3 days · Squat, presses, rows and accessories · 8–15 reps',
    description:
      'Three full-body days rotate squats, presses, hinges and pulls, with smaller exercises at the end. Complete every set at the current rep target to add a rep next time; reach the top of the range to add weight and return to the bottom. Suits lifters who want muscle-building work across three sessions a week.',
    status: 'experimental',
    category: 'hypertrophy',
    plugins: [],
    program: {
      template: 'full-body-hypertrophy',
      sessionsPerWeek: 3,
      rules: rules({ progression: 'double', failsBeforeDeload: 1 }),
      days: [
        {
          name: 'A',
          slots: [
            { exercise: squat, scheme: '3x8-12' },
            { exercise: bench, scheme: '3x8-12' },
            { exercise: 'SEATED_CABLE_ROW', scheme: '3x8-12' },
            { exercise: 'DB_LATERAL_RAISE', scheme: '2x12-15' },
          ],
        },
        {
          name: 'B',
          slots: [
            { exercise: 'ROMANIAN_DEADLIFT', scheme: '3x8-12' },
            { exercise: press, scheme: '3x8-12' },
            { exercise: 'LAT_PULLDOWN', scheme: '3x8-12' },
            { exercise: 'LEG_CURL', scheme: '2x12-15' },
            { exercise: 'CURLS', scheme: '2x12-15' },
          ],
        },
        {
          name: 'C',
          slots: [
            { exercise: 'LEG_PRESS', scheme: '3x8-12' },
            { exercise: 'INCLINE_BENCH_PRESS', scheme: '3x8-12' },
            { exercise: 'DUMBBELL_ROW', scheme: '3x8-12' },
            { exercise: 'CALF_RAISE', scheme: '2x12-15' },
            { exercise: 'TRICEP_PUSHDOWN', scheme: '2x12-15' },
          ],
        },
      ],
    },
  },
  {
    id: 'shoulder-mobilex',
    name: 'Shoulder-MOBILEX',
    summary: '3 days · Five dumbbell exercises for shoulders and shoulder blades',
    description:
      'Developed for people with hypermobile shoulders (HSD/hEDS), the 16-week study used five dumbbell exercises for the rotator cuff and shoulder-blade muscles three times a week, with two sessions supervised by a physiotherapist. Weeks 1–3 built from about 50 % to 90 % of a 10-rep max, weeks 4–9 used 3×10 and weeks 10–15 used 4×8; adjust loads and change the scheme in Plan to follow those phases. This version uses 3×10–12, adding weight at the top of the range; only log completed reps with good movement quality. Approximation of the published routine.',
    status: 'experimental',
    category: 'mobility',
    plugins: [],
    program: {
      template: 'shoulder-mobilex',
      sessionsPerWeek: 3,
      rules: rules({ progression: 'double', failsBeforeDeload: 2, warmups: false }),
      days: [
        {
          name: 'Shoulder',
          slots: [
            { exercise: 'SIDELYING_EXTERNAL_ROTATION', scheme: '3x10-12' },
            { exercise: 'PRONE_HORIZONTAL_ABDUCTION', scheme: '3x10-12' },
            { exercise: 'PRONE_EXTERNAL_ROTATION', scheme: '3x10-12' },
            { exercise: 'SUPINE_PROTRACTION', scheme: '3x10-12' },
            { exercise: 'SCAPTION', scheme: '3x10-12' },
          ],
        },
      ],
    },
  },
  {
    id: 'gzclp',
    name: 'GZCLP',
    summary: '4 days · Squat, bench, deadlift and press · Three tiers',
    description:
      'Four days combine heavy low-rep T1 work, lighter T2 work and high-rep T3 pulls, suiting beginners who want several rep ranges. Successful T1 and T2 sessions add weight; a failed session moves T1 through 5×3+ → 6×2+ → 10×1+ and T2 through 3×10 → 3×8 → 3×6, while T3 adds weight when all sets meet 15 reps and the last reaches 25. After failing the final stage, the app drops the weight 15 % and restarts stage 1 instead of the published retest. Approximation of the published routine.',
    status: 'experimental',
    category: 'strength',
    plugins: [],
    program: {
      template: 'gzclp',
      sessionsPerWeek: 4,
      rules: rules({
        progression: 'stages',
        deloadPct: 0.15,
        increments: {
          [bench]: { kg: 2.5, lb: 5 },
          [press]: { kg: 2.5, lb: 5 },
          [squat]: { kg: 5, lb: 10 },
          [deadlift]: { kg: 5, lb: 10 },
          LAT_PULLDOWN: { kg: 2.5, lb: 5 },
          DUMBBELL_ROW: { kg: 2.5, lb: 5 },
        },
      }),
      days: [
        {
          name: 'Day 1',
          slots: [
            { exercise: squat, scheme: '5x3+', stages: ['5x3+', '6x2+', '10x1+'] },
            { exercise: bench, lift: 'BENCH_PRESS@T2', scheme: '3x10', stages: ['3x10', '3x8', '3x6'] },
            {
              exercise: 'LAT_PULLDOWN',
              progression: 'linear',
              scheme: '3x15+',
              stages: ['3x15+'],
              advanceAt: 25,
            },
          ],
        },
        {
          name: 'Day 2',
          slots: [
            { exercise: press, scheme: '5x3+', stages: ['5x3+', '6x2+', '10x1+'] },
            { exercise: deadlift, lift: 'DEADLIFT@T2', scheme: '3x10', stages: ['3x10', '3x8', '3x6'] },
            {
              exercise: 'DUMBBELL_ROW',
              progression: 'linear',
              scheme: '3x15+',
              stages: ['3x15+'],
              advanceAt: 25,
            },
          ],
        },
        {
          name: 'Day 3',
          slots: [
            { exercise: bench, scheme: '5x3+', stages: ['5x3+', '6x2+', '10x1+'] },
            { exercise: squat, lift: 'BARBELL_SQUAT@T2', scheme: '3x10', stages: ['3x10', '3x8', '3x6'] },
            {
              exercise: 'LAT_PULLDOWN',
              progression: 'linear',
              scheme: '3x15+',
              stages: ['3x15+'],
              advanceAt: 25,
            },
          ],
        },
        {
          name: 'Day 4',
          slots: [
            { exercise: deadlift, scheme: '5x3+', stages: ['5x3+', '6x2+', '10x1+'] },
            { exercise: press, lift: 'MILITARY_PRESS@T2', scheme: '3x10', stages: ['3x10', '3x8', '3x6'] },
            {
              exercise: 'DUMBBELL_ROW',
              progression: 'linear',
              scheme: '3x15+',
              stages: ['3x15+'],
              advanceAt: 25,
            },
          ],
        },
      ],
    },
  },
  {
    id: '531-beginners',
    name: '5/3/1 for Beginners',
    summary: '3 days · Two main barbell lifts plus push, pull and core assistance',
    description:
      'For beginners who want steady barbell progression, three-week waves use 65/75/85 % ×5, 70/80/90 % ×3 and 75/85/95 % ×5/3/1 of a training max, with the last set AMRAP, then 5×5 First Set Last at the first set’s weight. Enter a training max starting at 90 % of your estimated one-rep max; each three-week cycle adds 2.5 kg (5 lb) for bench and press or 5 kg (10 lb) for squat and deadlift. Each day includes push, pull and single-leg/core assistance aiming for 50–100 total reps each, represented here by five AMRAP sets of dips, chin-ups and crunches. The periodic training-max test week is not built in; approximation of the published routine.',
    status: 'experimental',
    category: 'strength',
    plugins: [],
    program: {
      template: '531-beginners',
      sessionsPerWeek: 3,
      rules: rules({
        progression: 'double',
        failsBeforeDeload: 2,
        increments: {
          [bench]: { kg: 2.5, lb: 5 },
          [press]: { kg: 2.5, lb: 5 },
          [squat]: { kg: 5, lb: 10 },
          [deadlift]: { kg: 5, lb: 10 },
        },
      }),
      days: [
        {
          name: 'Day 1',
          slots: [
            { exercise: squat, progression: '531', scheme: '3x5+' },
            { exercise: bench, progression: '531', scheme: '3x5+' },
            { exercise: 'DIPS', scheme: '5xAMRAP' },
            { exercise: 'CHINUPS', scheme: '5xAMRAP' },
            { exercise: 'CRUNCHES', scheme: '5xAMRAP' },
          ],
        },
        {
          name: 'Day 2',
          slots: [
            { exercise: deadlift, progression: '531', scheme: '3x5+' },
            { exercise: press, progression: '531', scheme: '3x5+' },
            { exercise: 'DIPS', scheme: '5xAMRAP' },
            { exercise: 'CHINUPS', scheme: '5xAMRAP' },
            { exercise: 'CRUNCHES', scheme: '5xAMRAP' },
          ],
        },
        {
          name: 'Day 3',
          slots: [
            { exercise: bench, progression: '531', scheme: '3x5+' },
            { exercise: squat, progression: '531', scheme: '3x5+' },
            { exercise: 'DIPS', scheme: '5xAMRAP' },
            { exercise: 'CHINUPS', scheme: '5xAMRAP' },
            { exercise: 'CRUNCHES', scheme: '5xAMRAP' },
          ],
        },
      ],
    },
  },
  {
    id: 'recommended-routine',
    name: 'Recommended Routine',
    summary: '3 days a week · Three supersets of pull, push and legs, then a core circuit',
    description:
      'One full-body bodyweight day, repeated three times a week. Pull-up and squat, dip and hinge, row and push-up are paired as supersets with 90 seconds of rest, then a core circuit of anti-extension, anti-rotation and back extension for three rounds. Every exercise sits on a ladder of harder variations: hit your target on every set and the next session asks for one more rep; once you hit the top of the range on every set, the next session starts the following variation back at the bottom of its range. Based on the routine recommended by the r/bodyweightfitness community; the progressions and wording are our own.',
    status: 'experimental',
    category: 'calisthenics',
    plugins: [],
    program: {
      template: 'recommended-routine',
      sessionsPerWeek: 3,
      rules: DEFAULT_RULES,
      days: [
        {
          name: 'Full body',
          groups: [
            superset('s1'),
            superset('s2'),
            superset('s3'),
            { id: 'core', kind: 'circuit', rounds: 3, restS: 60 },
          ],
          slots: [
            ladderSlot('rr_pullup', '3x5-8', 's1'),
            ladderSlot('rr_squat', '3x5-8', 's1'),
            ladderSlot('rr_dip', '3x5-8', 's2'),
            ladderSlot('rr_hinge', '3x5-8', 's2'),
            ladderSlot('rr_row', '3x5-8', 's3'),
            ladderSlot('rr_pushup', '3x5-8', 's3'),
            ladderSlot('rr_antiextension', '3x8-12', 'core'),
            ladderSlot('rr_antirotation', '3x8-12', 'core'),
            ladderSlot('rr_extension', '3x8-12', 'core'),
          ],
        },
      ],
    },
  },
  {
    id: 'six-ladders',
    name: 'Six Ladders',
    summary: '3 days · Push-up, pull-up, squat, leg raise, bridge and handstand push-up ladders',
    description:
      'Six exercises, each with its own ten-step ladder from an easy variation up to a one-arm or one-leg version. The days rotate: push-up and leg raise, pull-up and squat, handstand push-up and bridge. Each step has its own rep range, so steps early on ask for more reps and later steps for fewer. Hit your target on every set and the next session asks for one more rep; hit the top of the range on every set and you move up one step, never skipping one. Inspired by the ten-step progressions shared on r/bodyweightfitness; the steps and wording are our own.',
    status: 'experimental',
    category: 'calisthenics',
    plugins: [],
    program: {
      template: 'six-ladders',
      sessionsPerWeek: 3,
      rules: DEFAULT_RULES,
      days: [
        {
          name: 'Push-up and leg raise',
          slots: [ladderSlot('six_pushup', '3x8-15'), ladderSlot('six_legraise', '3x8-15')],
        },
        {
          name: 'Pull-up and squat',
          slots: [ladderSlot('six_pullup', '3x8-15'), ladderSlot('six_squat', '3x8-15')],
        },
        {
          name: 'Handstand push-up and bridge',
          slots: [ladderSlot('six_hspu', '3x5-10'), ladderSlot('six_bridge', '3x8-15')],
        },
      ],
    },
  },
  {
    id: 'skill-track',
    name: 'Skill Track',
    summary: '3 days · Handstand, front lever, L-sit, planche and muscle-up holds',
    description:
      'A short skill session meant to run beside another program. Day A works the handstand, front lever and L-sit; day B works the handstand again, the planche and the muscle-up. Holds run for 10 to 30 seconds (shorter ranges on the hardest steps): hit your target on every set and the next session asks for five seconds more; hit the top of the range on every set and you move to the next harder variation. Muscle-up steps count reps. Skills lean on community progressions such as those shared on r/bodyweightfitness; the steps and wording are our own.',
    status: 'experimental',
    category: 'skills',
    plugins: [],
    program: {
      template: 'skill-track',
      sessionsPerWeek: 3,
      rules: DEFAULT_RULES,
      days: [
        {
          name: 'A',
          slots: [
            ladderSlot('skill_handstand', '3x10-30s'),
            ladderSlot('skill_front_lever', '3x10-30s'),
            ladderSlot('skill_lsit', '3x10-30s'),
          ],
        },
        {
          name: 'B',
          slots: [
            ladderSlot('skill_handstand', '3x10-30s'),
            ladderSlot('skill_planche', '3x10-30s'),
            ladderSlot('skill_muscleup', '3x3-5'),
          ],
        },
      ],
    },
  },
  {
    id: 'hybrid',
    name: 'Hybrid',
    summary: 'A/B days · Squat or deadlift with pull-up, dip or row, push-up and a core ladder',
    description:
      'Barbell and bodyweight in one program. Day A is the squat with pull-up, dip and anti-extension core ladders; day B is the deadlift with row, push-up and the same core ladder. The barbell lifts are two sets of five with the last set as many reps as possible: five or more adds weight, ten or more adds double. The bodyweight lifts climb their ladders, and the pull-up, dip and push-up ladders continue with added weight after their top step. The core ladder is trained on both days, so it advances about twice as fast as the others. Pairs a Greyskull-style barbell base with the bodyweight ladders popular on r/bodyweightfitness; the choice of exercises and wording are our own.',
    status: 'experimental',
    category: 'calisthenics',
    plugins: [],
    program: {
      template: 'hybrid',
      sessionsPerWeek: 3,
      rules: DEFAULT_RULES,
      days: [
        {
          name: 'A',
          slots: [
            { exercise: squat, scheme: '2x5+' },
            ladderSlot('rr_pullup', '3x5-8'),
            ladderSlot('rr_dip', '3x5-8'),
            ladderSlot('rr_antiextension', '3x8-12'),
          ],
        },
        {
          name: 'B',
          slots: [
            { exercise: deadlift, scheme: '2x5+' },
            ladderSlot('rr_row', '3x5-8'),
            ladderSlot('rr_pushup', '3x5-8'),
            ladderSlot('rr_antiextension', '3x8-12'),
          ],
        },
      ],
    },
  },
];

export function getPlan(id: string): PlanDefinition | undefined {
  return PLANS.find((p) => p.id === id);
}
