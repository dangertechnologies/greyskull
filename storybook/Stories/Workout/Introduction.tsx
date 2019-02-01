import { storiesOf } from '@storybook/react-native';
import React from 'react';
import { View } from 'react-native';
import IntroductionScreen from '../../../App/Screens/Workout/Screen';

storiesOf('Introduction', module).add('default view', () => (
  <View
    style={{
      alignItems: 'center',
      backgroundColor: '#F5FCFF',
      flex: 1,
      justifyContent: 'center',
    }}
  >
    <IntroductionScreen
      workout={{
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
      }}
    />
  </View>
));
