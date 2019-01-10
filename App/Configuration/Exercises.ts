import { ExerciseConfiguration, Repetition } from "../Apollo/Types";
import Icons from "./Icons";

type ExerciseConfig = Pick<
  ExerciseConfiguration,
  Exclude<keyof ExerciseConfiguration, "id" | "initialWeight">
> & { icon: keyof typeof Icons };

type Exercises = {
  [key: string]: ExerciseConfig;
};

const DEFAULT_REPS: Repetition[] = [
  { count: 5, weightFactor: 0.5 },
  { count: 4, weightFactor: 0.55 },
  { count: 3, weightFactor: 0.7 },
  { count: 2, weightFactor: 0.85 },
  { count: 5, weightFactor: 1 },
  { count: 5, weightFactor: 1 },
  { count: null, weightFactor: 1 }
].map(rep => ({ __typename: "Repetition", ...rep }));

const AMRAP_REPS_WITH_SETS = [
  { count: 5, weightFactor: 1 },
  { count: 5, weightFactor: 1 },
  { count: null, weightFactor: 1 }
].map(rep => ({ __typename: "Repetition", ...rep }));

const AMRAP_REPS_ONLY = [
  { count: null, weightFactor: 1 },
  { count: null, weightFactor: 1 }
].map(rep => ({ __typename: "Repetition", ...rep }));

const DEFAULT_EXERCISES: Exercises = {
  BARBELL_SQUAT: {
    include: "REQUIRED",
    name: "Barbell Squat",
    shortName: "Squat",
    icon: "squat",
    incrementFactor: 2,
    slot: "ODD",
    goodForm: [],
    badForm: [],
    reps: DEFAULT_REPS
  },

  DEADLIFT: {
    include: "REQUIRED",
    name: "Deadlift",
    shortName: "Deadlift",
    icon: "deadlift",
    incrementFactor: 2,
    slot: "EVEN",
    goodForm: [],
    badForm: [],
    reps: DEFAULT_REPS
  },

  BENCH_PRESS: {
    include: "REQUIRED",
    name: "Bench-press",
    shortName: "Bench",
    icon: "incline-push",
    incrementFactor: 1,
    slot: "ODD",
    goodForm: [],
    badForm: [],
    reps: DEFAULT_REPS
  },

  MILITARY_PRESS: {
    include: "REQUIRED",
    name: "Military press",
    shortName: "Press",
    icon: "military-press",
    incrementFactor: 1,
    slot: "EVEN",
    goodForm: [],
    badForm: [],
    reps: DEFAULT_REPS
  },

  CHIN_UP: {
    include: "REQUIRED",
    name: "Chin-up",
    shortName: "Chin",
    icon: "pullups",
    incrementFactor: 1,
    slot: "ODD",
    goodForm: [],
    badForm: [],
    reps: AMRAP_REPS_ONLY
  },

  CURLS: {
    include: "REQUIRED",
    name: "Curls",
    shortName: "Curls",
    icon: "curls",
    incrementFactor: 1,
    slot: "EVEN",
    goodForm: [],
    badForm: [],
    reps: AMRAP_REPS_ONLY
  }
};

const OPTIONAL_EXERCISES: Exercises = {
  CRUNCHES: {
    include: "EXCLUDED",
    name: "Weighted crunches",
    shortName: "Crunches",
    icon: "crunches",
    incrementFactor: 1,
    slot: "EVERY",
    goodForm: [],
    badForm: [],
    reps: AMRAP_REPS_WITH_SETS
  },

  BENT_OVER_ROW: {
    include: "EXCLUDED",
    name: "Bent-over row",
    shortName: "Incline row",
    icon: "row",
    incrementFactor: 1,
    slot: "EVERY",
    goodForm: [],
    badForm: [],
    reps: AMRAP_REPS_WITH_SETS
  }
};

export default { ...DEFAULT_EXERCISES, ...OPTIONAL_EXERCISES };
