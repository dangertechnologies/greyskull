import { chunk, get } from 'lodash';
import React from 'react';
import { SectionList, StyleSheet, Text } from 'react-native';
import Swiper from 'react-native-swiper';
import Entypo from 'react-native-vector-icons/Entypo';
import { NavigationScreenProps, NavigationState } from 'react-navigation';
import { compose } from 'recompose';
import { ExerciseDefinitions } from '../../Configuration';

import { ScreenLayout, ScreenTitle } from '../../Components/Layout';
import Grid from '../../Components/Layout/Grid';
import Progress from '../../Components/Summary/Progress';
import WorkoutItem from '../../Components/WorkoutItem';
import { IAppState, withApplicationState } from '../../Store/ApplicationState';

interface IScreenProps extends NavigationScreenProps<NavigationState>, IAppState {}

class Screen extends React.PureComponent<IScreenProps> {
  public render(): JSX.Element {
    const { store } = this.props;

    const benchmarkComplete = !Boolean(
      store.workoutPlan.length < 1 && store.configuration.initialSetupComplete
    );

    return (
      <Swiper
        showsButtons
        showsPagination
        dotColor="#FFFFFF"
        dotStyle={styles.paginationDot}
        activeDotStyle={styles.paginationDotActive}
        prevButton={<Entypo name="chevron-thin-left" size={25} color="#FFFFFF" />}
        nextButton={<Entypo name="chevron-thin-right" size={25} color="#FFFFFF" />}
      >
        {[
          <ScreenLayout image="empty-gym" key="schedule">
            <Grid size={2}>
              <ScreenTitle title="Next Up" />
            </Grid>

            {!benchmarkComplete && (
              <Grid size={3}>
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
                    <Text
                      style={{ color: '#FFFFFF', marginTop: 20, fontWeight: '100', fontSize: 20 }}
                    >
                      {section.title}
                    </Text>
                  )}
                  contentContainerStyle={{ marginTop: -20, width: '100%' }}
                  // initialScrollIndex={findIndex(store.workoutPlan, ({ completed }) => !completed)}
                  keyExtractor={({ id }) => `workout-${id}`}
                  style={{ width: '100%' }}
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
            </Grid>
          </ScreenLayout>,
        ].concat(
          Object.keys(this.props.store.configuration.exercises)
            .filter(e =>
              Boolean(
                store.configuration.exercises[e as keyof typeof ExerciseDefinitions].include !==
                  'EXCLUDED' &&
                  store.configuration.weights[e as keyof typeof ExerciseDefinitions] &&
                  get(store.configuration, ['weights', e, 'current'], 0) > 0
              )
            )
            .map(name => (
              <Progress key={name} exerciseName={name as keyof typeof ExerciseDefinitions} />
            ))
        )}
      </Swiper>
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
  paginationDot: { borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: 'transparent' },
  paginationDotActive: { borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: '#FFFFFF' },
});

export default compose<IScreenProps, IScreenProps>(withApplicationState)(Screen);
