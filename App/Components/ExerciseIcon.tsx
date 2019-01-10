import React from "react";
import {
  Image,
  View,
  ViewProps,
  StyleSheet,
  Text,
  TouchableOpacity
} from "react-native";

// @ts-ignore
import RNVIcon from "react-native-vector-icons/Ionicons";
import Icons from "../Configuration/Icons";

const styles = StyleSheet.create({
  icon: {
    width: 38,
    height: 38,
    resizeMode: "cover"
  },
  container: {
    width: 38,
    height: 38
  },
  label: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "100",
    textAlign: "center",
    width: "100%"
  },
  check: {
    position: "absolute",
    right: 0,
    top: 0
  },
  faded: {
    opacity: 0.5
  }
});

export interface IExerciseIconProps {
  name: keyof typeof Icons;
  label?: string;
  style?: ViewProps["style"];
  onPress?(): any;
  checked?: boolean;
}

const ExerciseIcon = ({
  name,
  label,
  style,
  checked,
  onPress
}: IExerciseIconProps) => {
  const Container: React.ComponentType<any> = onPress ? TouchableOpacity : View;
  return (
    <Container style={style || styles.container} onPress={onPress}>
      <Image
        style={[
          styles.icon,
          checked !== undefined && !checked ? styles.faded : {}
        ]}
        source={Icons[name]}
      />
      {label && (
        <Text numberOfLines={2} style={styles.label}>
          {label}
        </Text>
      )}
      {checked && (
        <RNVIcon
          name="ios-checkmark"
          size={30}
          style={styles.check}
          color="green"
        />
      )}
    </Container>
  );
};

export default ExerciseIcon;
