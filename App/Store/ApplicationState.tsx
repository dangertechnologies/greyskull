import { merge } from 'lodash';
import React from 'react';
import { AsyncStorage } from 'react-native';
import { IApplicationState } from './Types';

const exercises = require('../Configuration/exercises.json');

const CACHE_KEY = `GSLP_STATE_13`;

type RecursivePartial<T> = { [P in keyof T]?: RecursivePartial<T[P]> };

const INITIAL_STATE: IApplicationState = {
  configuration: {
    exercises,
    initialSetupComplete: false,
    weights: {},
  },

  workoutPlan: [],
};

export interface IAppState {
  store: IApplicationState;
  update(value?: RecursivePartial<IApplicationState>): any;
}

const INITIAL_CONTEXT: IAppState = {
  store: INITIAL_STATE,
  update: () => {
    throw new Error('Provider not initialized');
  },
};

const { Provider, Consumer } = React.createContext(INITIAL_CONTEXT);

interface IApplicationStateProps {
  backend?: typeof AsyncStorage;
  children: React.ReactNode;
}

class ApplicationStateProvider extends React.Component<IApplicationStateProps, IApplicationState> {
  public state: IApplicationState = INITIAL_STATE;

  public async componentDidMount() {
    const backend = this.props.backend || AsyncStorage;

    const initialState = await backend.getItem(CACHE_KEY);

    if (initialState) {
      this.setState(JSON.parse(initialState));
    } else {
      this.persist();
    }
  }

  public update = (value: Partial<IApplicationState>) => {
    this.setState(merge(this.state, value), this.persist);
  };

  public render(): JSX.Element {
    return (
      <Provider value={{ update: this.update, store: this.state }}>{this.props.children}</Provider>
    );
  }

  private persist = async () => {
    (this.props.backend || AsyncStorage).setItem(CACHE_KEY, JSON.stringify(this.state));
  };
}

const withApplicationState = <T extends {}>(
  Component: React.ComponentType<T & IAppState>
): React.ComponentType<T> => (props: T) => (
  <Consumer>{applicationState => <Component {...props} {...applicationState} />}</Consumer>
);

export { ApplicationStateProvider as Provider, withApplicationState };
