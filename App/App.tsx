import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ApolloProvider } from "react-apollo";
import Navigation from "./Screens";
import ApolloClient from "apollo-client";
import { link, cache } from "./Apollo/Schema";

const client = new ApolloClient({ link, cache });

export default class App extends React.Component {
  componentDidMount() {
    // client.resetStore();
  }
  render() {
    return (
      <View style={styles.container}>
        <ApolloProvider client={client}>
          <Navigation />
        </ApolloProvider>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff000"
  }
});
