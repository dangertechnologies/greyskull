import { findIndex } from 'lodash';
import React from 'react';
import { StyleSheet } from 'react-native';

import { NavigationScreenProps, NavigationState } from 'react-navigation';
import { compose } from 'recompose';

import buildShedule from '../../Configuration/ScheduleBuilder';

import BenchmarkWorkout from '../../Components/BenchmarkWorkout';
import { withApplicationState } from '../../Providers/ApplicationState';
import { IApplicationState } from '../../Providers/Types';

interface IScreenProps extends NavigationScreenProps<NavigationState> {
  configuration: IApplicationState['configuration'];
  workoutPlan: IApplicationState['workoutPlan'];
  update(plan: IApplicationState['workoutPlan']): any;
}

interface IScreenState {
  currentIndex: number;
}
class Screen extends React.Component<IScreenProps> {
  state: IScreenState = {
    currentIndex: 0,
  };

  public componentDidMount() {
    this.setState({
      currentIndex: findIndex(
        this.props.configuration.exercises,
        ({ initialWeight }) => !initialWeight
      ),
    });
  }

  public next = () => {
    if (!this.props.configuration.exercises.some(({ initialWeight }) => !initialWeight)) {
      this.props.update(buildShedule(this.props.configuration.exercises));
      this.props.navigation.navigate('ScheduleScreen');
    } else {
      this.setState({
        currentIndex: findIndex(
          this.props.configuration.exercises,
          ({ initialWeight }) => !initialWeight
        ),
      });
    }
  };

  public render(): JSX.Element {
    return (
      <BenchmarkWorkout
        exerciseConfig={this.props.configuration.exercises[this.state.currentIndex]}
        onDone={this.next}
      />
    );
  }
}

const styles = StyleSheet.create({});

export default compose<IScreenProps, IScreenProps>(
  withApplicationState('configuration'),
  withApplicationState('workoutPlan')
)(Screen);
