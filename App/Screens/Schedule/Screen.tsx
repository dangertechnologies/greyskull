import { chunk } from 'lodash';
import React from 'react';
import { SectionList, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { NavigationScreenProps, NavigationState } from 'react-navigation';
import { compose, withState } from 'recompose';

import { ScreenLayout, ScreenTitle } from '../../Components/Layout';
import Grid from '../../Components/Layout/Grid';
import Settings from '../../Components/Settings';
import WorkoutItem from '../../Components/WorkoutItem';
import { IAppState, withApplicationState } from '../../Store/ApplicationState';
interface IScreenProps extends NavigationScreenProps<NavigationState>, IAppState {
  settingsOpen: boolean;
  setSettingsOpen(open: boolean): any;
}

export class Screen extends React.PureComponent<IScreenProps> {
  public render(): JSX.Element {
    const { store } = this.props;

    const benchmarkComplete =
      store.workoutPlan.length > 1 && store.configuration.initialSetupComplete;

    const isProgramComplete = Boolean(
      benchmarkComplete && store.workoutPlan.every(workout => Boolean(workout.completed))
    );

    return (
      <>
        <ScreenLayout image="empty-gym" key="schedule">
          <Grid size={2}>
            <ScreenTitle title="Next Up" />
          </Grid>
          <TouchableOpacity
            onPress={() => this.props.setSettingsOpen(true)}
            style={styles.settingsIcon}
          >
            <Ionicons name="ios-cog" size={25} color="#FFFFFF" />
          </TouchableOpacity>

          {!benchmarkComplete && (
            <Grid size={4}>
              <Text style={styles.benchmarkText}>
                Before your training can begin, we must determine your optimal weights for each
                exercise. The benchmark exercise below will help you find your 5 rep max weight.
              </Text>
            </Grid>
          )}
          <Grid size={!benchmarkComplete ? 7 : 12} row>
            {!benchmarkComplete ? (
              <WorkoutItem
                title="Find your optimal weights"
                number="0"
                onPress={() =>
                  this.props.navigation.navigate({ routeName: 'WorkoutBenchmarkScreen' })
                }
                workout={{
                  exercises: Object.values(store.configuration.exercises).filter(
                    ({ include, bodyweight }) => include !== 'EXCLUDED' && !bodyweight
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
                  <Text
                    style={{ color: '#FFFFFF', marginTop: 20, fontWeight: '100', fontSize: 20 }}
                  >
                    {section.title}
                  </Text>
                )}
                contentContainerStyle={{ marginTop: -20, width: '100%' }}
                // initialScrollIndex={findIndex(store.workoutPlan, ({ completed }) => !completed)}
                keyExtractor={({ id }, index) => `workout-${id}-${index}`}
                style={{ width: '100%' }}
                renderItem={({ item, index }) => (
                  <WorkoutItem
                    number={`${item.id + 1}`}
                    key={item.id + 1}
                    onPress={() =>
                      this.props.navigation.navigate({
                        params: { workout: item },
                        routeName: 'WorkoutScreen',
                      })
                    }
                    disabled={Boolean(
                      item.completed ||
                        store.workoutPlan.some(
                          ({ completed, id }, _index) => !completed && item.id > _index
                        )
                    )}
                    workout={item}
                  />
                )}
              />
            )}
          </Grid>
        </ScreenLayout>

        <Settings
          title={isProgramComplete ? 'Finished' : undefined}
          subtitle={isProgramComplete ? 'You have completed 24 sessions' : undefined}
          open={isProgramComplete || this.props.settingsOpen}
          onClose={() => !isProgramComplete && this.props.setSettingsOpen(false)}
          onReset={() => {
            this.props.resetApplicationState();
            this.props.navigation.navigate('LaunchScreen');
          }}
        />
      </>
    );
  }
}

const styles = StyleSheet.create({
  benchmarkText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '100',
    // marginBottom: 30,
    marginTop: 10,
  },
  paginationDot: { borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: 'transparent' },
  paginationDotActive: { borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: '#FFFFFF' },
  settingsIcon: { position: 'absolute', right: 0, top: 40 },
});

export default compose<IScreenProps, IScreenProps>(
  withApplicationState,
  withState('settingsOpen', 'setSettingsOpen', false)
)(Screen);
