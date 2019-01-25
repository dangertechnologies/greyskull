import { format } from 'date-fns';
import { flatten, get, last, round, sortBy } from 'lodash';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { compose } from 'recompose';

import { ExerciseDefinitions } from '../../Configuration';
import { IAppState, IExercise, withApplicationState } from '../../Store';
import { Grid } from '../Layout';

interface IRepSummaryProps {
  exerciseName: keyof typeof ExerciseDefinitions;
}

interface IRepSummaryInnerProps extends IRepSummaryProps, IAppState {}

const epleyOneRepMax = (weight: number, reps: number) => weight * (1 + reps / 30);
const fiveRepMax = (weight: number, reps: number) => 0.87 * epleyOneRepMax(weight, reps);

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

    return (
      <Grid row>
        <Grid size={2} horizontal="left">
          <Text style={styles.smallText}>Rep Max</Text>
          <Text style={styles.bodyText}>5RM:</Text>
          <Text style={styles.bodyText}>1RM:</Text>
        </Grid>
        <Grid size={4} horizontal="right">
          <Text style={styles.smallText}>Initial</Text>
          <Text style={styles.bodyText}>{`${initialWeight}kg`}</Text>
          <Text style={styles.bodyText}>{`${round(epleyOneRepMax(initialWeight, 5))}kg`}</Text>
        </Grid>
        <Grid size={4} horizontal="right">
          <Text style={styles.smallText}>Current</Text>
          <Text style={styles.bodyText}>{`${round(
            fiveRepMax(lastWeight, lastRepCount || 0)
          )}kg`}</Text>
          <Text style={styles.bodyText}>
            {`${round(epleyOneRepMax(lastWeight, lastRepCount || 0))}kg`}
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
