import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationScreenProp, NavigationState } from 'react-navigation';
import { compose } from 'recompose';

import { ExerciseSetDefinitions } from '../../Configuration';
import Backgrounds from '../../Images/Backgrounds';
import { IAppState, IExercise, withApplicationState } from '../../Store';

import Button from '../../Components/Button';
import { Grid, ScreenLayout, ScreenTitle } from '../../Components/Layout';
import RestTimer from '../../Components/RestTimer';
import DataValueDisplay from './DataValueDisplay';
import FormDescription from './Hints';
import Info from './Info';
import Video from './Video';

interface IExerciseScreenParams {
  exercise: IExercise;
  onAMRAP?(amrap: number): any;
  onDone(exercise: IExercise): any;
}

interface IExerciseScreenProps {
  navigation: NavigationScreenProp<NavigationState, IExerciseScreenParams>;
}

interface IExerciseInnerProps extends IExerciseScreenProps, IAppState {}

interface IWorkoutState {
  exerciseSetIndex: number;
  restTime: number | null;
  amrap: number | null;
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

export class Screen extends React.PureComponent<IExerciseInnerProps, IWorkoutState> {
  public state: IWorkoutState = {
    amrap: null,
    exerciseSetIndex: 0,
    restTime: null,
  };

  public componentDidUpdate(oldProps: IExerciseInnerProps) {
    const { exercise } = this.props.navigation.state.params;

    if (exercise.definition !== oldProps.navigation.state.params.exercise.definition) {
      this.setExerciseSetIndex(0);
      this.setAMRAP(0);
    }
  }

  public render() {
    const { exercise, onDone, onAMRAP } = this.props.navigation.state.params;
    const { store } = this.props;

    const { amrap, exerciseSetIndex } = this.state;
    const definition = store.configuration.exercises[exercise.definition];
    console.log({ definition });
    const sets = ExerciseSetDefinitions[definition.reps as keyof typeof ExerciseSetDefinitions];
    console.log({ sets });

    const currentSet = sets[exerciseSetIndex > sets.length ? 0 : exerciseSetIndex];

    const weights = store.configuration.weights[exercise.definition];
    const weight =
      Math.ceil(
        Number(weights && weights.current ? weights.current * currentSet.weightFactor : 0) / 0.5
      ) * 0.5;

    let supertitle;

    switch (currentSet.type) {
      case 'AMRAP':
        supertitle = 'As Many Reps As Possible';
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

    if (this.state.restTime) {
      return <RestTimer ms={this.state.restTime} onDone={() => this.setRestTime(null)} />;
    }

    return !exercise ? null : (
      <>
        {definition.url && <Info url={definition.url} />}
        {definition.video && <Video url={definition.video} />}
        <ScreenLayout
          image={
            definition.background && Backgrounds[definition.background]
              ? definition.background
              : 'default'
          }
        >
          <Grid size={1} />
          <Grid size={2} vertical="center" horizontal="center">
            <ScreenTitle
              title={definition.name}
              supertitle={`${supertitle} #${setNumber}`}
              subtitle={weight ? `${weight}kg` : ''}
            />
          </Grid>

          <Grid size={1} vertical="center" />

          <Grid size={2.5}>
            <DataValueDisplay
              onChange={(value: number) => this.setAMRAP(value)}
              value={currentSet.count === null ? amrap || 0 : currentSet.count}
              allowInput={currentSet.count === null}
              step={1}
              unit="reps"
            />
          </Grid>
          <Grid size={0.5} vertical="center" />

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
                  onAMRAP(this.state.amrap || 0);
                }
                if (exerciseSetIndex === sets.length - 1) {
                  onDone(exercise);
                } else {
                  if (currentSet.restTime) {
                    this.setRestTime(currentSet.restTime);
                  }
                  this.setExerciseSetIndex((exerciseSetIndex || 0) + 1);
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

  private setAMRAP = (amrap: number) => this.setState({ amrap });
  private setExerciseSetIndex = (exerciseSetIndex: number) => this.setState({ exerciseSetIndex });
  private setRestTime = (restTime: number | null) => this.setState({ restTime });
}

export default compose<IExerciseInnerProps, IExerciseScreenProps>(withApplicationState)(Screen);
