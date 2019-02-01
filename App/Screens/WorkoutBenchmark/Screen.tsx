import { get, pickBy } from 'lodash';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { NavigationScreenProps, NavigationState } from 'react-navigation';
import { compose } from 'recompose';

import ExerciseIcon from '../../Components/ExerciseIcon';
import { Grid, ScreenLayout, ScreenTitle } from '../../Components/Layout';
import { buildSchedule } from '../../Configuration';
import { IAppState, IExerciseConfiguration, withApplicationState } from '../../Store';

interface IScreenProps extends NavigationScreenProps<NavigationState>, IAppState {}

class Screen extends React.Component<IScreenProps> {
  public next = () => {
    const { store } = this.props;

    const nextUnsetKey = Object.keys(
      pickBy(store.configuration.exercises, e => e.include !== 'EXCLUDED' && !e.bodyweight)
    ).find(
      key =>
        !get(store.configuration, `weights.${key}.initial`) &&
        !get(store.configuration, `exercises.${key}.bodyweight`, false)
    );
    if (!nextUnsetKey) {
      this.props.update(buildSchedule(store));
      this.props.navigation.navigate('ScheduleScreen');
    } else {
      this.props.navigation.navigate({
        routeName: 'WorkoutBenchmarkScreen',
      });
    }
  };

  public render(): JSX.Element {
    const { store } = this.props;

    const exercises = pickBy(
      store.configuration.exercises,
      e => e.include !== 'EXCLUDED' && !e.bodyweight
    );

    return (
      <ScreenLayout image="default">
        <Grid size={2} vertical="center" horizontal="center">
          <ScreenTitle title="Find your weights" />
        </Grid>
        <Grid size={0.5} />
        <Grid size={9} column style={{ alignItems: 'center' }}>
          {Object.keys(exercises).map((exerciseName: keyof typeof exercises) => {
            const definition: IExerciseConfiguration = get(
              store.configuration,
              `exercises.${exerciseName}`
            );

            const initialWeight = get(store, `configuration.weights.${exerciseName}.initial`, 0);

            return (
              <Grid
                size={2}
                row
                vertical="center"
                horizontal="center"
                onPress={() =>
                  this.props.navigation.navigate({
                    params: {
                      exerciseName,
                      onDone: this.next,
                    },
                    routeName: 'ExerciseBenchmarkScreen',
                  })
                }
              >
                <Grid size={4} horizontal="center">
                  <View style={styles.iconCircle}>
                    {initialWeight ? (
                      <Ionicons
                        name="ios-checkmark"
                        color="#00FF00"
                        size={60}
                        style={{ lineHeight: 58 }}
                      />
                    ) : (
                      <ExerciseIcon name={definition.icon as any} />
                    )}
                  </View>
                </Grid>
                <Grid size={7} horizontal="left">
                  <Text style={styles.exerciseName}>{definition.name}</Text>
                </Grid>
              </Grid>
            );
          })}
        </Grid>
      </ScreenLayout>
    );
  }
}

const styles = StyleSheet.create({
  exerciseName: { color: '#FFFFFF', fontSize: 20, fontWeight: '100' },
  iconCircle: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
});

export default compose<IScreenProps, IScreenProps>(withApplicationState)(Screen);
