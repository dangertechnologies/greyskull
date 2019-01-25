import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { compose } from 'recompose';
import { IAppState, IWorkout, withApplicationState } from '../../Store';

import ExerciseIcon from '../ExerciseIcon';
import { Grid, ScreenLayout, ScreenTitle } from '../Layout';

interface IWorkoutIntroProps {
  workout: IWorkout;
}

interface IWorkoutIntroInnerProps extends IWorkoutIntroProps, IAppState {}

const styles = StyleSheet.create({
  formDivider: {
    backgroundColor: '#FFFFFF',
    height: 100,
    marginHorizontal: 10,
    marginTop: 30,
    width: StyleSheet.hairlineWidth,
  },

  instructions: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '100',
  },
});

class Workout extends React.PureComponent<IWorkoutIntroInnerProps> {
  public render() {
    const { workout, store } = this.props;

    return !workout ? null : (
      <ScreenLayout image="default">
        <Grid size={2} vertical="center" horizontal="center">
          <ScreenTitle title="Workout" />
        </Grid>
        <Grid size={2} />

        {this.props.workout.exercises.map(exercise => {
          const definition = store.configuration.exercises[exercise.definition];

          return (
            <Grid size={2} row vertical="center" horizontal="center">
              <Grid size={4} horizontal="center">
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    borderWidth: 1,
                    borderColor: '#FFFFFF',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {exercise.completed ? (
                    <Ionicons
                      name="ios-checkmark"
                      color="#00FF00"
                      size={60}
                      style={{ lineHeight: 58 }}
                    />
                  ) : (
                    <ExerciseIcon name={definition.icon} />
                  )}
                </View>
              </Grid>
              <Grid size={6} horizontal="left">
                <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '100' }}>
                  {definition.name}
                </Text>
              </Grid>
            </Grid>
          );
        })}
      </ScreenLayout>
    );
  }
}

export default compose<IWorkoutIntroInnerProps, IWorkoutIntroProps>(withApplicationState)(Workout);
