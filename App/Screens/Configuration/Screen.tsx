import { mapValues } from 'lodash';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NavigationScreenProps, NavigationState } from 'react-navigation';
import { compose } from 'recompose';

import Button from '../../Components/Button';
import Layout from '../../Components/Layout/Layout';
import { IAppState, withApplicationState } from '../../Store';

import IconBox from './IconBox';

const BACKGROUND_IMAGE = require('../../Images/Backgrounds/dumbbell-female-blur.jpg');

interface IScreenProps extends NavigationScreenProps<NavigationState>, IAppState {}

interface IConfigurationState {
  optionalExercises: {};
}

class Screen extends React.Component<IScreenProps, IConfigurationState> {
  public componentDidUpdate() {
    if (this.props.store.configuration.initialSetupComplete && this.props.navigation.isFocused()) {
      this.props.navigation.navigate('ScheduleScreen');
    }
  }

  public render(): JSX.Element {
    const { exercises } = this.props.store.configuration;
    return (
      <Layout image={BACKGROUND_IMAGE} title="Get Started">
        <View style={styles.container}>
          <View style={styles.instructions}>
            <Text style={styles.body}>
              The training program comes with 6 default exercises. You can add additional exercises
              to the program if you want a heavier workout.
            </Text>

            <View style={styles.exercises}>
              <IconBox
                title="Always included"
                exercises={Object.values(exercises).filter(({ include }) => include === 'REQUIRED')}
              />

              <IconBox
                title="Optional"
                exercises={Object.values(exercises).filter(({ include }) => include !== 'REQUIRED')}
                onIconPress={exercise =>
                  this.props.update({
                    configuration: {
                      exercises: mapValues(exercises, e =>
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
                    } as IAppState['store']['configuration'],
                  })
                }
                checked={exercise => exercise.include === 'INCLUDED'}
              />
            </View>

            <Button
              onPress={() => this.props.update({ configuration: { initialSetupComplete: true } })}
            >
              Done
            </Button>
          </View>
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
  container: {
    flex: 1,
    flexGrow: 1,
    justifyContent: 'space-evenly',
  },
  instructions: {
    flex: 1,
    marginVertical: 10,
  },

  exercises: {
    flexDirection: 'column',
    justifyContent: 'space-around',
  },
});

export default compose<IScreenProps, IScreenProps>(withApplicationState)(Screen);
