import React from "react";
import { View, StyleSheet } from "react-native";

import { NavigationScreenProps, NavigationState } from "react-navigation";
import { compose } from "recompose";

import Layout from "../../Components/Layout";

interface IScreenProps extends NavigationScreenProps<NavigationState> {}

const BACKGROUND_IMAGE = require("../../Images/Backgrounds/squat-blur.jpg");

class Screen extends React.Component<IScreenProps> {
  public render(): JSX.Element {
    return (
      <Layout image={BACKGROUND_IMAGE} title="Barbell Squat">
        <View />
      </Layout>
    );
  }
}

const styles = StyleSheet.create({});

export default compose<IScreenProps, IScreenProps>()(Screen);
