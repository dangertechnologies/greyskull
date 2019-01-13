import { get } from 'lodash';
import React from 'react';
import { StyleSheet } from 'react-native';

import { NavigationScreenProps, NavigationState } from 'react-navigation';
import { compose } from 'recompose';

import { buildSchedule, ExerciseDefinitions } from '../../Configuration';

import BenchmarkWorkout from '../../Components/Exercise/Benchmark';
import { IAppState, withApplicationState } from '../../Store/ApplicationState';

interface IScreenProps extends NavigationScreenProps<NavigationState>, IAppState {}

interface IScreenState {
  currentKey: keyof typeof ExerciseDefinitions | null;
}
class Screen extends React.Component<IScreenProps> {
  public state: IScreenState = {
    currentKey: null,
  };

  public componentDidMount() {
    const { store } = this.props;

    this.setState({
      currentKey: Object.keys(store.configuration.exercises).find(
        key => !get(store.configuration, `weights.${key}.initial`)
      ),
    });
  }

  public next = () => {
    const { store } = this.props;

    const nextUnsetKey = Object.keys(store.configuration.exercises).find(
      key =>
        !get(store.configuration, `weights.${key}.initial`) &&
        !get(store.configuration, `exercises.${key}.bodyweight`, false)
    );
    console.log({ nextUnsetKey });
    if (!nextUnsetKey) {
      this.props.update(buildSchedule(store));
      this.props.navigation.navigate('ScheduleScreen');
    } else {
      this.setState({
        currentKey: nextUnsetKey,
      });
    }
  };

  public render(): JSX.Element {
    return (
      <>
        {this.state.currentKey && (
          <BenchmarkWorkout exerciseName={this.state.currentKey} onDone={() => this.next()} />
        )}
      </>
    );
  }
}

const styles = StyleSheet.create({});

export default compose<IScreenProps, IScreenProps>(withApplicationState)(Screen);
