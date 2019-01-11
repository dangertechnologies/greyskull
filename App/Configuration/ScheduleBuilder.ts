import mapValues from 'lodash/mapValues';
import pickBy from 'lodash/pickBy';
import Exercises from './Exercises';
import { IExerciseConfiguration, IWorkout, IExercise } from 'App/Providers/Types';

const DEADLIFT_DAYS = ['MILITARY_PRESS', 'DEADLIFT', 'CURL'];
const SQUAT_DAYS = ['BENCH_PRESS', 'BARBELL_SQUAT', 'CHIN'];

const buildSchedule = (exercises: IExerciseConfiguration[]): IWorkout[] => {
  // Exercise sequence is as follows:
  // 1.1 Press, Squat, Row, Curl
  // 1.2 Bench, Deadlift, Row, Chin
  // Repeat 3x8

  return Array.from({ length: 8 * 3 }, (_, i: number) => ({
    completed: null,
    id: i,
    steps: Exercises.filter(({ include }) => include === 'REQUIRED' || include === 'INCLUDED')
      .filter(
        ({ slot }) =>
          Boolean(slot === 'ODD' && i % 2 !== 0) ||
          Boolean(slot === 'EVEN' && i % 2 === 0) ||
          Boolean(slot === 'FIRST' && i % 3 === 1) ||
          Boolean(slot === 'SECOND' && i % 3 === 2) ||
          Boolean(slot === 'THIRD' && i % 3 === 0) ||
          slot === 'EVERY'
      )
      .map(
        exercise =>
          ({
            config: exercise,
            weight: (exercise.initialWeight || 0) + (exercise.incrementFactor || 1) * Number(i / 2),
          } as IExercise)
      ),
  }));
};

export default buildSchedule;
