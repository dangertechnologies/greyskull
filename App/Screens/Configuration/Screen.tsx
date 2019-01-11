import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NavigationScreenProps, NavigationState } from 'react-navigation';
import { compose } from 'recompose';
import Button from '../../Components/Button';

import Layout from '../../Components/Layout';
import { withApplicationState } from '../../Providers/ApplicationState';
import { IApplicationState } from '../../Providers/Types';

import IconBox from './IconBox';

const BACKGROUND_IMAGE = require('../../Images/Backgrounds/dumbbell-female-blur.jpg');

interface IScreenProps extends NavigationScreenProps<NavigationState> {
  configuration: IApplicationState['configuration'];
  update(value: Partial<IApplicationState['configuration']>): any;
}

interface IConfigurationState {
  optionalExercises: {};
}

class Screen extends React.Component<IScreenProps, IConfigurationState> {
  public componentDidUpdate() {
    if (this.props.configuration.initialSetupComplete) {
      this.props.navigation.navigate('ScheduleScreen');
    }
  }

  public render(): JSX.Element {
    const { exercises } = this.props.configuration;
    return (
      <Layout image={BACKGROUND_IMAGE} title="Get Started">
        <View style={styles.instructions}>
          <Text style={styles.body}>
            The training program comes with 6 default exercises. You can add additional exercises to
            the program if you want a heavier workout.
          </Text>

          <View style={styles.exercises}>
            <IconBox
              title="Always included"
              exercises={exercises.filter(({ include }) => include === 'REQUIRED')}
            />

            <IconBox
              title="Optional"
              exercises={exercises.filter(({ include }) => include !== 'REQUIRED')}
              onIconPress={exercise =>
                this.props.update({
                  exercises: exercises.map(e =>
                    exercise.shortName === e.shortName
                      ? {
                          ...e,
                          include:
                            e.include === 'INCLUDED'
                              ? ('EXCLUDED' as 'EXCLUDED')
                              : ('INCLUDED' as 'INCLUDED'),
                        }
                      : e
                  ),
                })
              }
              checked={exercise => exercise.include === 'INCLUDED'}
            />
          </View>

          <Button onPress={() => this.props.update({ initialSetupComplete: true })}>Done</Button>
        </View>
      </Layout>
    );
  }
}

const styles = StyleSheet.create({
  body: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '100',
  },
  instructions: {
    flex: 1,
    marginVertical: 10,
  },

  exercises: {
    flexDirection: 'column',
    justifyContent: 'space-around',
    paddingTop: 50,
  },
});

export default compose<IScreenProps, IScreenProps>(withApplicationState('configuration'))(Screen);
