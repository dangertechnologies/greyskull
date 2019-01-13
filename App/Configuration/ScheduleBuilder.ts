import { map, pickBy } from 'lodash';
import { IApplicationState, IExercise, IWorkout } from '../Store';

// weight: (exercise.initialWeight || 0) + (exercise.incrementFactor || 1) * Number(i / 2),
const buildSchedule = (state: IApplicationState): Partial<IApplicationState> => {
  return {
    workoutPlan: Array.from({ length: 8 * 3 }, (_, i: number) => ({
      completed: null,
      exercises: map(
        pickBy(
          state.configuration.exercises,
          exercise =>
            // Only include exercise if its not marked as excluded
            Boolean(exercise.include !== 'EXCLUDED') &&
            Boolean(
              Boolean(exercise.slot === 'ODD' && i % 2 !== 0) ||
                Boolean(exercise.slot === 'EVEN' && i % 2 === 0) ||
                Boolean(exercise.slot === 'FIRST' && i % 3 === 1) ||
                Boolean(exercise.slot === 'SECOND' && i % 3 === 2) ||
                Boolean(exercise.slot === 'THIRD' && i % 3 === 0) ||
                exercise.slot === 'EVERY'
            )
        ),
        (exercise, name) =>
          ({
            definition: name,
          } as IExercise)
      ),
      id: i,
    })),
  };
};

export default buildSchedule;
