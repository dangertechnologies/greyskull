import { round } from 'lodash';
import React from 'react';
import { Text } from 'react-native';
// @ts-ignore
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import Button from './Button';
import { Grid, ScreenLayout, ScreenTitle } from './Layout';

interface IRestTimerProps {
  ms: number;
  onDone?(): any;
}

interface IRestTimerState {
  percentage: number;
}

class RestTimer extends React.Component<IRestTimerProps, IRestTimerState> {
  static defaultProps = {
    ms: 30000,
  };
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
      <ScreenLayout image="rest">
        <Grid size={3} vertical="bottom">
          <ScreenTitle
            title="Cool down"
            subtitle="You perform better when you rest between sets"
            subtitleStyle={{ fontWeight: '100', fontSize: 20 }}
          />
        </Grid>

        <Grid size={7} vertical="center" horizontal="center">
          <AnimatedCircularProgress
            size={120}
            width={3}
            fill={this.state.percentage * 100}
            tintColor="#FFFFFF"
            onAnimationComplete={() => console.log('onAnimationComplete')}
            backgroundColor="rgba(255, 255, 255, 0.2)"
          >
            {() => (
              <Text style={{ fontSize: 48, fontWeight: '100', color: '#FFFFFF' }}>{`${round(
                round(this.props.ms - this.state.percentage * this.props.ms) / 1000
              )}`}</Text>
            )}
          </AnimatedCircularProgress>
        </Grid>
        <Grid size={1}>
          <></>
        </Grid>
        <Grid size={1} row>
          <Button onPress={this.props.onDone}>Skip</Button>
        </Grid>
      </ScreenLayout>
    );
  }
}

export default RestTimer;
