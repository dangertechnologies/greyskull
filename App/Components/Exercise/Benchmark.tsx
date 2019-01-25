import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { compose } from 'recompose';
import { IAppState, IExerciseConfiguration, withApplicationState } from '../../Store';
import Button from '../Button';
import { Grid, ScreenLayout, ScreenTitle } from '../Layout';
import DataValueDisplay from './DataValueDisplay';
import FormDescription from './Hints';

import { ExerciseDefinitions } from '../../Configuration';
import Backgrounds from '../../Images/Backgrounds';

interface IBenchmarkWorkoutProps {
  exerciseName: keyof typeof ExerciseDefinitions;
  onDone(exercise: IExerciseConfiguration): any;
}

interface IBenchmarkWorkoutInnerProps extends IBenchmarkWorkoutProps, IAppState {}

const styles = StyleSheet.create({
  formDivider: {
    backgroundColor: '#FFFFFF',
    height: '50%',
    marginHorizontal: 5,
    marginTop: 40,
    width: StyleSheet.hairlineWidth,
  },

  instructions: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '100',
  },
});

class BenchmarkWorkout extends React.PureComponent<IBenchmarkWorkoutInnerProps> {
  public setExerciseInitialWeight = (weight: number) =>
    this.props.update({
      configuration: {
        ...this.props.store.configuration,
        weights: {
          [this.props.exerciseName]: {
            current: weight,
            initial: weight,
          },
        },
      },
    });

  public render(): JSX.Element {
    const { store, exerciseName, onDone, update } = this.props;
    const { exercises } = store.configuration;
    const exercise = exercises[exerciseName];
    const weights = store.configuration.weights[exerciseName] || { initial: 0, current: 0 };

    return (
      <ScreenLayout
        image={
          exercise.background && Backgrounds[exercise.background]
            ? exercise.background
            : 'default'
        }
      >
        <Grid size={2} vertical="center" horizontal="center" style={{ height: '100%' }}>
          <ScreenTitle title={exercise.name} />
        </Grid>
        <Grid size={3}>
          <Text style={styles.instructions}>
            To calculate your weight progression, we need to calculate your maximum weight for this
            exercise. Find a weight you can complete 5 good form repetitions with, but where you
            wouldn’t be able to complete another repetition with good form.
          </Text>
        </Grid>

        <Grid size={2}>
          <DataValueDisplay
            step={0.5}
            value={parseFloat(`${weights.initial || 20}`).toFixed(1)}
            unit="kg"
            allowInput
            onChange={(weight: number) => this.setExerciseInitialWeight(weight)}
          />
        </Grid>

        <Grid row size={4} style={{ justifyContent: 'space-between' }}>
          <Grid size={5.5}>
            <FormDescription hints={exercise.goodForm} />
          </Grid>
          <Grid size={1} vertical="center" horizontal="center">
            <View style={styles.formDivider} />
          </Grid>
          <Grid size={5.5}>
            <FormDescription bad hints={exercise.badForm} />
          </Grid>
        </Grid>
        <Grid row size={1}>
          <Button
            onPress={() => {
              if (!weights.initial) {
                this.setExerciseInitialWeight(20);
              }
              onDone(exercise);
            }}
          >
            Done
          </Button>
        </Grid>
      </ScreenLayout>
    );
  }
}

export default compose<IBenchmarkWorkoutInnerProps, IBenchmarkWorkoutProps>(withApplicationState)(
  BenchmarkWorkout
);
