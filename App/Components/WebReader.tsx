import React from 'react';
import { ActivityIndicator, StyleSheet, WebView, TouchableOpacity } from 'react-native';
import { View } from 'react-native-animatable';
import YouTube from 'react-native-youtube';
import Drawer from './Drawer';

interface IWebReaderProps {}
interface IWebReaderState {
  url: string | null;
  video: string | null;
}

interface IWebReaderContext extends IWebReaderState {
  open(url: string): void;
  playYoutubeVideo(youtubeId: string): void;
}

const DEFAULT_CONTEXT: IWebReaderContext = {
  open: () => {
    throw new Error('Context not initialized');
  },
  playYoutubeVideo: () => {
    throw new Error('Context not initialized');
  },
  url: null,
  video: null,
};

const { Provider, Consumer } = React.createContext(DEFAULT_CONTEXT);

const extractYoutubeId = (idOrUrl: string) => {
  if (/watch\?v=/.test(idOrUrl)) {
    return idOrUrl.replace(/.*watch\?v=/, '');
  }

  if (/youtu\.?be(\.com)?\//.test(idOrUrl)) {
    return idOrUrl.replace(/.*youtu\.?be(\.com)?\//, '');
  }
  return idOrUrl;
};
class WebReaderProvider extends React.Component<IWebReaderProps, IWebReaderState> {
  public state: IWebReaderState = {
    url: null,
    video: null,
  };

  public open = (url: string) => this.setState({ url });
  public playYoutubeVideo = (video: string) => this.setState({ video: extractYoutubeId(video) });
  public render(): JSX.Element {
    return (
      <Provider
        value={{
          open: this.open,
          playYoutubeVideo: this.playYoutubeVideo,
          url: this.state.url,
          video: this.state.video,
        }}
      >
        {this.props.children}

        {this.state.video && (
          <TouchableOpacity
            style={[
              StyleSheet.absoluteFill,
              {
                alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.7)',
                justifyContent: 'center',
              },
            ]}
            onPress={() => this.setState({ video: null })}
          >
            <YouTube
              videoId={this.state.video} // The YouTube video ID
              play={true} // control playback of video with true/false
              fullscreen // control whether the video should play in fullscreen or inline
              loop={false} // control whether the video should loop when ended
              style={{ alignSelf: 'stretch', height: 300 }}
            />
          </TouchableOpacity>
        )}
        {this.state.url && (
          <Drawer
            initialSnapIndex={2}
            snapTo={[-1, '30%', '80%']}
            onOutOfScreen={() => this.setState({ url: null })}
          >
            {
              <WebView
                source={{ uri: this.state.url }}
                style={{ flex: 1 }}
                renderLoading={() => (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator />
                  </View>
                )}
                startInLoadingState
              />
            }
          </Drawer>
        )}
      </Provider>
    );
  }
}

export { WebReaderProvider, Consumer };
