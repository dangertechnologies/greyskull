import { findIndex, chunk } from 'lodash';
import React from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { NavigationScreenProps, NavigationState } from 'react-navigation';
import { compose } from 'recompose';

import Layout from '../../Components/Layout/Layout';
import WorkoutItem from '../../Components/WorkoutItem';
import { IAppState, withApplicationState } from '../../Store/ApplicationState';

interface IScreenProps extends NavigationScreenProps<NavigationState>, IAppState {}

const BACKGROUND_IMAGE = require('../../Images/Backgrounds/empty-gym-blur.jpg');

class Screen extends React.PureComponent<IScreenProps> {
  public render(): JSX.Element {
    const { store } = this.props;

    const benchmarkComplete = !Boolean(
      store.workoutPlan.length < 1 && store.configuration.initialSetupComplete
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
              onPress={() =>
                this.props.navigation.navigate({ routeName: 'WorkoutBenchmarkScreen' })
              }
              workout={{
                exercises: Object.values(store.configuration.exercises).filter(
                  ({ include }) => include !== 'EXCLUDED'
                ),
              }}
            />
          ) : (
            <SectionList
              sections={chunk(store.workoutPlan, 3).map((v, k) => ({
                data: v,
                title: `Week ${k + 1}`,
              }))}
              renderSectionHeader={({ section }) => (
                <Text style={{ color: '#FFFFFF', marginTop: 20, fontWeight: '100', fontSize: 20 }}>
                  {section.title}
                </Text>
              )}
              contentContainerStyle={{ marginTop: -20 }}
              initialScrollIndex={findIndex(store.workoutPlan, ({ completed }) => !completed)}
              keyExtractor={({ id }) => `workout-${id}`}
              renderItem={({ item, index }) => (
                <WorkoutItem
                  number={`${item.id + 1}`}
                  onPress={() =>
                    this.props.navigation.navigate({
                      params: { workout: item },
                      routeName: 'WorkoutScreen',
                    })
                  }
                  disabled={store.workoutPlan.some(
                    ({ completed, id }, _index) => !completed && item.id > _index
                  )}
                  workout={item}
                />
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

export default compose<IScreenProps, IScreenProps>(withApplicationState)(Screen);
