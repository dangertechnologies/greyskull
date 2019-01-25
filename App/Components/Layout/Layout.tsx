import React from 'react';
import { ImageBackground, SafeAreaView, StyleSheet } from 'react-native';
import { compose } from 'recompose';

import Backgrounds from '../../Images/Backgrounds';

interface ILayoutProps {
  children: React.ReactNode;
  image: keyof typeof Backgrounds;
  containerStyle?: object;
}

class Layout extends React.PureComponent<ILayoutProps> {
  public render(): JSX.Element {
    return (
      <ImageBackground
        source={Backgrounds[this.props.image] || Backgrounds.default}
        resizeMode="cover"
        style={styles.background}
      >
        <SafeAreaView style={[styles.container, this.props.containerStyle]}>
          {this.props.children}
        </SafeAreaView>
      </ImageBackground>
    );
  }
}

const styles = StyleSheet.create({
  background: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'stretch',
  },
  container: {
    alignItems: 'center',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    flexGrow: 1,
    marginBottom: 20,
    marginHorizontal: 35,
    zIndex: 2,
  },
});

export default Layout;
