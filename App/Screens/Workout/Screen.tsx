import { flatten, get } from 'lodash';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { NavigationScreenProp, NavigationState } from 'react-navigation';
import { compose } from 'recompose';
import { IAppState, IExercise, IWorkout, withApplicationState } from '../../Store';

import ExerciseIcon from '../../Components/ExerciseIcon';
import { Grid, ScreenLayout, ScreenTitle } from '../../Components/Layout';
import WeightIncreased, { IWeightIncreasedProps } from '../../Components/WeightIncreased';

interface IWorkoutScreenParams {
  workout: IWorkout;
}

interface IWorkoutScreenProps {
  navigation: NavigationScreenProp<NavigationState, IWorkoutScreenParams>;
}

interface IWorkoutScreenInnerProps extends IWorkoutScreenProps, IAppState {}

interface IWorkoutScreenState {
  successDisplayProps?: IWeightIncreasedProps;
}

const styles = StyleSheet.create({
  exerciseName: { color: '#FFFFFF', fontSize: 20, fontWeight: '100' },
  iconCircle: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
});

const epleyOneRepMax = (weight: number, reps: number) => weight * (1 + reps / 30);
const fiveRepMax = (weight: number, reps: number) => 0.87 * epleyOneRepMax(weight, reps);

export class Screen extends React.Component<IWorkoutScreenInnerProps, IWorkoutScreenState> {
  public state: IWorkoutScreenState = {
    successDisplayProps: undefined,
  };

  public onAMRAP = (exercise: IExercise, reps: number) => {
    const { workout } = this.props.navigation.state.params;

    if (!workout) {
      return null;
    }

    const { store } = this.props;

    const currentWeight = get(store, `configuration.weights.${exercise.definition}.current`, 0);
    const definition = store.configuration.exercises[exercise.definition];

    this.props.update({
      configuration: {
        weights: {
          [exercise.definition]: {
            current:
              definition.incrementFactor && reps >= 5 && !definition.bodyweight
                ? fiveRepMax(currentWeight, reps)
                : currentWeight,
          },
        },
      },
      workoutPlan: store.workoutPlan.map(plannedWorkout => {
        return plannedWorkout && plannedWorkout.id === workout.id
          ? {
              ...plannedWorkout,
              exercises: plannedWorkout.exercises.map(step => {
                return step.definition === exercise.definition
                  ? {
                      ...step,
                      amrap: reps,
                      completed: new Date().getTime(),
                      weight: currentWeight,
                    }
                  : step;
              }),
            }
          : plannedWorkout;
      }),
    });
    this.setState({ successDisplayProps: undefined });
  };

  public onExerciseFinished = () => {
    const { workout: currentWorkout } = this.props.navigation.state.params;
    const { store } = this.props;

    const workoutPlan = store.workoutPlan.map(plannedWorkout => {
      if (plannedWorkout.id === currentWorkout.id) {
        return {
          ...plannedWorkout,
          completed: new Date().getTime(),
        };
      }
      return plannedWorkout;
    });

    const workout = workoutPlan.find(({ id }) => id === currentWorkout.id);
    if (workout && workout.exercises.every(e => Boolean(e.completed))) {
      this.props.update({
        workoutPlan,
      });

      // Display progress screen if these exercises have been completed before
      const completedExercises = flatten(workoutPlan.map(e => e.exercises)).filter(
        e =>
          Boolean(e.completed) &&
          workout &&
          workout.exercises.map(ex => ex.definition).indexOf(e.definition) !== -1
      );

      if (workout && completedExercises.length >= workout.exercises.length * 2) {
        this.props.navigation.navigate({
          params: { filter: workout.exercises.map(e => e.definition) },
          routeName: 'ProgressScreen',
        });
      } else {
        this.props.navigation.navigate('ScheduleScreen');
      }
    } else {
      this.props.navigation.navigate({
        params: { workout: currentWorkout },
        routeName: 'WorkoutScreen',
      });
    }
  };

  public render() {
    const { store } = this.props;
    const { workout } = this.props.navigation.state.params;

    return !workout ? null : (
      <>
        <ScreenLayout image="default">
          <Grid size={2} vertical="center" horizontal="center">
            <ScreenTitle title="Workout" />
          </Grid>
          <Grid size={9} column style={{ justifyContent: 'space-evenly', flex: 1 }}>
            {workout.exercises.map(exercise => {
              const definition = store.configuration.exercises[exercise.definition];
              const currentWeight = get(
                store,
                `configuration.weights.${exercise.definition}.current`,
                0
              );

              return (
                <Grid
                  size={2}
                  row
                  vertical="center"
                  horizontal="center"
                  onPress={() =>
                    this.props.navigation.navigate({
                      params: {
                        exercise,
                        onAMRAP: (reps: number) => {
                          if (reps >= 5 && !definition.bodyweight) {
                            this.setState({
                              successDisplayProps: {
                                fromWeight: currentWeight,
                                onDone: () => this.onAMRAP(exercise, reps),
                                title: definition.name,
                                toWeight: fiveRepMax(currentWeight, reps),
                              },
                            });
                          } else {
                            this.onAMRAP(exercise, reps);
                          }
                        },
                        onDone: () => this.onExerciseFinished(),
                      },
                      routeName: 'ExerciseScreen',
                    })
                  }
                >
                  <Grid size={4} horizontal="center">
                    <View style={styles.iconCircle}>
                      {exercise.completed ? (
                        <Ionicons
                          name="ios-checkmark"
                          color="#00FF00"
                          size={60}
                          style={{ lineHeight: 58 }}
                        />
                      ) : (
                        <ExerciseIcon name={definition.icon as any} />
                      )}
                    </View>
                  </Grid>
                  <Grid size={8} horizontal="left">
                    <Text style={styles.exerciseName}>{definition.name}</Text>
                  </Grid>
                </Grid>
              );
            })}
          </Grid>
        </ScreenLayout>
        {this.state.successDisplayProps && <WeightIncreased {...this.state.successDisplayProps} />}
      </>
    );
  }
}

export default compose<IWorkoutScreenInnerProps, IWorkoutScreenProps>(withApplicationState)(Screen);
