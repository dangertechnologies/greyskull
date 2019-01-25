import { format } from 'date-fns';
import { flatten, last } from 'lodash';
import React from 'react';
import { LayoutChangeEvent, Text } from 'react-native';

import { compose } from 'recompose';

import { ExerciseDefinitions } from '../../Configuration';
import Backgrounds from '../../Images/Backgrounds';
import { IAppState, IExercise, withApplicationState } from '../../Store';
import { Grid, ScreenLayout, ScreenTitle } from '../Layout';
import Chart from './Chart';
import RepSummary from './RepSummary';

interface IProgressProps {
  exerciseName: keyof typeof ExerciseDefinitions;
}

interface IProgressInnerProps extends IProgressProps, IAppState {}

interface IProgressState {
  chartWidth: number;
}

class Progress extends React.Component<IProgressInnerProps, IProgressState> {
  public state: IProgressState = {
    chartWidth: 0,
  };

  public setChartWidth = (e: LayoutChangeEvent) => {
    this.setState({
      chartWidth: e.nativeEvent.layout.width - 26,
    });
  };

  public render(): JSX.Element {
    const { configuration, workoutPlan } = this.props.store;

    const flattenedExercises = flatten(
      workoutPlan.map(workout =>
        last(
          workout.exercises.filter(
            exercise => exercise.definition === this.props.exerciseName && exercise.completed
          )
        )
      )
    );
    const exercises = flattenedExercises.filter(
      e => e && Boolean(e.completed && e.weight)
    ) as IExercise[];

    const definition = configuration.exercises[this.props.exerciseName];

    return (
      <ScreenLayout image={definition && definition.background ? definition.background : 'default'}>
        <Grid size={2} vertical="center" horizontal="center">
          <ScreenTitle
            title={configuration.exercises[this.props.exerciseName].name}
            subtitle="Progress"
          />
        </Grid>
        <Grid size={2}>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: '100',
            }}
          >
            {' '}
            {definition.description}{' '}
          </Text>
        </Grid>

        <Grid size={5} row>
          <Chart exercises={exercises} />
        </Grid>
        <Grid size={1} vertical="center">
          <RepSummary exerciseName={this.props.exerciseName} />
        </Grid>
      </ScreenLayout>
    );
  }
}

export default compose<IProgressInnerProps, IProgressProps>(withApplicationState)(Progress);
