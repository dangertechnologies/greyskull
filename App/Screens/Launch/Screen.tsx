import React from "react";
import { View, StyleSheet } from "react-native";

import { NavigationScreenProps, NavigationState } from "react-navigation";
import { compose } from "recompose";

import Layout from "../../Components/Layout";
import Title from "../../Components/Title";

interface IScreenProps extends NavigationScreenProps<NavigationState> {}

const BACKGROUND_IMAGE = require("../../Images/Backgrounds/athlete-nonfree-blur.jpg");

class Screen extends React.Component<IScreenProps> {
  public render(): JSX.Element {
    return (
      <Layout
        image={BACKGROUND_IMAGE}
        containerStyle={{ alignItems: "center", justifyContent: "center" }}
      >
        <Title
          title="Greyskull LP"
          subtitle="8 week program"
          containerStyle={{ marginTop: -100 }}
        />
      </Layout>
    );
  }
}

const styles = StyleSheet.create({});

export default compose<IScreenProps, IScreenProps>()(Screen);
