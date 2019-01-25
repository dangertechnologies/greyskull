import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { WebReaderProvider } from './Components/WebReader';
import Navigation from './Screens';
import { Provider } from './Store/ApplicationState';

export default class App extends React.Component {
  public render() {
    return (
      <Provider>
        <WebReaderProvider>
          <View style={styles.container}>
            <StatusBar backgroundColor="transparent" barStyle="light-content" />
            <Navigation />
          </View>
        </WebReaderProvider>
      </Provider>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    flex: 1,
  },
});
