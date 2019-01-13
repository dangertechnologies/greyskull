import { round } from 'lodash';
import React from 'react';
import { Text, View } from 'react-native';
import ProgressCircle from 'react-native-progress-circle';
import Layout from './Layout/Layout';

const DEFAULT_BACKGROUND = require('../Images/Backgrounds/rest-blur.jpg');

interface IRestTimerProps {
  ms: number;
  onDone?(): any;
}

interface IRestTimerState {
  percentage: number;
}

class RestTimer extends React.Component<IRestTimerProps, IRestTimerState> {
  public state: IRestTimerState = {
    percentage: 0.0,
  };
  public intervalId: ReturnType<typeof setInterval> | null = null;

  public componentDidMount() {
    this.intervalId = setInterval(this.progress, 100);
  }

  public progress = () => {
    this.setState(
      {
        percentage: this.state.percentage + 100 / this.props.ms,
      },
      () => {
        if (this.state.percentage >= 1 && this.intervalId) {
          clearInterval(this.intervalId);
          if (this.props.onDone) {
            this.props.onDone();
          }
        }
      }
    );
  };

  public render(): JSX.Element {
    return (
      <Layout title="Rest" image={DEFAULT_BACKGROUND}>
        <View style={{ flex: 1, flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ marginTop: -100 }}>
            <ProgressCircle
              percent={this.state.percentage * 100}
              radius={60}
              borderWidth={8}
              bgColor="#55CCFF"
              shadowColor="#55CCFF"
              color="#3399FF"
            >
              <Text style={{ fontSize: 48, fontWeight: '100', color: '#FFFFFF' }}>{`${round(
                round(this.props.ms - this.state.percentage * this.props.ms) / 1000
              )}`}</Text>
            </ProgressCircle>
          </View>
        </View>
      </Layout>
    );
  }
}

export default RestTimer;
