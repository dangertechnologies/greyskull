import Exercises from "./Exercises";
import pickBy from "lodash/pickBy";
import mapValues from "lodash/mapValues";

type ExerciseConfig = { [K in keyof typeof Exercises]: number };

const DEADLIFT_DAYS = ["MILITARY_PRESS", "DEADLIFT", "CURL"];
const SQUAT_DAYS = ["BENCH_PRESS", "BARBELL_SQUAT", "CHIN"];

const buildSchedule = (exercises: ExerciseConfig) => {
  // Exercise sequence is as follows:
  // 1.1 Press, Squat, Row, Curl
  // 1.2 Bench, Deadlift, Row, Chin
  // Repeat 3x8

  return Array.from({ length: 8 * 3 }, (_, i: number) =>
    mapValues(
      pickBy(
        Exercises,
        (value, key) =>
          (i % 2 === 0 ? SQUAT_DAYS : DEADLIFT_DAYS).indexOf(key) !== -1 &&
          Object.keys(exercises).indexOf(key) !== -1
      ),
      (
        value: typeof Exercises[keyof typeof Exercises],
        key: keyof ExerciseConfig
      ) => ({
        ...value,
        weight: exercises[key] + value.incrementFactor * Number(i / 2)
      })
    )
  );
};

export default buildSchedule;
