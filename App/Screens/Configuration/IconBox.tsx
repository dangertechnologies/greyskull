import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Icon, { IExerciseIconProps } from '../../Components/ExerciseIcon';
import { IExerciseConfiguration } from '../../Store/Types';

interface IIconBox {
  exercises: IExerciseConfiguration[];
  title: string;
  checked?(exercise: IExerciseConfiguration): boolean | undefined;
  onIconPress?(exercise: IExerciseConfiguration): any;
}
const IconBox = ({ exercises, title, checked, onIconPress }: IIconBox) => (
  <View style={styles.exerciseArea}>
    <Text style={styles.exercisesTitle}>{title}</Text>
    <View style={styles.icons}>
      {exercises.map(e => (
        <Icon
          onPress={() => onIconPress && onIconPress(e)}
          key={e.shortName}
          name={e.icon as IExerciseIconProps['name']}
          label={e.name}
          checked={checked && checked(e)}
          style={styles.iconContainer}
        />
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  exerciseArea: {
    height: '100%',
    marginTop: 15,
  },

  exercisesTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '300',
    marginVertical: 10,
    textAlign: 'center',
  },

  check: {
    position: 'absolute',
    right: 0,
    top: 0,
  },

  icons: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    width: '100%',
  },

  iconContainer: {
    alignItems: 'center',
    flex: undefined,
    justifyContent: 'center',
    marginVertical: 10,
    width: '33.333%',
  },
});

export default IconBox;
