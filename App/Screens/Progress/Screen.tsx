import { get } from 'lodash';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Swiper from 'react-native-swiper';
import Entypo from 'react-native-vector-icons/Entypo';
import { NavigationScreenProp, NavigationState } from 'react-navigation';
import { compose } from 'recompose';
import { ExerciseDefinitions } from '../../Configuration';

import Progress from '../../Components/Progress/Progress';
import { IAppState, withApplicationState } from '../../Store/ApplicationState';

interface IProgressScreenParams {
  filter: Array<keyof typeof ExerciseDefinitions>;
}

interface IScreenProps extends IAppState {
  navigation: NavigationScreenProp<NavigationState, IProgressScreenParams>;
}

class Screen extends React.PureComponent<IScreenProps> {
  public render(): JSX.Element {
    const { store } = this.props;

    const benchmarkComplete = !Boolean(
      store.workoutPlan.length < 1 && store.configuration.initialSetupComplete
    );

    const { filter } = this.props.navigation.state.params;

    const exercises = Object.keys(store.configuration.exercises)
      .filter(e => (filter ? filter.indexOf(e as keyof typeof ExerciseDefinitions) !== -1 : true))
      .filter(e =>
        Boolean(
          store.configuration.exercises[e as keyof typeof ExerciseDefinitions].include !==
            'EXCLUDED' &&
            store.configuration.weights[e as keyof typeof ExerciseDefinitions] &&
            get(store.configuration, ['weights', e, 'current'], 0) > 0
        )
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
        onIndexChanged={(i: number) =>
          i === exercises.length ? this.props.navigation.navigate('ScheduleScreen') : null
        }
      >
        {exercises
          .map(name => (
            <Progress key={name} exerciseName={name as keyof typeof ExerciseDefinitions} />
          ))
          .concat(!filter ? [] : [<View style={{ backgroundColor: '#000000', flex: 1 }} />])}
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
