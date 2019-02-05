import { format } from 'date-fns';
import { flatten, get, last, round, sortBy } from 'lodash';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { compose } from 'recompose';

import {
  epleyOneRepMax,
  ExerciseDefinitions,
  fiveRepMax,
  metricToImperial,
} from '../../Configuration';
import { IAppState, IExercise, withApplicationState } from '../../Store';
import { Grid } from '../Layout';

interface IRepSummaryProps {
  exerciseName: keyof typeof ExerciseDefinitions;
}

interface IRepSummaryInnerProps extends IRepSummaryProps, IAppState {}

class RepSummary extends React.PureComponent<IRepSummaryInnerProps> {
  public render(): JSX.Element {
    const { configuration, workoutPlan } = this.props.store;

    const exercises = flatten(
      workoutPlan.map(workout =>
        last(
          workout.exercises.filter(
            exercise => exercise.definition === this.props.exerciseName && exercise.completed
          )
        )
      )
    ).filter(e => e && Boolean(e.completed && e.weight)) as IExercise[];

    const initialWeight: number = get(
      configuration.weights,
      [this.props.exerciseName, 'initial'],
      0
    );
    const { amrap: lastRepCount, weight: lastWeight } = last(sortBy(exercises, 'completed')) || {
      amrap: 0,
      weight: 0,
    };

    const { unit } = this.props.store.configuration;

    return (
      <Grid row>
        <Grid size={2} horizontal="left">
          <Text style={styles.smallText}>Rep Max</Text>
          <Text style={styles.bodyText}>5RM:</Text>
          <Text style={styles.bodyText}>1RM:</Text>
        </Grid>
        <Grid size={4} horizontal="right">
          <Text style={styles.smallText}>Initial</Text>
          <Text style={styles.bodyText}>
            {unit === 'METRIC' ? `${initialWeight}kg` : `${metricToImperial(initialWeight)}lbs`}
          </Text>
          <Text style={styles.bodyText}>
            {unit === 'METRIC'
              ? `${round(epleyOneRepMax(initialWeight, 5))}kg`
              : `${round(metricToImperial(epleyOneRepMax(initialWeight, 5)))}lbs`}
          </Text>
        </Grid>
        <Grid size={4} horizontal="right">
          <Text style={styles.smallText}>Current</Text>
          <Text style={styles.bodyText}>
            {unit === 'METRIC'
              ? `${round(fiveRepMax(lastWeight, lastRepCount || 0))}kg`
              : `${round(metricToImperial(fiveRepMax(lastWeight, lastRepCount || 0)))}lbs`}
          </Text>
          <Text style={styles.bodyText}>
            {unit === 'METRIC'
              ? `${round(epleyOneRepMax(lastWeight, lastRepCount || 0))}kg`
              : `${round(metricToImperial(epleyOneRepMax(lastWeight, lastRepCount || 0)))}lbs`}
          </Text>
        </Grid>
      </Grid>
    );
  }
}

const styles = StyleSheet.create({
  bodyText: { color: 'white', fontSize: 20, fontWeight: '100' },
  smallText: { color: 'white', fontSize: 12, fontWeight: '100' },
});

export default compose<IRepSummaryInnerProps, IRepSummaryProps>(withApplicationState)(RepSummary);
