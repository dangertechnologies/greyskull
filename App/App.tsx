import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Provider } from './Providers/ApplicationState';
import Navigation from './Screens';

export default class App extends React.Component {
  public render() {
    return (
      <Provider>
        <View style={styles.container}>
          <Navigation />
        </View>
      </Provider>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
