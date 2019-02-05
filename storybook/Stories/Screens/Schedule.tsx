import { select, withKnobs } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react-native';
import { addDays } from 'date-fns';
import { mapValues } from 'lodash';
import React from 'react';
import { ExerciseDefinitions } from '../../../App/Configuration';
import buildSchedule from '../../../App/Configuration/ScheduleBuilder';
import Screen from '../../../App/Screens/Schedule/Screen';
import { InnerProvider } from '../../../App/Store/ApplicationState';

const createFakeSchedule = () => {
  const { workoutPlan } = buildSchedule({
    configuration: { exercises: ExerciseDefinitions },
  });

  const weights = mapValues(ExerciseDefinitions, () => ({
    current: Math.ceil(Math.random() * 60 + 20),
    initial: Math.ceil(Math.random() * 40 + 20),
  }));

  return {
    configuration: { exercises: ExerciseDefinitions, weights, initialSetupComplete: true },
    workoutPlan: (workoutPlan || []).map((workout, i) => ({
      ...workout,
      completed: addDays(new Date(), i).getTime(),
      exercises: workout.exercises.map(exercise => ({
        ...exercise,
        amrap: /AMRAP/.test(ExerciseDefinitions[exercise.definition].reps)
          ? Math.floor(Math.random() * 10)
          : null,
        completed: addDays(new Date(), i).getTime(),
        weight: weights[exercise.definition].initial + i + Math.ceil(Math.random() * 2),
      })),
    })),
  };
};

storiesOf('Screens', module)
  .addDecorator(withKnobs)
  .add('ScheduleScreen', () => (
    <InnerProvider value={{ store: createFakeSchedule(), update: value => console.log(value) }}>
      <Screen settingsOpen navigation={{ navigate: () => true }} />
    </InnerProvider>
  ));
