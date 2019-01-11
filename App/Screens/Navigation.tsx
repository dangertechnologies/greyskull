import { createAppContainer, createStackNavigator } from 'react-navigation';
import Configuration from './Configuration';
import Launch from './Launch';
import Schedule from './Schedule';
import Workout from './Workout';
import WorkoutBenchmark from './WorkoutBenchmark';
import WorkoutSummary from './WorkoutSummary';

export default createAppContainer(
  createStackNavigator(
    {
      ConfigurationScreen: Configuration,
      LaunchScreen: Launch,
      ScheduleScreen: Schedule,
      WorkoutBenchmarkScreen: WorkoutBenchmark,
      WorkoutScreen: Workout,
      WorkoutSummaryScreen: WorkoutSummary,
    },
    {
      headerMode: 'none',
      initialRouteName: 'ScheduleScreen',
      containerOptions: {
        style: { flex: 1 },
      },
    }
  )
);
