import { findIndex, isEqual, round } from 'lodash';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { compose, withState } from 'recompose';

import { ExerciseSetDefinitions } from '../../Configuration';
import Backgrounds from '../../Images/Backgrounds';
import { IAppState, IExercise, withApplicationState } from '../../Store';
import Button from '../Button';
import Layout from '../Layout/Layout';
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
  setExerciseSetIndex(idx: number): any;
  setRestTime(ms: number | null): any;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexGrow: 1,
    justifyContent: 'space-evenly',
    paddingBottom: 30,
  },
  formDescription: {
    flexDirection: 'row',
    height: 200,
    marginBottom: 50,
    marginTop: 50,
    width: '100%',
  },
  formDivider: {
    backgroundColor: '#FFFFFF',
    height: 100,
    marginHorizontal: 10,
    marginTop: 30,
    width: StyleSheet.hairlineWidth,
  },

  instructions: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '100',
    marginBottom: 20,
    marginTop: 20,
  },
});

class Workout extends React.PureComponent<IWorkoutInnerProps> {
  public componentDidUpdate(oldProps: IWorkoutInnerProps) {
    if (this.props.exercise.definition !== oldProps.exercise.definition) {
      this.props.setExerciseSetIndex(0);
    }
  }

  public render() {
    const { exercise, store, setExerciseSetIndex, exerciseSetIndex, onDone, onAMRAP } = this.props;
    const definition = store.configuration.exercises[exercise.definition];
    const sets = ExerciseSetDefinitions[definition.reps as keyof typeof ExerciseSetDefinitions];

    const currentSet = sets[exerciseSetIndex > sets.length ? 0 : exerciseSetIndex];

    const weights = store.configuration.weights[exercise.definition];
    const weight = Math.ceil(weights && weights.current ? weights.current : 0 / 0.25) * 0.25;

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
        <Layout
          image={
            definition.background && Backgrounds[definition.background]
              ? Backgrounds[definition.background]
              : Backgrounds.default
          }
          title={definition.name}
          supertitle={`${supertitle} #${setNumber}`}
          subtitle={weight ? `${weight}kg` : ''}
        >
          <View style={styles.container}>
            <Text style={styles.instructions} adjustsFontSizeToFit>
              {currentSet.count !== null
                ? ''
                : 'This is your time to shine. Perform as many reps as you possibly can with good form. If you can do more than 5, your weight will increase next time: This is progress!'}
            </Text>

            <DataValueDisplay
              onChange={(value: number) => onAMRAP && onAMRAP(value)}
              value={currentSet.count === null ? exercise.amrap || 0 : currentSet.count}
              allowInput={currentSet.count === null}
              step={1}
              unit="reps"
            />

            <View style={styles.formDescription}>
              <FormDescription hints={definition.goodForm} />
              <View style={styles.formDivider} />
              <FormDescription hints={definition.badForm} bad />
            </View>
            <Button
              onPress={() => {
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
          </View>
        </Layout>
      </>
    );
  }
}

export default compose<IWorkoutInnerProps, IWorkoutProps>(
  withApplicationState,
  withState('exerciseSetIndex', 'setExerciseSetIndex', 0),
  withState('restTime', 'setRestTime', null)
)(Workout);
