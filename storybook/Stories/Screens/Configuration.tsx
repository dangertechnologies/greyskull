import { boolean, withKnobs } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react-native';
import React from 'react';
import { View } from 'react-native';
import { ExerciseDefinitions } from '../../../App/Configuration';
import { Screen } from '../../../App/Screens/Configuration/Screen';

storiesOf('Screens', module)
  .addDecorator(withKnobs)
  .add('ConfigurationScreen', () => (
    <Screen
      store={{
        configuration: {
          exercises: ExerciseDefinitions,
          initialSetupComplete: false,
        },
      }}
      update={value => console.log(value)}
    />
  ));
