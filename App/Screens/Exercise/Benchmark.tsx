import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { compose } from 'recompose';
import { ExerciseDefinitions, metricToImperial, imperialToMetric } from '../../Configuration';
import Backgrounds from '../../Images/Backgrounds';
import { IAppState, IExerciseConfiguration, withApplicationState } from '../../Store';

import Button from '../../Components/Button';
import { Grid, ScreenLayout, ScreenTitle } from '../../Components/Layout';
import DataValueDisplay from './DataValueDisplay';
import FormDescription from './Hints';
import { NavigationScreenProp, NavigationState } from 'react-navigation';

interface IBenchmarkExerciseParams {
  exerciseName: keyof typeof ExerciseDefinitions;
  onDone(exercise: IExerciseConfiguration): any;
}

interface IBenchmarkExerciseProps {
  navigation: NavigationScreenProp<NavigationState, IBenchmarkExerciseParams>;
}

interface IBenchmarkExerciseInnerProps extends IBenchmarkExerciseProps, IAppState {}

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

class BenchmarkWorkout extends React.PureComponent<IBenchmarkExerciseInnerProps> {
  public setExerciseInitialWeight = (weight: number) =>
    this.props.update({
      configuration: {
        ...this.props.store.configuration,
        weights: {
          [this.props.navigation.state.params.exerciseName]: {
            current: weight,
            initial: weight,
          },
        },
      },
    });

  public render(): JSX.Element {
    const { store } = this.props;
    const { exerciseName, onDone, update } = this.props.navigation.state.params;
    const { exercises } = store.configuration;
    const exercise = exercises[exerciseName];
    console.log({ exercise, exerciseName, exercises });
    const weights = store.configuration.weights[exerciseName] || { initial: 0, current: 0 };

    return (
      <ScreenLayout
        image={
          exercise.background && Backgrounds[exercise.background] ? exercise.background : 'default'
        }
      >
        <Grid size={2} vertical="center" horizontal="center" style={{ height: '100%' }}>
          <ScreenTitle title={exercise.name} />
        </Grid>
        <Grid size={3}>
          <Text style={styles.instructions}>
            To calculate your weight progression, we need to calculate your maximum weight for this
            exercise. Find a weight with which you can complete no more than 5 repetitions with good
            form.
          </Text>
        </Grid>

        <Grid size={2}>
          <DataValueDisplay
            step={store.configuration.unit === 'METRIC' ? 2.5 : 5}
            value={parseFloat(
              store.configuration.unit === 'METRIC'
                ? `${weights.initial || 20}`
                : metricToImperial(weights.initial || 20.45).toString()
            ).toFixed(1)}
            unit={store.configuration.unit === 'METRIC' ? 'kg' : 'lbs'}
            allowInput
            onChange={(weight: number) =>
              this.setExerciseInitialWeight(
                store.configuration.unit === 'IMPERIAL' ? imperialToMetric(weight) : weight
              )
            }
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

export default compose<IBenchmarkExerciseInnerProps, IBenchmarkExerciseProps>(withApplicationState)(
  BenchmarkWorkout
);
