import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";

interface ITitleProps {
  title: string;
  subtitle?: string;
  containerStyle?: object;
}

const { width } = Dimensions.get("screen");

const Title = ({ title, subtitle, containerStyle }: ITitleProps) => (
  <View style={[styles.titleContainer, containerStyle]}>
    <Text style={styles.title}>{title}</Text>
    <View style={styles.line} />
    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
  </View>
);

const styles = StyleSheet.create({
  titleContainer: {
    marginTop: 50,
    marginHorizontal: 50,
    width: width - 100,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    fontWeight: "100",
    color: "#FFFFFF",
    fontSize: 48
  },
  subtitle: {
    fontWeight: "100",
    color: "#FFFFFF",
    fontSize: 24
  },
  line: {
    height: StyleSheet.hairlineWidth,
    width: width - 100,
    marginHorizontal: 50,
    marginVertical: 5,
    backgroundColor: "#FFFFFF"
  }
});

export default Title;
