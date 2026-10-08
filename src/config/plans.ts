/**
 * Training plan catalogue. Each plan is plain data: the days, the schemes, the progression model and which
 * optional extras (plugins) make sense for it. The setup flow lists these in order; adding a plan here is all
 * it takes to offer it.
 *
 * `experimental` plans use progression models or day intensities that have unit tests but have not been run
 * through a real training block in the app yet. They are labelled as such in the UI.
 */
import { DEFAULT_RULES } from '../domain/types';
import type { Program, Rules } from '../domain/types';

export type PluginId = 'curls' | 'chins' | 'dips' | 'abs' | 'rows_instead_of_chins';

export interface PlanDefinition {
  id: string;
  name: string;
  /** One line for the picker card. */
  summary: string;
  /** A few sentences on how the plan works, shown when it is selected. */
  description: string;
  status: 'stable' | 'experimental';
  /** Optional extras offered on the Options screen. */
  plugins: PluginId[];
  program: Program;
}

const press = 'MILITARY_PRESS';
const bench = 'BENCH_PRESS';
const squat = 'BARBELL_SQUAT';
const deadlift = 'DEADLIFT';
const row = 'BENT_OVER_ROW';

const rules = (patch: Partial<Rules>): Rules => ({ ...DEFAULT_RULES, ...patch });

export const PLANS: PlanDefinition[] = [
  {
    id: 'base',
    name: 'Greyskull LP',
    summary: 'Press/Bench alternate · Squat Mon & Fri · Deadlift Wed',
    description:
      'Two work sets, the last one as many reps as possible. Five or more reps adds weight, ten or more adds double. Miss twice in a row and the lift drops 10 %.',
    status: 'stable',
    plugins: ['curls', 'chins', 'dips', 'abs'],
    program: {
      template: 'base',
      sessionsPerWeek: 3,
      rules: DEFAULT_RULES,
      days: [
        { name: 'Day 1', slots: [{ exercise: [press, bench], scheme: '2x5+' }, { exercise: squat, scheme: '2x5+' }] },
        { name: 'Day 2', slots: [{ exercise: [press, bench], scheme: '2x5+' }, { exercise: deadlift, scheme: '1x5+' }] },
        { name: 'Day 3', slots: [{ exercise: [press, bench], scheme: '2x5+' }, { exercise: squat, scheme: '2x5+' }] },
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
        { name: 'A', slots: [{ exercise: squat, scheme: '5x5' }, { exercise: bench, scheme: '5x5' }, { exercise: row, scheme: '5x5' }] },
        { name: 'B', slots: [{ exercise: squat, scheme: '5x5' }, { exercise: press, scheme: '5x5' }, { exercise: deadlift, scheme: '1x5' }] },
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
        { name: 'A', slots: [{ exercise: squat, scheme: '3x5' }, { exercise: press, scheme: '3x5' }, { exercise: deadlift, scheme: '1x5' }] },
        { name: 'B', slots: [{ exercise: squat, scheme: '3x5' }, { exercise: bench, scheme: '3x5' }, { exercise: deadlift, scheme: '1x5' }] },
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
];

export function getPlan(id: string): PlanDefinition | undefined {
  return PLANS.find((p) => p.id === id);
}
