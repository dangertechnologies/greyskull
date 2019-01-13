import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { Consumer } from '../WebReader';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 40,
    top: 40,
    zIndex: 1001,
  },
});

interface IInfoProps {
  url: string;
}

const Info = ({ url }: IInfoProps) => (
  <Consumer>
    {webCtx => (
      <TouchableOpacity style={styles.container} onPress={() => webCtx.open(url)}>
        <Ionicons name="ios-information-circle-outline" color="#FFFFFF" size={30} />
      </TouchableOpacity>
    )}
  </Consumer>
);

export default Info;
