import { mapValues } from 'lodash';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
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
    const { exercises, unit } = this.props.store.configuration;
    return (
      <ScreenLayout image="dumbbell-female">
        <Grid size={1.5} vertical="center" horizontal="center">
          <ScreenTitle title="Get started" />
        </Grid>

        <Grid size={3} vertical="center">
          <Text style={styles.body}>
            The training program comes with 6 default exercises. You can add additional exercises to
            the program if you want a heavier workout.
          </Text>
        </Grid>

        <Grid size={4.5} horizontal="center">
          <IconBox
            title="Always included"
            exercises={Object.values(exercises).filter(({ include }) => include === 'REQUIRED')}
          />
        </Grid>

        <Grid size={3.5} horizontal="center">
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

        <Grid size={1.5} vertical="top" horizontal="center">
          <Grid>
            <Text style={styles.unitTitle}>Units</Text>
          </Grid>
          <Grid row>
            <Grid size={6} horizontal="center">
              <TouchableOpacity
                onPress={() => this.props.update({ configuration: { unit: 'METRIC' } })}
              >
                <Text style={[styles.unitSystem, unit === 'METRIC' && styles.unitSelected]}>
                  Metric (kg)
                </Text>
                {unit === 'METRIC' && (
                  <Ionicons
                    name="ios-checkmark-circle-outline"
                    size={20}
                    style={styles.unitSelectedIcon}
                    color="green"
                  />
                )}
              </TouchableOpacity>
            </Grid>
            <Grid size={6} horizontal="center">
              <TouchableOpacity
                onPress={() => this.props.update({ configuration: { unit: 'IMPERIAL' } })}
              >
                <Text style={[styles.unitSystem, unit === 'IMPERIAL' && styles.unitSelected]}>
                  Imperial (lbs)
                </Text>
                {unit === 'IMPERIAL' && (
                  <Ionicons
                    name="ios-checkmark-circle-outline"
                    size={20}
                    style={styles.unitSelectedIcon}
                    color="green"
                  />
                )}
              </TouchableOpacity>
            </Grid>
          </Grid>
        </Grid>

        <Grid row size={2} vertical="bottom">
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
    marginTop: 10,
  },
  container: {
    flex: 1,
    flexGrow: 1,
    justifyContent: 'space-evenly',
  },
  instructions: {
    flex: 1,
  },

  exercises: {
    flexDirection: 'column',
    justifyContent: 'space-around',
  },

  unitSelected: {
    opacity: 1.0,
  },
  unitSelectedIcon: {
    right: -15,
    position: 'absolute',
    top: -10,
  },
  unitSystem: {
    color: '#FFFFFF',
    fontSize: 13,
    paddingBottom: 3,
    paddingHorizontal: 8,
    opacity: 0.7,
    paddingTop: 2,
  },
  unitTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',

    textAlign: 'center',
  },
});

export default compose<IScreenProps, IScreenProps>(withApplicationState)(Screen);
