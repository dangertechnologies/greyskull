import { get } from 'lodash';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { NavigationScreenProps, NavigationState } from 'react-navigation';
import { compose } from 'recompose';

import { Exercise } from '../../Components/Exercise';
import RestTimer from '../../Components/RestTimer';
import WeightIncreased from '../../Components/WeightIncreased';
import { IAppState, IWorkout, withApplicationState } from '../../Store';

interface IScreenProps extends NavigationScreenProps<NavigationState>, IAppState {}

interface IScreenState {
  currentIndex: number;
  workout: IWorkout | null;

  successDisplayProps?: {
    title: string;
    fromWeight: number;
    toWeight: number;
    onDone(): any;
  };
}

const epleyOneRepMax = (weight: number, reps: number) => weight * (1 + reps / 30);

const fiveRepMax = (weight: number, reps: number) => 0.87 * epleyOneRepMax(weight, reps);

class Screen extends React.Component<IScreenProps> {
  public static getDerivedStateFromProps(props: IScreenProps) {
    // @ts-ignore
    const workout = props.navigation.getParam('workout');
    if (workout) {
      return {
        workout,
      };
    }
    return null;
  }

  public state: IScreenState = {
    currentIndex: 0,
    workout: null,
  };

  public next = () => {
    const { store, update } = this.props;

    if (this.state.workout && this.state.currentIndex + 1 === this.state.workout.exercises.length) {
      update({
        workoutPlan: store.workoutPlan.map(workout =>
          this.state.workout && workout.id === this.state.workout.id
            ? { ...workout, completed: new Date().getTime() }
            : workout
        ),
      });
      this.props.navigation.navigate('ScheduleScreen');
    } else {
      this.setState({
        currentIndex: this.state.currentIndex + 1,
      });
    }
  };

  public onAMRAP = (reps: number) => {
    if (!this.state.workout) {
      return null;
    }

    const { store } = this.props;
    const exercise = this.state.workout.exercises[this.state.currentIndex];

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
      workoutPlan: store.workoutPlan.map(workout => {
        return this.state.workout && workout.id === this.state.workout.id
          ? {
              ...workout,
              exercises: workout.exercises.map((step, index) => {
                return index === this.state.currentIndex
                  ? {
                      ...step,
                      amrap: reps,
                      completed: new Date().getTime(),
                      weight: currentWeight,
                    }
                  : step;
              }),
            }
          : workout;
      }),
    });
    this.setState({ successDisplayProps: undefined });
  };

  public render() {
    const { store, update } = this.props;

    if (!this.state.workout) {
      return null;
    }

    const exercise = this.state.workout.exercises[this.state.currentIndex];

    const currentWeight = get(store, `configuration.weights.${exercise.definition}.current`, 0);
    const definition = store.configuration.exercises[exercise.definition];

    return (
      <>
        <Exercise
          exercise={exercise}
          onAMRAP={(reps: number) => {
            if (!this.state.workout) {
              return null;
            }
            if (reps >= 5 && !definition.bodyweight) {
              this.setState({
                successDisplayProps: {
                  fromWeight: currentWeight,
                  onDone: () => this.onAMRAP(reps),
                  title: definition.name,
                  toWeight: fiveRepMax(currentWeight, reps),
                },
              });
            } else {
              this.onAMRAP(reps);
            }
          }}
          onDone={this.next}
        />
        {this.state.successDisplayProps && <WeightIncreased {...this.state.successDisplayProps} />}
      </>
    );
  }
}

const styles = StyleSheet.create({});

export default compose<IScreenProps, IScreenProps>(withApplicationState)(Screen);
