export const typeDefs = ["enum DaySlot {\n  # Every second workout starting from the first\n  ODD\n\n  # Every second workout starting from the second\n  EVEN\n\n  # First workout every week\n  FIRST\n\n  # Second workout every week\n  SECOND\n\n  # Third workout every week\n  THIRD\n\n  # Every workout\n  EVERY\n}\n\ntype User {\n  id: Int!\n  configured: Boolean\n  schedule: WorkoutSchedule\n  upcomingWorkouts: [Workout!]\n  workouts: [Workout!]\n}\n\nenum ExerciseState {\n  REQUIRED\n  EXCLUDED\n  INCLUDED\n}\n\ntype Repetition {\n  # Multiply the weight by this number, e.g 0.9 for 90% of maxWeight\n  weightFactor: Float!\n\n  # How many times it should be completed. Set to null for AMRAP\n  count: Int\n}\n\ntype ExerciseConfiguration {\n  id: String!\n  name: String!\n  shortName: String!\n\n  # Whether or not this exercise is part of the default set\n  include: ExerciseState\n\n  # Icon should be a string matching an existing icon\n  icon: String!\n\n  # How much to increment with after a successful workout.\n  # If this is null, the user will be asked to manually\n  # increment it after the workout has completed.\n  incrementFactor: Float\n\n  # Users initial weight to start with\n  initialWeight: Float\n\n  # List of good form descriptions to display during workout\n  goodForm: [String!]!\n\n  # List of bad form descriptions to display during workout\n  badForm: [String!]!\n\n  # Sets to perform in each workout\n  reps: [Repetition!]!\n\n  slot: DaySlot\n}\n\ntype Exercise {\n  id: ID!\n  weight: Float!\n  completed: String\n  amrap: Int\n  config: ExerciseConfiguration\n}\n\ntype Workout {\n  id: ID!\n  steps: [Exercise!]!\n  completed: String\n}\n\ntype WorkoutSchedule {\n  id: ID!\n  exercises: [Exercise!]!\n}\n\ntype Query {\n  user: User\n  workout(id: Int!): Workout\n  exercises: [ExerciseConfiguration!]!\n}\n\ninput CompleteExerciseInput {\n  exerciseId: Int!\n}\n\ntype CompleteExercisePayload {\n  exercise: Exercise\n}\n\ninput CompleteWorkoutInput {\n  workoutId: Int!\n}\n\ntype CompleteWorkoutPayload {\n  workout: Workout\n}\n\ninput UpdateInitialWeightInput {\n  exerciseId: Int!\n  weight: Float!\n}\n\ntype UpdateInitialWeightPayload {\n  exercise: Exercise\n}\n\ninput IncludeExerciseInput {\n  exerciseId: Int!\n}\n\ntype IncludeExercisePayload {\n  exercise: Exercise\n}\n\ntype CompleteConfigurationPayload {\n  user: User\n}\n\ntype Mutation {\n  completeExercise(input: CompleteExerciseInput!): CompleteExercisePayload\n  completeWorkout(input: CompleteWorkoutInput!): CompleteWorkoutPayload\n  toggleIncludeExercise(input: IncludeExerciseInput!): IncludeExercisePayload\n  updateInitialWeight(\n    input: UpdateInitialWeightInput!\n  ): UpdateInitialWeightPayload\n  completeConfiguration: CompleteConfigurationPayload\n}\n"];
/* tslint:disable */

export interface Query {
  user: User | null;
  workout: Workout | null;
  exercises: Array<ExerciseConfiguration>;
}

export interface WorkoutQueryArgs {
  id: number;
}

export interface User {
  id: number;
  configured: boolean | null;
  schedule: WorkoutSchedule | null;
  upcomingWorkouts: Array<Workout>;
  workouts: Array<Workout>;
}

export interface WorkoutSchedule {
  id: string;
  exercises: Array<Exercise>;
}

export interface Exercise {
  id: string;
  weight: number;
  completed: string | null;
  amrap: number | null;
  config: ExerciseConfiguration | null;
}

export interface ExerciseConfiguration {
  id: string;
  name: string;
  shortName: string;
  include: ExerciseState | null;
  icon: string;
  incrementFactor: number | null;
  initialWeight: number | null;
  goodForm: Array<string>;
  badForm: Array<string>;
  reps: Array<Repetition>;
  slot: DaySlot | null;
}

export type ExerciseState = "REQUIRED" | "EXCLUDED" | "INCLUDED";

export interface Repetition {
  weightFactor: number;
  count: number | null;
}

export type DaySlot = "ODD" | "EVEN" | "FIRST" | "SECOND" | "THIRD" | "EVERY";

export interface Workout {
  id: string;
  steps: Array<Exercise>;
  completed: string | null;
}

export interface Mutation {
  completeExercise: CompleteExercisePayload | null;
  completeWorkout: CompleteWorkoutPayload | null;
  toggleIncludeExercise: IncludeExercisePayload | null;
  updateInitialWeight: UpdateInitialWeightPayload | null;
  completeConfiguration: CompleteConfigurationPayload | null;
}

export interface CompleteExerciseMutationArgs {
  input: CompleteExerciseInput;
}

export interface CompleteWorkoutMutationArgs {
  input: CompleteWorkoutInput;
}

export interface ToggleIncludeExerciseMutationArgs {
  input: IncludeExerciseInput;
}

export interface UpdateInitialWeightMutationArgs {
  input: UpdateInitialWeightInput;
}

export interface CompleteExerciseInput {
  exerciseId: number;
}

export interface CompleteExercisePayload {
  exercise: Exercise | null;
}

export interface CompleteWorkoutInput {
  workoutId: number;
}

export interface CompleteWorkoutPayload {
  workout: Workout | null;
}

export interface IncludeExerciseInput {
  exerciseId: number;
}

export interface IncludeExercisePayload {
  exercise: Exercise | null;
}

export interface UpdateInitialWeightInput {
  exerciseId: number;
  weight: number;
}

export interface UpdateInitialWeightPayload {
  exercise: Exercise | null;
}

export interface CompleteConfigurationPayload {
  user: User | null;
}
