import React from 'react';
import Drawer from './Drawer';
import { WebView } from 'react-native';

interface IWebReaderProps {}
interface IWebReaderState {
  url: string | null;
}

interface IWebReaderContext extends IWebReaderState {
  open(url: string): void;
}

const DEFAULT_CONTEXT: IWebReaderContext = {
  open: () => {
    throw new Error('Context not initialized');
  },
  url: null,
};

const { Provider, Consumer } = React.createContext(DEFAULT_CONTEXT);

class WebReaderProvider extends React.Component<IWebReaderProps, IWebReaderState> {
  public state: IWebReaderState = {
    url: null,
  };

  public open = (url: string) => this.setState({ url });
  public render(): JSX.Element {
    return (
      <Provider value={{ url: this.state.url, open: this.open }}>
        {this.props.children}

        {this.state.url && (
          <Drawer
            initialSnapIndex={2}
            snapTo={[-1, '30%', '80%']}
            onOutOfScreen={() => this.setState({ url: null })}
          >
            {<WebView source={{ uri: this.state.url }} style={{ flex: 1 }} />}
          </Drawer>
        )}
      </Provider>
    );
  }
}

export { WebReaderProvider, Consumer };
