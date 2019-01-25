import { findIndex, isEqual, round } from 'lodash';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { compose, withState } from 'recompose';

import { ExerciseSetDefinitions } from '../../Configuration';
import Backgrounds from '../../Images/Backgrounds';
import { IAppState, IExercise, withApplicationState } from '../../Store';
import Button from '../Button';
import { Grid, ScreenLayout, ScreenTitle } from '../Layout';
import RestTimer from '../RestTimer';
import DataValueDisplay from './DataValueDisplay';
import FormDescription from './Hints';
import Info from './Info';

interface IWorkoutProps {
  exercise: IExercise;
  onAMRAP?(amrap: number): any;
  onDone(exercise: IExercise): any;
}

interface IWorkoutInnerProps extends IWorkoutProps, IAppState {
  exerciseSetIndex: number;
  restTime: number | null;
  amrap: 0;
  setAMRAP(num: number): void;
  setExerciseSetIndex(idx: number): any;
  setRestTime(ms: number | null): any;
}

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

class Workout extends React.PureComponent<IWorkoutInnerProps> {
  public componentDidUpdate(oldProps: IWorkoutInnerProps) {
    if (this.props.exercise.definition !== oldProps.exercise.definition) {
      this.props.setExerciseSetIndex(0);
      this.props.setAMRAP(0);
    }
  }

  public render() {
    const {
      exercise,
      amrap,
      setAMRAP,
      store,
      setExerciseSetIndex,
      exerciseSetIndex,
      onDone,
      onAMRAP,
    } = this.props;
    const definition = store.configuration.exercises[exercise.definition];
    const sets = ExerciseSetDefinitions[definition.reps as keyof typeof ExerciseSetDefinitions];

    const currentSet = sets[exerciseSetIndex > sets.length ? 0 : exerciseSetIndex];

    const weights = store.configuration.weights[exercise.definition];
    const weight =
      Math.ceil(
        Number(weights && weights.current ? weights.current * currentSet.weightFactor : 0) / 0.5
      ) * 0.5;

    let supertitle;

    switch (currentSet.type) {
      case 'AMRAP':
        supertitle = 'AS MANY REPS AS POSSIBLE';
        break;
      case 'NORMAL':
        supertitle = 'Set';
        break;
      case 'WARMUP':
        supertitle = 'Warm-up set';
        break;
      default:
        supertitle = 'Set';
        break;
    }

    const numOtherSets = sets.filter(
      (set, idx) => set.type !== currentSet.type && idx < exerciseSetIndex
    ).length;
    const setNumber = numOtherSets ? (exerciseSetIndex % numOtherSets) + 1 : exerciseSetIndex + 1;

    if (this.props.restTime) {
      return <RestTimer ms={this.props.restTime} onDone={() => this.props.setRestTime(null)} />;
    }

    return !exercise ? null : (
      <>
        {definition.url && <Info url={definition.url} />}
        <ScreenLayout
          image={
            definition.background && Backgrounds[definition.background]
              ? definition.background
              : 'default'
          }
        >
          <Grid size={2} vertical="center" horizontal="center">
            <ScreenTitle
              title={definition.name}
              supertitle={`${supertitle} #${setNumber}`}
              subtitle={weight ? `${weight}kg` : ''}
            />
          </Grid>

          <Grid size={3} vertical="center">
            <Text style={styles.instructions}>
              {currentSet.count !== null
                ? definition.description
                : 'This is your time to shine. Perform as many reps as you possibly can with good form. If you can do more than 5, your weight will increase next time: This is progress!'}
            </Text>
          </Grid>

          <Grid size={2}>
            <DataValueDisplay
              onChange={(value: number) => setAMRAP(value)}
              value={currentSet.count === null ? amrap || 0 : currentSet.count}
              allowInput={currentSet.count === null}
              step={1}
              unit="reps"
            />
          </Grid>

          <Grid row size={4} style={{ justifyContent: 'space-between' }}>
            <Grid size={5.5}>
              <FormDescription hints={definition.goodForm} />
            </Grid>
            <Grid size={1} vertical="center" horizontal="center">
              <View style={styles.formDivider} />
            </Grid>
            <Grid size={5.5}>
              <FormDescription bad hints={definition.badForm} />
            </Grid>
          </Grid>

          <Grid row size={1}>
            <Button
              onPress={() => {
                if (!currentSet.count && onAMRAP) {
                  onAMRAP(amrap);
                }
                if (exerciseSetIndex === sets.length - 1) {
                  onDone(exercise);
                } else {
                  setExerciseSetIndex(exerciseSetIndex + 1);
                }

                if (currentSet.restTime) {
                  this.props.setRestTime(currentSet.restTime);
                }
              }}
            >
              Done
            </Button>
          </Grid>
        </ScreenLayout>
      </>
    );
  }
}

export default compose<IWorkoutInnerProps, IWorkoutProps>(
  withApplicationState,
  withState('exerciseSetIndex', 'setExerciseSetIndex', 0),
  withState('restTime', 'setRestTime', null),
  withState('amrap', 'setAMRAP', 0)
)(Workout);
