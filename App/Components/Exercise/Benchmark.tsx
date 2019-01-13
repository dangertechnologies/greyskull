import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { compose } from 'recompose';
import { IAppState, IExerciseConfiguration, withApplicationState } from '../../Store';
import Button from '../Button';
import Layout from '../Layout/Layout';
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
  container: {
    flex: 1,
    flexGrow: 1,
    justifyContent: 'space-evenly',
  },
  formDescription: {
    flexDirection: 'row',
    marginTop: 10,
    minHeight: 100,
    width: '100%',
  },
  formDivider: {
    backgroundColor: '#FFFFFF',
    height: '75%',
    marginHorizontal: 10,
    marginTop: 30,
    width: StyleSheet.hairlineWidth,
  },

  instructions: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '100',
    marginBottom: 30,
    marginTop: 0,
  },
});

const BenchmarkWorkout = ({ store, exerciseName, onDone, update }: IBenchmarkWorkoutInnerProps) => {
  const { exercises } = store.configuration;
  const exercise = exercises[exerciseName];
  const weights = store.configuration.weights[exerciseName] || { initial: 0, current: 0 };

  return (
    <Layout
      image={
        exercise.background && Backgrounds[exercise.background]
          ? Backgrounds[exercise.background]
          : Backgrounds.default
      }
      title={exercise.name}
    >
      <View style={styles.container}>
        <Text style={styles.instructions}>
          To calculate your weight progression, we need to calculate your maximum weight for this
          exercise. Find a weight you can complete 5 good form repetitions with, but where you
          wouldn’t be able to complete another repetition with good form.
        </Text>

        <DataValueDisplay
          step={0.5}
          value={parseFloat(`${weights.initial || 20}`).toFixed(1)}
          unit="kg"
          allowInput
          onChange={(value: number) => {
            update({
              configuration: {
                ...store.configuration,
                weights: {
                  [exerciseName]: {
                    current: value,
                    initial: value,
                  },
                },
              },
            });
          }}
        />

        <View style={styles.formDescription}>
          <FormDescription hints={exercise.goodForm} />
          <View style={styles.formDivider} />
          <FormDescription hints={exercise.badForm} bad />
        </View>
        <Button onPress={() => onDone(exercise)}>Done</Button>
      </View>
    </Layout>
  );
};

export default compose<IBenchmarkWorkoutInnerProps, IBenchmarkWorkoutProps>(withApplicationState)(
  BenchmarkWorkout
);
