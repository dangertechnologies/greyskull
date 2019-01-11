import React from 'react';
import { StyleSheet, View, Text, FlatList } from 'react-native';

import { NavigationScreenProps, NavigationState } from 'react-navigation';
import { compose } from 'recompose';

import Layout from '../../Components/Layout';
import WorkoutItem from '../../Components/WorkoutItem';
import { withApplicationState } from '../../Providers/ApplicationState';
import { IApplicationState } from '../../Providers/Types';

interface IScreenProps extends NavigationScreenProps<NavigationState> {
  workoutPlan: IApplicationState['workoutPlan'];
  configuration: IApplicationState['configuration'];
}

const BACKGROUND_IMAGE = require('../../Images/Backgrounds/empty-gym-blur.jpg');

class Screen extends React.Component<IScreenProps> {
  public render(): JSX.Element {
    const benchmarkComplete = !Boolean(
      this.props.workoutPlan.length < 1 && this.props.configuration.initialSetupComplete
    );
    return (
      <Layout image={BACKGROUND_IMAGE} title="Next Up">
        {!benchmarkComplete && (
          <Text style={styles.benchmarkText}>
            Before your training can begin, we must determine your optimal weights for each
            exercise. The benchmark exercise below will help you find your 5 rep max weight.
          </Text>
        )}
        <View>
          {!benchmarkComplete ? (
            <WorkoutItem
              title="Find your optimal weights"
              number="0"
              workout={{
                steps: this.props.configuration.exercises.filter(
                  ({ include }) => include !== 'EXCLUDED'
                ),
              }}
            />
          ) : (
            <FlatList
              data={this.props.workoutPlan}
              keyExtractor={({ id }) => `workout-${id}`}
              renderItem={({ item, index }) => (
                <WorkoutItem number={`${index + 1}`} workout={item} />
              )}
            />
          )}
        </View>
      </Layout>
    );
  }
}

const styles = StyleSheet.create({
  benchmarkText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '100',
    marginBottom: 30,
    marginTop: 10,
  },
});

export default compose<IScreenProps, IScreenProps>(
  withApplicationState('workoutPlan'),
  withApplicationState('configuration')
)(Screen);
