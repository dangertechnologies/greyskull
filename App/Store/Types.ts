import Backgrounds from 'App/Images/Backgrounds/index.js';
import exercises from '../Configuration/exercises.json';
import sets from '../Configuration/sets.json';

export interface IApplicationState {
  configuration: {
    initialSetupComplete: boolean;
    exercises: { [K in keyof typeof exercises]: IExerciseConfiguration };
    weights: { [K in keyof typeof exercises]?: { initial: number; current: number } };
  };

  workoutPlan: IWorkout[];
}

export interface IWorkoutSchedule {
  IExercises: IExercise[];
}

export interface IExercise {
  weight: number;
  completed: string | null;
  amrap: number | null;
  definition: keyof typeof exercises;
}

export interface IExerciseConfiguration {
  background?: keyof typeof Backgrounds;
  bodyweight?: boolean;
  name: string;
  description: string;
  video?: string;
  url?: string;
  shortName: string;
  include: string;
  icon: string;
  incrementFactor: number | null;
  goodForm: string[];
  badForm: string[];
  reps: string;
  slot: string;
}

// export type IExerciseState = 'REQUIRED' | 'EXCLUDED' | 'INCLUDED';

export interface IRepetition {
  weightFactor: number;
  count: number | null;
}

export type TDaySlot = 'ODD' | 'EVEN' | 'FIRST' | 'SECOND' | 'THIRD' | 'EVERY';

export interface IWorkout {
  id: number;
  exercises: IExercise[];
  completed: string | null;
}
