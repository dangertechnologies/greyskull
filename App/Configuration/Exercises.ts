import { IExerciseConfiguration, IRepetition } from '../Providers/Types';
import Icons from './Icons';

const DEFAULT_REPS: IRepetition[] = [
  { count: 5, weightFactor: 0.5 },
  { count: 4, weightFactor: 0.55 },
  { count: 3, weightFactor: 0.7 },
  { count: 2, weightFactor: 0.85 },
  { count: 5, weightFactor: 1 },
  { count: 5, weightFactor: 1 },
  { count: null, weightFactor: 1 },
];

const AMRAP_REPS_WITH_SETS: IRepetition[] = [
  { count: 5, weightFactor: 1 },
  { count: 5, weightFactor: 1 },
  { count: null, weightFactor: 1 },
];

const AMRAP_REPS_ONLY: IRepetition[] = [
  { count: null, weightFactor: 1 },
  { count: null, weightFactor: 1 },
];

const DEFAULT_EXERCISES: IExerciseConfiguration[] = [
  {
    badForm: ['Arc your back', 'Lift heels off the ground'],
    goodForm: ['Squat all the way down', 'Align knees and toes', 'Keep back straight'],
    icon: 'squat',
    include: 'REQUIRED',
    incrementFactor: 2,
    initialWeight: null,
    name: 'Barbell Squat',
    reps: DEFAULT_REPS,
    shortName: 'Squat',
    slot: 'ODD',
  },

  {
    badForm: [],
    goodForm: [],
    icon: 'deadlift',
    include: 'REQUIRED',
    incrementFactor: 2,
    initialWeight: null,
    name: 'Deadlift',
    reps: DEFAULT_REPS,
    shortName: 'Deadlift',
    slot: 'EVEN',
  },

  {
    badForm: [],
    goodForm: [],
    icon: 'incline-push',
    include: 'REQUIRED',
    incrementFactor: 1,
    initialWeight: null,
    name: 'Bench-press',
    reps: DEFAULT_REPS,
    shortName: 'Bench',
    slot: 'ODD',
  },

  {
    badForm: [],
    goodForm: [],
    icon: 'military-press',
    include: 'REQUIRED',
    incrementFactor: 1,
    initialWeight: null,
    name: 'Military press',
    reps: DEFAULT_REPS,
    shortName: 'Press',
    slot: 'EVEN',
  },

  {
    badForm: [],
    goodForm: [],
    icon: 'pullups',
    include: 'REQUIRED',
    incrementFactor: 1,
    initialWeight: null,
    name: 'Chin-up',
    reps: AMRAP_REPS_ONLY,
    shortName: 'Chin',
    slot: 'ODD',
  },

  {
    badForm: [],
    goodForm: [],
    icon: 'curls',
    include: 'REQUIRED',
    incrementFactor: 1,
    initialWeight: null,
    name: 'Curls',
    reps: AMRAP_REPS_ONLY,
    shortName: 'Curls',
    slot: 'EVEN',
  },
];

const OPTIONAL_EXERCISES: IExerciseConfiguration[] = [
  {
    badForm: [],
    goodForm: [],
    icon: 'crunches',
    include: 'EXCLUDED',
    incrementFactor: 1,
    initialWeight: null,
    name: 'Weighted crunches',
    reps: AMRAP_REPS_WITH_SETS,
    shortName: 'Crunches',
    slot: 'EVERY',
  },

  {
    badForm: [],
    goodForm: [],
    icon: 'row',
    include: 'EXCLUDED',
    incrementFactor: 1,
    initialWeight: null,
    name: 'Bent-over row',
    reps: AMRAP_REPS_WITH_SETS,
    shortName: 'Incline row',
    slot: 'EVERY',
  },
];

export default [...DEFAULT_EXERCISES, ...OPTIONAL_EXERCISES];
