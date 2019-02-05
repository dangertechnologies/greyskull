import { storiesOf } from '@storybook/react-native';
import React from 'react';
import { View } from 'react-native';
import { ExerciseDefinitions } from '../../../App/Configuration';
import { Screen } from '../../../App/Screens/Workout/Screen';

storiesOf('Screens', module).add('WorkoutScreen', () => (
  <View
    style={{
      alignItems: 'center',
      backgroundColor: '#F5FCFF',
      flex: 1,
      justifyContent: 'center',
    }}
  >
    <Screen
      store={{
        configuration: {
          exercises: ExerciseDefinitions,
          initialSetupComplete: true,
        },
      }}
      navigation={{
        state: {
          params: {
            workout: {
              completed: null,
              exercises: [
                {
                  amrap: null,
                  completed: new Date().getTime(),
                  definition: 'BENCH_PRESS',
                  weight: 40,
                },
                {
                  amrap: null,
                  completed: null,
                  definition: 'CURLS',
                  weight: 40,
                },
                {
                  amrap: null,
                  completed: null,
                  definition: 'BARBELL_SQUAT',
                  weight: 40,
                },
              ],
              id: 1,
            },
          },
        },
      }}
    />
  </View>
));
