import React from "react";
import { View, StyleSheet, Text, Image, TouchableOpacity } from "react-native";

import { NavigationScreenProps, NavigationState } from "react-navigation";
import { compose } from "recompose";
import { graphql, DataValue, MutationFn } from "react-apollo";
import gql from "graphql-tag";
import Button from "../../Components/Button";

import Layout from "../../Components/Layout";
import IconBox from "./IconBox";
import { Query } from "../../Apollo/types";

const QUERY_EXERCISES = gql`
  query AllExercises {
    user @client {
      id
      configured
    }

    exercises @client {
      id
      shortName
      icon
      include
      name
    }
  }
`;

const MUTATION_COMPLETE_CONFIGURATION = gql`
  mutation CompleteConfiguration {
    completeConfiguration @client {
      user {
        id
        configured
      }
    }
  }
`;

const MUTATION_TOGGLE_INCLUSION = gql`
  mutation AddExercise($exerciseId: String!) {
    toggleIncludeExercise(input: { exerciseId: $exerciseId }) @client {
      exercise {
        id
        shortName
        icon
        name
        include
      }
    }
  }
`;

interface IScreenProps extends NavigationScreenProps<NavigationState> {
  data: DataValue<Query>;
  toggleIncluded: MutationFn;
  saveConfig: MutationFn;
}

interface IConfigurationState {
  optionalExercises: {};
}

const BACKGROUND_IMAGE = require("../../Images/Backgrounds/dumbbell-female-blur.jpg");

class Screen extends React.Component<IScreenProps, IConfigurationState> {
  componentDidUpdate() {
    if (this.props.data.user && this.props.data.user.configured) {
      this.props.navigation.navigate("ScheduleScreen");
    }
  }

  public render(): JSX.Element {
    return (
      <Layout image={BACKGROUND_IMAGE} title="Get Started">
        <View style={styles.instructions}>
          <Text style={styles.body}>
            The training program comes with 6 default exercises. You can add
            additional exercises to the program if you want a heavier workout.
          </Text>

          <View style={styles.exercises}>
            <IconBox
              title="Always included"
              exercises={
                this.props.data && this.props.data.exercises
                  ? this.props.data.exercises.filter(
                      ({ include }) => include === "REQUIRED"
                    )
                  : []
              }
            />

            <IconBox
              title="Optional"
              exercises={
                this.props.data && this.props.data.exercises
                  ? this.props.data.exercises.filter(
                      ({ include }) => include !== "REQUIRED"
                    )
                  : []
              }
              onIconPress={exercise =>
                this.props.toggleIncluded({
                  variables: { exerciseId: exercise.id }
                })
              }
              checked={exercise => exercise.include === "INCLUDED"}
            />
          </View>

          <Button onPress={() => this.props.saveConfig()}>Done</Button>
        </View>
      </Layout>
    );
  }
}

const styles = StyleSheet.create({
  instructions: {
    marginVertical: 10,
    flex: 1
  },
  body: {
    fontWeight: "100",
    color: "#FFFFFF",
    fontSize: 20
  },

  exercises: {
    flexDirection: "column",
    justifyContent: "space-around",
    paddingTop: 50
  }
});

export default compose<IScreenProps, IScreenProps>(
  graphql(QUERY_EXERCISES),
  graphql(MUTATION_TOGGLE_INCLUSION, { name: "toggleIncluded" }),
  graphql(MUTATION_COMPLETE_CONFIGURATION, { name: "saveConfig" })
)(Screen);
