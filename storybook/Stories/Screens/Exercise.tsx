import { select, withKnobs } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react-native';
import React from 'react';
import { ExerciseDefinitions } from '../../../App/Configuration';
import { Screen } from '../../../App/Screens/Exercise/Perform';

const exerciseOptions = {
  BENCH_PRESS: {
    amrap: null,
    completed: new Date().getTime(),
    definition: 'BENCH_PRESS',
    weight: 40,
  },
  CURLS: {
    amrap: null,
    completed: new Date().getTime(),
    definition: 'CURLS',
    weight: 40,
  },
  DEADLIFT: {
    amrap: null,
    completed: new Date().getTime(),
    definition: 'DEADLIFT',
    weight: 40,
  },
};

storiesOf('Screens', module)
  .addDecorator(withKnobs)
  .add('ExerciseScreen', () => (
    <Screen
      store={{
        configuration: {
          exercises: ExerciseDefinitions,
          initialSetupComplete: true,
          weights: {
            BENCH_PRESS: {
              current: 40,
              initial: 30,
            },
            CURLS: {
              current: 40,
              initial: 30,
            },
            DEADLIFT: {
              current: 40,
              initial: 30,
            },
          },
        },
      }}
      navigation={{
        state: {
          params: {
            exercise: select('Exercise', exerciseOptions, exerciseOptions.BENCH_PRESS, 1),
            onAMRAP: console.log,
            onDone: console.log,
          },
        },
      }}
      update={value => console.log(value)}
    />
  ));
