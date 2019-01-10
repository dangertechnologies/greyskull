import React from "react";
import { View, StyleSheet, Text } from "react-native";

import Icon, { IExerciseIconProps } from "../../Components/ExerciseIcon";
import { ExerciseConfiguration } from "../../Apollo/types";

interface IIconBox {
  exercises: ExerciseConfiguration[];
  title: string;
  checked?(exercise: ExerciseConfiguration): boolean | undefined;
  onIconPress?(exercise: ExerciseConfiguration): any;
}
const IconBox = ({ exercises, title, checked, onIconPress }: IIconBox) => (
  <View style={styles.exerciseArea}>
    <Text style={styles.exercisesTitle}>{title}</Text>
    <View style={styles.icons}>
      {exercises.map(e => (
        <Icon
          onPress={() => onIconPress && onIconPress(e)}
          key={e.shortName}
          name={e.icon as IExerciseIconProps["name"]}
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
    height: 200
  },

  exercisesTitle: {
    fontWeight: "300",
    color: "#FFFFFF",
    fontSize: 20,
    textAlign: "center",
    marginVertical: 10
  },

  check: {
    position: "absolute",
    right: 0,
    top: 0
  },

  icons: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-evenly",
    width: "100%",
    flexWrap: "wrap"
  },

  iconContainer: {
    flex: undefined,
    marginVertical: 10,
    width: "33.333%",
    alignItems: "center",
    justifyContent: "center"
  }
});

export default IconBox;
