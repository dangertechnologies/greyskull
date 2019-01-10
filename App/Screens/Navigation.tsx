import { createStackNavigator, createAppContainer } from "react-navigation";
import ConfigurationScreen from "./Configuration";
import LaunchScreen from "./Launch";
import ScheduleScreen from "./Schedule";
import WorkoutScreen from "./Workout";
import WorkoutBenchmarkScreen from "./WorkoutBenchmark";
import WorkoutSummaryScreen from "./WorkoutSummary";

export default createAppContainer(
  createStackNavigator(
    {
      ConfigurationScreen,
      LaunchScreen,
      ScheduleScreen,
      WorkoutScreen,
      WorkoutBenchmarkScreen,
      WorkoutSummaryScreen
    },
    {
      initialRouteName: "ConfigurationScreen",
      headerMode: "none"
    }
  )
);
