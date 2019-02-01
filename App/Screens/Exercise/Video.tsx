import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { Consumer } from '../../Components/WebReader';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    left: 15,
    position: 'absolute',
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
      <TouchableOpacity style={styles.container} onPress={() => webCtx.playYoutubeVideo(url)}>
        <Ionicons name="ios-play-circle" color="#FFFFFF" size={30} />
      </TouchableOpacity>
    )}
  </Consumer>
);

export default Info;
