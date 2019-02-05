import { isEqual } from 'lodash';
import LottieView from 'lottie-react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { Text, View } from 'react-native-animatable';
import { BlurView } from 'react-native-blur';
// @ts-ignore
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import { metricToImperial } from '../Configuration';
import { IApplicationState } from '../Store';
import { ScreenTitle } from './Layout';

export interface IWeightIncreasedProps {
  fromWeight: number;
  toWeight: number;
  title: string;
  unit: IApplicationState['configuration']['unit'];
  onDone(): any;
}

interface IWeightIncreasedState {
  weight: number;
}

class WeightIncreased extends React.Component<IWeightIncreasedProps, IWeightIncreasedState> {
  public state: IWeightIncreasedState = {
    weight: 0,
  };

  public _container: View | null = null;
  public intervalId: ReturnType<typeof setInterval> | null = null;

  public componentDidMount() {
    this.setState({
      weight: this.props.fromWeight,
    });
  }

  public componentDidUpdate(oldProps: IWeightIncreasedProps) {
    if (!isEqual(this.props, oldProps)) {
      this.setState({
        weight: this.props.fromWeight,
      });
    }
  }

  public increaseWeight = () => {
    this.setState(
      {
        weight: this.state.weight + 0.1,
      },
      () => {
        if (this.intervalId && this.state.weight >= this.props.toWeight) {
          clearInterval(this.intervalId);
        }
      }
    );
  };

  public render(): JSX.Element {
    const { unit } = this.props;
    return (
      <BlurView
        style={{
          ...StyleSheet.absoluteFillObject,
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
        }}
        blurAmount={30}
        blurType="dark"
      >
        <View animation="fadeIn">
          <View
            animation="slideInUp"
            duration={800}
            style={{ color: 'white', marginTop: -200, fontSize: 30, fontWeight: '300' }}
          >
            <ScreenTitle
              title={this.props.title}
              subtitle="Weight increased"
              subtitleStyle={{
                fontSize: 20,
                fontWeight: '100',
              }}
            />
          </View>
        </View>

        <View
          animation="fadeIn"
          delay={800}
          onAnimationBegin={() => {
            this.intervalId = setInterval(this.increaseWeight, 25);
          }}
        >
          <AnimatedCircularProgress
            size={120}
            width={3}
            fill={
              Number(
                (this.state.weight - this.props.fromWeight) /
                  (this.props.toWeight - this.props.fromWeight)
              ) * 100
            }
            tintColor="#FFFFFF"
            onAnimationComplete={() => {
              setTimeout(this.props.onDone, 5000);
            }}
            backgroundColor="rgba(255, 255, 255, 0.2)"
          >
            {() => (
              <Text style={{ fontSize: 36, fontWeight: '100', color: '#FFFFFF' }}>{`${parseFloat(
                (unit === 'METRIC'
                  ? this.state.weight || 0
                  : metricToImperial(this.state.weight || 0)
                ).toString()
              ).toFixed(1)}${unit === 'METRIC' ? 'kg' : 'lbs'}`}</Text>
            )}
          </AnimatedCircularProgress>
        </View>

        {this.state.weight >= this.props.toWeight && (
          <View animation="fadeIn" delay={800} style={{ marginTop: -132 }}>
            <LottieView
              autoSize
              style={{ width: 144, marginTop: 0 }}
              autoPlay
              loop={false}
              source={require('../Images/trophy.json')}
            />
          </View>
        )}
      </BlurView>
    );
  }
}

export default WeightIncreased;
