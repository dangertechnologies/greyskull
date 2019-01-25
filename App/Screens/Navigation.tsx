import { Animated, Easing } from 'react-native';
import { createAppContainer, createStackNavigator } from 'react-navigation';

import Storybook from '../../storybook';
import Configuration from './Configuration';
import Launch from './Launch';
import Schedule from './Schedule';
import Workout from './Workout';
import WorkoutBenchmark from './WorkoutBenchmark';
import WorkoutSummary from './WorkoutSummary';

const crossFade = () => ({
  screenInterpolator: sceneProps => {
    const { layout, position, scene } = sceneProps;
    const { index } = scene;
    const height = layout.initHeight;
    const translateX = 0;
    const translateY = 0;
    const opacity = position.interpolate({
      extrapolate: 'clamp',
      inputRange: [index - 0.5, index],
      outputRange: [0.5, 1],
    });
    return { opacity, transform: [{ translateY }, { translateX }] };
  },
  transitionSpec: {
    duration: 500,
    easing: Easing.out(Easing.poly(4)),
    timing: Animated.timing,
  },
});

export default createAppContainer(
  createStackNavigator(
    {
      ConfigurationScreen: Configuration,
      LaunchScreen: {
        screen: Launch,
        navigationOptions: { style: { backgroundColor: 'transparent' } },
      },
      ScheduleScreen: Schedule,
      WorkoutBenchmarkScreen: WorkoutBenchmark,
      WorkoutScreen: Workout,
      WorkoutSummaryScreen: WorkoutSummary,

      Storybook,
    },
    {
      containerOptions: {
        style: { flex: 1, backgroundColor: 'transparent' },
      },
      headerMode: 'none',
      initialRouteName: 'Storybook',
      transitionConfig: crossFade,
    }
  )
);
