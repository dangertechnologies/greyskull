import { get } from 'lodash';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createAnimatableComponent } from 'react-native-animatable';
import { IAppState, IExerciseConfiguration, IWorkout, withApplicationState } from '../Store';
import ExerciseIcon from './ExerciseIcon';

interface IBenchmarkWorkout {
  exercises: IExerciseConfiguration[];
}

interface IWorkoutItemProps {
  workout: IWorkout | IBenchmarkWorkout;
  title?: React.ReactNode;
  disabled?: boolean;
  number: string;
  onPress?(): any;
}

interface IWorkoutItemInnerProps extends IWorkoutItemProps, IAppState {}

const AnimatedButtonContainer = createAnimatableComponent(TouchableOpacity);

const styles = StyleSheet.create({
  container: {
    borderColor: '#FFFFFF',
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginVertical: 5,
    minHeight: 100,
    padding: 10,
    width: '100%',
  },

  disabled: { opacity: 0.5 },
  divider: { height: 50, marginTop: 15, width: 1, backgroundColor: '#FFFFFF' },

  icon: { margin: 3 },
  iconContainer: {
    alignItems: 'center',
    flex: 0.7,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  innerContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  number: { color: '#FFFFFF', fontSize: 48 },
  numberContainer: { flex: 0.29, alignItems: 'center', justifyContent: 'center' },

  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '100',
    marginBottom: 5,
  },
});

const WorkoutItem = ({
  workout,
  disabled,
  number,
  store,
  onPress,
  title,
}: IWorkoutItemInnerProps) => {
  const item = workout.hasOwnProperty('definition')
    ? (workout as IWorkout)
    : (workout as IBenchmarkWorkout);

  return (
    <>
      {title && <Text style={styles.title}>{title}</Text>}
      <AnimatedButtonContainer
        style={[styles.container, disabled ? styles.disabled : {}]}
        disabled={disabled}
        onPress={() => onPress && onPress()}
        animation="slideInUp"
      >
        <View style={styles.innerContainer}>
          {number && (
            <>
              <View style={styles.numberContainer}>
                <Text style={styles.number}>{number}</Text>
              </View>
              <View style={styles.divider} />
            </>
          )}

          <View style={styles.iconContainer}>
            {(workout as IWorkout).exercises.map((wrk, number) => {
              const definition = wrk.hasOwnProperty('definition')
                ? store.configuration.exercises[wrk.definition]
                : ((wrk as unknown) as IExerciseConfiguration);

              return (
                <ExerciseIcon
                  key={`${number}-${get(wrk, 'shortName', definition.shortName)}`}
                  style={styles.icon}
                  name={get(item, 'icon', definition.icon)}
                  label={get(item, 'shortName', definition.shortName)}
                />
              );
            })}
          </View>
        </View>
      </AnimatedButtonContainer>
    </>
  );
};

export default withApplicationState<IWorkoutItemProps>(WorkoutItem);
