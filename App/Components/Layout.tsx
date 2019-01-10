import React from "react";
import {
  ImageBackground,
  View,
  ImageSourcePropType,
  StyleSheet
} from "react-native";
import Title from "./Title";

interface ILayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  image: ImageSourcePropType;
  containerStyle?: object;
}

const Layout = ({
  children,
  title,
  subtitle,
  image,
  containerStyle
}: ILayoutProps) => (
  <ImageBackground source={image} style={styles.background}>
    {title && <Title title={title} subtitle={subtitle} />}

    <View style={[styles.container, containerStyle]}>{children}</View>
  </ImageBackground>
);

const styles = StyleSheet.create({
  background: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: "cover",
    paddingTop: 50
  },

  container: {
    flexGrow: 1,
    flex: 1,
    marginHorizontal: 50
  }
});

export default Layout;
