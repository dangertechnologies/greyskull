import { get } from 'lodash';
import React from 'react';
import { StyleSheet } from 'react-native';

import { NavigationScreenProps, NavigationState } from 'react-navigation';
import { compose } from 'recompose';

import { Exercise } from '../../Components/Exercise';
import RestTimer from '../../Components/RestTimer';
import { IAppState, IWorkout, withApplicationState } from '../../Store';

interface IScreenProps extends NavigationScreenProps<NavigationState>, IAppState {}

interface IScreenState {
  currentIndex: number;
  workout: IWorkout | null;
}
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
            ? { ...workout, completed: new Date().getTime().toString() }
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

  public render() {
    const { store, update } = this.props;

    if (!this.state.workout) {
      return null;
    }

    const exercise = this.state.workout.exercises[this.state.currentIndex];

    const currentWeight = get(store, `configuration.weights.${exercise.definition}.current`, 0);
    const definition = store.configuration.exercises[exercise.definition];

    return (
      <Exercise
        exercise={exercise}
        onAMRAP={(reps: number) =>
          update({
            configuration: {
              weights: {
                [exercise.definition]: {
                  current:
                    definition.incrementFactor && reps >= 5
                      ? definition.incrementFactor * currentWeight
                      : currentWeight,
                },
              },
            },
            workoutPlan: store.workoutPlan.map(workout =>
              this.state.workout && workout.id === this.state.workout.id
                ? {
                    ...workout,
                    exercises: workout.exercises.map((step, index) =>
                      index === this.state.currentIndex ? { ...step, amrap: reps } : step
                    ),
                  }
                : workout
            ),
          })
        }
        onDone={this.next}
      />
    );
  }
}

const styles = StyleSheet.create({});

export default compose<IScreenProps, IScreenProps>(withApplicationState)(Screen);
