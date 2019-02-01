import { mapValues } from 'lodash';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NavigationScreenProps, NavigationState } from 'react-navigation';
import { compose } from 'recompose';

import Button from '../../Components/Button';
import { Grid, ScreenLayout, ScreenTitle } from '../../Components/Layout';
import { IAppState, withApplicationState } from '../../Store';

import IconBox from './IconBox';

interface IScreenProps extends NavigationScreenProps<NavigationState>, IAppState {}

interface IConfigurationState {
  optionalExercises: {};
}

export class Screen extends React.Component<IScreenProps, IConfigurationState> {
  public componentDidUpdate() {
    if (this.props.store.configuration.initialSetupComplete && this.props.navigation.isFocused()) {
      this.props.navigation.navigate('ScheduleScreen');
    }
  }

  public render(): JSX.Element {
    const { exercises } = this.props.store.configuration;
    return (
      <ScreenLayout image="dumbbell-female">
        <Grid size={1.5} vertical="center" horizontal="center">
          <ScreenTitle title="Get started" />
        </Grid>

        <Grid size={2}>
          <Text style={styles.body}>
            The training program comes with 6 default exercises. You can add additional exercises to
            the program if you want a heavier workout.
          </Text>
        </Grid>

        <Grid size={4} horizontal="center">
          <IconBox
            title="Always included"
            exercises={Object.values(exercises).filter(({ include }) => include === 'REQUIRED')}
          />
        </Grid>

        <Grid size={4} horizontal="center">
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
        </Grid>

        <Grid row size={2}>
          <Button
            onPress={() => this.props.update({ configuration: { initialSetupComplete: true } })}
          >
            Done
          </Button>
        </Grid>
      </ScreenLayout>
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
