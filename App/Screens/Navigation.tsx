import { Animated, Easing } from 'react-native';
import { createAppContainer, createStackNavigator, TransitionConfigurer } from 'react-navigation';

import Storybook from '../../storybook';
import ConfigurationScreen from './Configuration';
import ExerciseBenchmarkScreen from './Exercise/Benchmark';
import ExerciseScreen from './Exercise/Perform';
import LaunchScreen from './Launch';
import ProgressScreen from './Progress';
import ScheduleScreen from './Schedule';
import WorkoutScreen from './Workout';
import WorkoutBenchmarkScreen from './WorkoutBenchmark';

const crossFade: TransitionConfigurer = () => ({
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
      ConfigurationScreen,
      ExerciseBenchmarkScreen,
      ExerciseScreen,
      LaunchScreen,
      ProgressScreen,
      ScheduleScreen,
      WorkoutBenchmarkScreen,
      WorkoutScreen,

      Storybook,
    },
    {
      containerOptions: {
        style: { flex: 1, backgroundColor: 'transparent' },
      },
      headerMode: 'none',
      initialRouteName: 'LaunchScreen',

      transitionConfig: crossFade,
    }
  )
);
